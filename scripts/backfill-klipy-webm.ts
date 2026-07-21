#!/usr/bin/env bun
/**
 * Backfill Klipy WebM
 *
 * Klipy's original import did NOT pull WebM, so every Klipy GIF in the DB is
 * missing its `webmUrl`. Klipy actually serves WebM for every rendition, so this
 * script re-fetches each missing GIF from the Klipy API by its sourceId,
 * downloads the WebM, uploads it to our CDN (B2), and updates the record.
 *
 * If Klipy no longer has the item (deleted) or doesn't return a WebM, it falls
 * back to generating a WebM from the GIF's existing MP4 (or GIF) via ffmpeg.
 *
 * Usage:
 *   bun run scripts/backfill-klipy-webm.ts [options]
 *
 * Options:
 *   --dry-run         Show what would be done without making changes
 *   --verbose         Show detailed per-GIF progress
 *   --limit=N         Only process the first N missing GIFs
 *   --concurrency=N   Concurrent operations (default: 5)
 *   --no-fallback     Skip ffmpeg fallback; only use Klipy's native WebM
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const prisma = new PrismaClient()

const s3Client = new S3Client({
  region: 'eu-central-003',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

const BUCKET_NAME = process.env.B2_BUCKET_NAME!
const CDN_BASE = 'https://cdn.ado.wtf'
const KLIPY_API_KEY = process.env.KLIPY_API_KEY

async function downloadFile(url: string, timeout = 60000): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timeoutId)
  }
}

async function uploadToB2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return `${CDN_BASE}/${key}`
}

// WebM files start with the EBML header (0x1A45DFA3)
function isValidWebm(buffer: Buffer): boolean {
  return buffer.length >= 4 &&
    buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Fetch a single Klipy GIF by its numeric id and return the best WebM URL.
 * Klipy's real API places the key in the URL path: /api/v1/{KEY}/gifs/{id}
 */
async function fetchKlipyWebmUrl(sourceId: string): Promise<string | null> {
  if (!KLIPY_API_KEY) throw new Error('KLIPY_API_KEY not configured')
  try {
    const res = await fetch(`https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/${sourceId}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const json = await res.json()
    // by-id endpoint returns the item directly under `data`
    const item = json?.data?.data ?? json?.data ?? null
    const file = item?.file || {}
    return file.hd?.webm?.url || file.md?.webm?.url || file.sm?.webm?.url || file.xs?.webm?.url || null
  } catch {
    return null
  }
}

// Generate WebM from an MP4 or GIF buffer using ffmpeg (VP9, high quality, no audio)
async function generateWebm(inputBuffer: Buffer, slug: string, ext: 'mp4' | 'gif'): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-klipy-webm')
  await mkdir(tempDir, { recursive: true })
  const inPath = join(tempDir, `${slug}.${ext}`)
  const webmPath = join(tempDir, `${slug}.webm`)

  try {
    await writeFile(inPath, inputBuffer)
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', '-i', inPath,
        '-c:v', 'libvpx-vp9',
        '-crf', '18', '-b:v', '2M', '-maxrate', '3M', '-bufsize', '4M',
        '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-an',
        webmPath,
      ])
      let stderr = ''
      ffmpeg.stderr.on('data', (d) => { stderr += d.toString() })
      ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-200)}`)))
      ffmpeg.on('error', reject)
    })
    return Buffer.from(await Bun.file(webmPath).arrayBuffer())
  } finally {
    try { await unlink(inPath) } catch {}
    try { await unlink(webmPath) } catch {}
  }
}

interface Options { dryRun: boolean; verbose: boolean; fallback: boolean }

type KlipyGif = {
  id: string
  slug: string
  userId: string
  sourceId: string | null
  url: string
  mp4Url: string | null
}

