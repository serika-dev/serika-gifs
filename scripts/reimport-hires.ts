#!/usr/bin/env bun
/**
 * Re-import GIFs at Highest Resolution (MP4 to GIF conversion)
 * 
 * This script re-downloads all imported GIFs at their highest available resolution
 * by fetching the MP4 from Tenor (highest quality) and converting to GIF using ffmpeg.
 * 
 * Requirements:
 *   - ffmpeg must be installed (apt install ffmpeg / brew install ffmpeg)
 * 
 * Usage:
 *   bun run scripts/reimport-hires.ts [--dry-run] [--source=TENOR|GIPHY] [--limit=100] [--concurrency=3]
 * 
 * Options:
 *   --dry-run            Show what would be done without actually doing it
 *   --source=SOURCE      Only process GIFs from a specific source
 *   --limit=N            Maximum number of GIFs to process (default: all)
 *   --concurrency=N      Number of concurrent downloads (default: 2)
 *   --verbose            Show detailed information about each GIF
 *   --use-gif            Use GIF format instead of MP4 conversion (faster but lower quality)
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { spawn } from 'child_process'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import 'dotenv/config'

const prisma = new PrismaClient()

// API Keys
const TENOR_API_KEY = process.env.TENOR_API_KEY
const GIPHY_API_KEY = process.env.GIPHY_API_KEY

// B2 Client
const s3Client = new S3Client({
  region: 'eu-central-003',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

interface GifRecord {
  id: string
  slug: string
  url: string
  source: string
  sourceId: string | null
  userId: string
  width: number
  height: number
  fileSize: number | null
}

interface TenorMediaFormat {
  url: string
  dims?: number[]
  size?: number
}

interface TenorResponse {
  results: Array<{
    id: string
    media_formats: {
      gif?: TenorMediaFormat
      mp4?: TenorMediaFormat
      loopedmp4?: TenorMediaFormat
    }
  }>
}

interface GiphyResponse {
  data: {
    images: {
      original: { url: string; width: string; height: string; size: string }
      original_mp4?: { mp4: string; width: string; height: string }
    }
  }
}

interface HiResData {
  mp4Url?: string
  gifUrl?: string
  width: number
  height: number
  size: number
}

// ========================================
// API Functions
// ========================================

async function fetchTenorHiRes(sourceIds: string[]): Promise<Map<string, HiResData>> {
  if (!TENOR_API_KEY) {
    console.warn('⚠️  TENOR_API_KEY not set')
    return new Map()
  }

  const results = new Map<string, HiResData>()
  
  const batchSize = 50
  for (let i = 0; i < sourceIds.length; i += batchSize) {
    const batch = sourceIds.slice(i, i + batchSize)
    const ids = batch.join(',')
    
    try {
      // Request both gif and mp4 formats
      const response = await fetch(
        `https://tenor.googleapis.com/v2/posts?key=${TENOR_API_KEY}&ids=${ids}&media_filter=gif,mp4,loopedmp4`
      )
      
      if (!response.ok) {
        console.warn(`⚠️  Tenor API error: ${response.status}`)
        continue
      }
      
      const data: TenorResponse = await response.json()
      
      for (const result of data.results) {
        const mp4 = result.media_formats?.mp4 || result.media_formats?.loopedmp4
        const gif = result.media_formats?.gif
        
        // Prefer MP4 for conversion (higher quality)
        if (mp4?.url || gif?.url) {
          results.set(result.id, {
            mp4Url: mp4?.url,
            gifUrl: gif?.url,
            width: (mp4?.dims?.[0] || gif?.dims?.[0]) || 0,
            height: (mp4?.dims?.[1] || gif?.dims?.[1]) || 0,
            size: gif?.size || 0,
          })
        }
      }
      
      if (i + batchSize < sourceIds.length) {
        await new Promise(r => setTimeout(r, 100))
      }
    } catch (error) {
      console.warn(`⚠️  Tenor API fetch error:`, error)
    }
  }
  
  return results
}

async function fetchGiphyHiRes(sourceId: string): Promise<HiResData | null> {
  if (!GIPHY_API_KEY) return null

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/${sourceId}?api_key=${GIPHY_API_KEY}`
    )
    
    if (!response.ok) return null
    
    const data: GiphyResponse = await response.json()
    const original = data.data?.images?.original
    const mp4 = data.data?.images?.original_mp4
    
    if (original?.url) {
      return {
        mp4Url: mp4?.mp4,
        gifUrl: original.url,
        width: parseInt(original.width) || 0,
        height: parseInt(original.height) || 0,
        size: parseInt(original.size) || 0,
      }
    }
    
    return null
  } catch {
    return null
  }
}

// ========================================
// Download & Conversion Functions
// ========================================

async function downloadFile(url: string, timeout = 120000): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`)
    }
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timeoutId)
  }
}

async function convertMp4ToGif(mp4Buffer: Buffer, width: number): Promise<Buffer> {
  const tmpMp4 = join(tmpdir(), `tenor_${Date.now()}.mp4`)
  const tmpGif = join(tmpdir(), `tenor_${Date.now()}.gif`)
  const tmpPalette = join(tmpdir(), `palette_${Date.now()}.png`)
  
  try {
    // Write MP4 to temp file
    await writeFile(tmpMp4, mp4Buffer)
    
    // Generate optimal palette - full stats mode captures all colors across all frames
    await runFfmpeg([
      '-i', tmpMp4,
      '-vf', `scale=${width}:-1:flags=lanczos,palettegen=max_colors=256:reserve_transparent=0:stats_mode=full`,
      '-y', tmpPalette
    ])
    
    // Convert with no dithering for lossless quality (cleaner, sharper output)
    await runFfmpeg([
      '-i', tmpMp4,
      '-i', tmpPalette,
      '-lavfi', `scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,
      '-y', tmpGif
    ])
    
    // Read the result
    const gifBuffer = await readFile(tmpGif)
    return gifBuffer
  } finally {
    // Cleanup temp files
    await unlink(tmpMp4).catch(() => {})
    await unlink(tmpGif).catch(() => {})
    await unlink(tmpPalette).catch(() => {})
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args])
    
    let stderr = ''
    proc.stderr?.on('data', (data) => { stderr += data.toString() })
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
      }
    })
    
    proc.on('error', reject)
  })
}

async function uploadToB2(buffer: Buffer, key: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: 'image/gif',
  })
  
  await s3Client.send(command)
}

function extractKeyFromUrl(url: string): string | null {
  const match = url.match(/cdn\.ado\.wtf\/(.+)$/)
  return match ? match[1] : null
}

// ========================================
// Main Processing
// ========================================

async function processGif(
  gif: GifRecord,
  hiResData: HiResData,
  options: { dryRun: boolean; verbose: boolean; useGif: boolean }
): Promise<{ success: boolean; oldSize: number; newSize: number; converted: boolean }> {
  const key = extractKeyFromUrl(gif.url)
  if (!key) {
    if (options.verbose) console.log(`   ⚠️  Could not extract key from URL: ${gif.url}`)
    return { success: false, oldSize: 0, newSize: 0, converted: false }
  }

  const oldSize = gif.fileSize || 0
  const useMp4 = !options.useGif && !!hiResData.mp4Url

  if (options.verbose) {
    console.log(`\n📦 ${gif.slug} (${gif.source})`)
    console.log(`   Current: ${gif.width}x${gif.height}, ${formatBytes(oldSize)}`)
    console.log(`   Available: ${hiResData.width}x${hiResData.height}`)
    console.log(`   Method: ${useMp4 ? 'MP4 → GIF conversion' : 'Direct GIF download'}`)
  }

  if (options.dryRun) {
    return { success: true, oldSize, newSize: 0, converted: useMp4 }
  }

  try {
    let gifBuffer: Buffer

    if (useMp4 && hiResData.mp4Url) {
      // Download MP4 and convert to high-quality GIF
      if (options.verbose) console.log(`   ⬇️  Downloading MP4...`)
      const mp4Buffer = await downloadFile(hiResData.mp4Url)
      
      if (options.verbose) console.log(`   🔄 Converting to GIF (this may take a moment)...`)
      gifBuffer = await convertMp4ToGif(mp4Buffer, hiResData.width || gif.width)
    } else if (hiResData.gifUrl) {
      // Direct GIF download
      if (options.verbose) console.log(`   ⬇️  Downloading GIF...`)
      gifBuffer = await downloadFile(hiResData.gifUrl)
    } else {
      if (options.verbose) console.log(`   ⚠️  No source URL available`)
      return { success: false, oldSize, newSize: 0, converted: false }
    }

    // Skip if new file is smaller (might be lower quality)
    if (gifBuffer.length < oldSize * 0.8 && oldSize > 0) {
      if (options.verbose) console.log(`   ⏭️  Skipping (new file smaller: ${formatBytes(gifBuffer.length)})`)
      return { success: false, oldSize, newSize: gifBuffer.length, converted: useMp4 }
    }

    // Upload to B2
    if (options.verbose) console.log(`   ⬆️  Uploading to B2...`)
    await uploadToB2(gifBuffer, key)
    
    // Update database
    await prisma.gif.update({
      where: { id: gif.id },
      data: {
        width: hiResData.width || gif.width,
        height: hiResData.height || gif.height,
        fileSize: gifBuffer.length,
      },
    })
    
    if (options.verbose) {
      console.log(`   ✅ Done! ${formatBytes(oldSize)} → ${formatBytes(gifBuffer.length)}`)
    }
    
    return { success: true, oldSize, newSize: gifBuffer.length, converted: useMp4 }
  } catch (error) {
    if (options.verbose) console.log(`   ❌ Error: ${error}`)
    return { success: false, oldSize, newSize: 0, converted: useMp4 }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version'])
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  const useGif = args.includes('--use-gif')
  
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceFilter = sourceArg ? sourceArg.split('=')[1].toUpperCase() : null
  
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 20

  console.log('═══════════════════════════════════════════════════')
  console.log('     Re-Import GIFs at Highest Resolution')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made')
  }
  if (useGif) {
    console.log('📌 Using direct GIF download (--use-gif)')
  } else {
    console.log('🎬 Using MP4 → GIF conversion for best quality')
  }
  if (sourceFilter) {
    console.log(`📌 Filtering by source: ${sourceFilter}`)
  }
  if (limit) {
    console.log(`📌 Limiting to ${limit} GIFs`)
  }
  console.log(`🔄 Concurrency: ${concurrency}`)
  console.log('')

  // Check ffmpeg
  if (!useGif) {
    const hasFfmpeg = await checkFfmpeg()
    if (!hasFfmpeg) {
      console.error('❌ ffmpeg not found! Install it or use --use-gif flag')
      console.error('   Ubuntu/Debian: sudo apt install ffmpeg')
      console.error('   macOS: brew install ffmpeg')
      process.exit(1)
    }
    console.log('✓ ffmpeg found\n')
  }

  // Check API keys
  if (!TENOR_API_KEY) {
    console.log('⚠️  TENOR_API_KEY not set - Tenor GIFs will be skipped')
  }
  if (!GIPHY_API_KEY) {
    console.log('⚠️  GIPHY_API_KEY not set - Giphy GIFs will be skipped')
  }

  // Query GIFs
  const where: Record<string, unknown> = {
    source: { in: ['TENOR', 'GIPHY'] },
    sourceId: { not: null },
  }
  
  if (sourceFilter && ['TENOR', 'GIPHY'].includes(sourceFilter)) {
    where.source = sourceFilter
  }

  const gifs = await prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      url: true,
      source: true,
      sourceId: true,
      userId: true,
      width: true,
      height: true,
      fileSize: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  console.log(`Found ${gifs.length} imported GIFs to process\n`)

  if (gifs.length === 0) {
    console.log('✅ No GIFs to process!')
    return
  }

  const tenorGifs = gifs.filter(g => g.source === 'TENOR' && g.sourceId)
  const giphyGifs = gifs.filter(g => g.source === 'GIPHY' && g.sourceId)

  console.log(`📊 Distribution: Tenor: ${tenorGifs.length}, Giphy: ${giphyGifs.length}`)

  let replaced = 0
  let skipped = 0
  let failed = 0
  let converted = 0
  let totalOldSize = 0
  let totalNewSize = 0

  // Process Tenor GIFs
  if (tenorGifs.length > 0 && TENOR_API_KEY) {
    console.log(`\n🎵 Fetching hi-res URLs for ${tenorGifs.length} Tenor GIFs...`)
    
    const tenorIds = tenorGifs.map(g => g.sourceId!).filter(Boolean)
    const hiResMap = await fetchTenorHiRes(tenorIds)
    
    const withMp4 = Array.from(hiResMap.values()).filter(v => v.mp4Url).length
    console.log(`   ✓ Got data for ${hiResMap.size}/${tenorIds.length} GIFs (${withMp4} with MP4)`)
    
    for (let i = 0; i < tenorGifs.length; i += concurrency) {
      const batch = tenorGifs.slice(i, i + concurrency)
      
      const results = await Promise.all(
        batch.map(async (gif) => {
          const hiRes = hiResMap.get(gif.sourceId!)
          if (!hiRes) {
            skipped++
            return null
          }
          return processGif(gif, hiRes, { dryRun, verbose, useGif })
        })
      )
      
      for (const result of results) {
        if (result) {
          if (result.success) {
            replaced++
            totalOldSize += result.oldSize
            totalNewSize += result.newSize
            if (result.converted) converted++
          } else if (result.oldSize > 0) {
            skipped++
          } else {
            failed++
          }
        }
      }
      
      const processed = Math.min(i + concurrency, tenorGifs.length)
      if (processed % 10 === 0 || processed === tenorGifs.length) {
        console.log(`   Processed ${processed}/${tenorGifs.length}...`)
      }
    }
  }

  // Process Giphy GIFs
  if (giphyGifs.length > 0 && GIPHY_API_KEY) {
    console.log(`\n🎬 Processing ${giphyGifs.length} Giphy GIFs...`)
    
    for (let i = 0; i < giphyGifs.length; i += concurrency) {
      const batch = giphyGifs.slice(i, i + concurrency)
      
      const results = await Promise.all(
        batch.map(async (gif) => {
          const hiRes = await fetchGiphyHiRes(gif.sourceId!)
          if (!hiRes) {
            skipped++
            return null
          }
          return processGif(gif, hiRes, { dryRun, verbose, useGif })
        })
      )
      
      for (const result of results) {
        if (result) {
          if (result.success) {
            replaced++
            totalOldSize += result.oldSize
            totalNewSize += result.newSize
            if (result.converted) converted++
          } else if (result.oldSize > 0) {
            skipped++
          } else {
            failed++
          }
        }
      }
      
      const processed = Math.min(i + concurrency, giphyGifs.length)
      if (processed % 10 === 0 || processed === giphyGifs.length) {
        console.log(`   Processed ${processed}/${giphyGifs.length}...`)
      }
      
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                   Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`GIFs replaced:    ${replaced}`)
  console.log(`  via MP4→GIF:    ${converted}`)
  console.log(`GIFs skipped:     ${skipped}`)
  console.log(`GIFs failed:      ${failed}`)
  
  if (!dryRun && replaced > 0) {
    console.log(`\nStorage: ${formatBytes(totalOldSize)} → ${formatBytes(totalNewSize)}`)
    const diff = totalNewSize - totalOldSize
    console.log(`Change:  ${diff > 0 ? '+' : ''}${formatBytes(Math.abs(diff))}`)
  }
  
  if (dryRun) {
    console.log('\n🔸 This was a dry run. Run without --dry-run to apply changes.')
  } else {
    console.log('\n✅ Done!')
  }
  
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  prisma.$disconnect()
  process.exit(1)
})