async function processGif(gif: KlipyGif, opts: Options): Promise<'klipy' | 'generated' | 'skipped' | 'failed'> {
  const webmKey = `gifs/${gif.userId}/${gif.slug}.webm`

  try {
    // 1. Prefer Klipy's native WebM
    let webmBuffer: Buffer | null = null
    let via: 'klipy' | 'generated' = 'klipy'

    if (gif.sourceId) {
      const klipyWebmUrl = await fetchKlipyWebmUrl(gif.sourceId)
      if (klipyWebmUrl) {
        const buf = await downloadFile(klipyWebmUrl)
        if (isValidWebm(buf)) webmBuffer = buf
        else if (opts.verbose) console.log(`   ⚠️  ${gif.slug}: Klipy WebM invalid, will try fallback`)
      }
    }

    // 2. Fallback: generate from existing MP4 or GIF
    if (!webmBuffer && opts.fallback) {
      const src = gif.mp4Url || gif.url
      const ext: 'mp4' | 'gif' = gif.mp4Url ? 'mp4' : 'gif'
      if (src) {
        const inputBuffer = await downloadFile(src)
        webmBuffer = await generateWebm(inputBuffer, gif.slug, ext)
        via = 'generated'
      }
    }

    if (!webmBuffer) {
      if (opts.verbose) console.log(`   ✗ ${gif.slug}: no WebM available (Klipy miss, fallback off/failed)`)
      return 'skipped'
    }

    if (opts.dryRun) {
      if (opts.verbose) console.log(`   [dry-run] ${gif.slug}: would upload WebM via ${via} (${formatBytes(webmBuffer.length)})`)
      return via
    }

    const cdnUrl = await uploadToB2(webmBuffer, webmKey, 'video/webm')
    await prisma.gif.update({ where: { id: gif.id }, data: { webmUrl: cdnUrl } })
    if (opts.verbose) console.log(`   ✓ ${gif.slug}: WebM via ${via} (${formatBytes(webmBuffer.length)})`)
    return via
  } catch (e) {
    if (opts.verbose) console.log(`   ✗ ${gif.slug}: ${e instanceof Error ? e.message : e}`)
    return 'failed'
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  const fallback = !args.includes('--no-fallback')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 5

  console.log('═══════════════════════════════════════════════════')
  console.log('           Backfill Klipy WebM')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) console.log('🔸 DRY RUN MODE')
  if (!fallback) console.log('🚫 Fallback generation disabled (Klipy WebM only)')
  console.log(`🔄 Concurrency: ${concurrency}${limit ? `, Limit: ${limit}` : ''}`)
  if (!KLIPY_API_KEY) console.log('⚠️  KLIPY_API_KEY not set — only ffmpeg fallback will work')
  console.log('')

  const gifs = await prisma.gif.findMany({
    where: { source: 'KLIPY', webmUrl: null },
    select: { id: true, slug: true, userId: true, sourceId: true, url: true, mp4Url: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Found ${gifs.length} Klipy GIFs missing WebM\n`)
  if (gifs.length === 0) {
    console.log('✅ Nothing to do!')
    return
  }

  const opts: Options = { dryRun, verbose, fallback }
  const stats = { klipy: 0, generated: 0, skipped: 0, failed: 0 }
  const startTime = Date.now()

  for (let i = 0; i < gifs.length; i += concurrency) {
    const batch = gifs.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(g => processGif(g, opts)))
    for (const r of results) stats[r]++

    const processed = Math.min(i + concurrency, gifs.length)
    if (!verbose) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (gifs.length - processed) / rate
      const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`
      process.stdout.write(`\r   Processed ${processed}/${gifs.length} (${rate.toFixed(1)}/s, ETA: ${eta})   `)
    }
  }
  if (!verbose) console.log()

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                   Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Klipy native WebM: ${stats.klipy}`)
  console.log(`Generated (ffmpeg): ${stats.generated}`)
  console.log(`Skipped (no source): ${stats.skipped}`)
  console.log(`Failed:            ${stats.failed}`)
  if (dryRun) console.log('\n🔸 Dry run — re-run without --dry-run to apply.')
  console.log('\n✅ Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
