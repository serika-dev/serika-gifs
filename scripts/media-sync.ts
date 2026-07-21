#!/usr/bin/env bun
/**
 * Media Sync Script
 * 
 * This is the main script for managing all GIF media files. It combines the functionality of:
 * - download-mp4s.ts
 * - backfill-mp4-urls.ts
 * - generate-thumbnails.ts
 * - reimport-hires.ts
 * 
 * Features:
 * - Re-downloads missing GIF files from source APIs (Tenor/Giphy)
 * - Downloads/generates MP4 and WebM versions
 * - Generates WebM from MP4 via ffmpeg if source doesn't provide WebM
 * - Generates static thumbnails
 * - Verifies all files exist in the CDN and are not corrupted
 * - Can reset and re-sync all media
 * 
 * Usage:
 *   bun run scripts/media-sync.ts [options]
 * 
 * Options:
 *   --dry-run         Show what would be done without making changes
 *   --verbose         Show detailed progress
 *   --source=SOURCE   Only process GIFs from TENOR or GIPHY
 *   --limit=N         Limit to N GIFs
 *   --concurrency=N   Concurrent operations (default: 10)
 *   --check-only      Only check for missing files, don't download
 *   --force           Re-download all files even if they exist
 *   --reset           Delete all files and re-download from scratch
 *   --check-corrupt   Check for corrupted files (slow - downloads each file to verify)
 */

import { PrismaClient, GifSource } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

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
const TENOR_API_KEY = process.env.TENOR_API_KEY
const GIPHY_API_KEY = process.env.GIPHY_API_KEY

// ============================================
// API Interfaces
// ============================================

interface TenorResult {
  id: string
  media_formats?: {
    gif?: { url: string; dims: number[] }
    mp4?: { url: string }
    loopedmp4?: { url: string }
    webm?: { url: string }
  }
}

interface GiphyResult {
  id: string
  images?: {
    original?: { 
      url: string
      mp4?: string
      webp?: string
      width: string
      height: string
    }
    original_mp4?: { mp4: string }
  }
}

// ============================================
// Utility Functions
// ============================================

async function downloadFile(url: string, timeout = 60000): Promise<Buffer> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timeoutId)
  }
}

async function uploadToB2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })
  await s3Client.send(command)
  return `${CDN_BASE}/${key}`
}

async function fileExistsInB2(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }))
    return true
  } catch {
    return false
  }
}

async function deleteFromB2(key: string): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }))
  } catch {
    // Ignore errors
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function extractKeyFromUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
  } catch {
    return null
  }
}

// Check if a buffer has valid GIF magic bytes
function isValidGif(buffer: Buffer): boolean {
  if (buffer.length < 6) return false
  // GIF89a or GIF87a
  const magic = buffer.toString('ascii', 0, 6)
  return magic === 'GIF89a' || magic === 'GIF87a'
}

// Check if a buffer has valid MP4 magic bytes
function isValidMp4(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  // MP4 files have 'ftyp' at offset 4
  const ftyp = buffer.toString('ascii', 4, 8)
  return ftyp === 'ftyp'
}

// Check if a buffer has valid WebM magic bytes
function isValidWebm(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  // WebM files start with EBML header (0x1A45DFA3)
  return buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3
}

// Check if a file in B2 is corrupted by downloading first bytes
async function isFileCorruptedInB2(key: string, type: 'gif' | 'mp4' | 'webm'): Promise<boolean> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: 'bytes=0-31', // Just get first 32 bytes for magic check
    }))
    
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    
    switch (type) {
      case 'gif': return !isValidGif(buffer)
      case 'mp4': return !isValidMp4(buffer)
      case 'webm': return !isValidWebm(buffer)
      default: return false
    }
  } catch {
    return true // Can't read = corrupted
  }
}

// Generate GIF from MP4 using ffmpeg (high quality with palette)
async function generateGifFromMp4(mp4Buffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const mp4Path = join(tempDir, `${slug}-gif.mp4`)
  const palettePath = join(tempDir, `${slug}-palette.png`)
  const gifPath = join(tempDir, `${slug}-out.gif`)
  
  try {
    await writeFile(mp4Path, mp4Buffer)
    
    // First pass: generate palette for better quality
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-vf', 'fps=15,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff',
        palettePath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg palette exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    // Second pass: generate GIF using palette
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-i', palettePath,
        '-lavfi', 'fps=15,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-loop', '0',
        gifPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg gif exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const gifBuffer = await Bun.file(gifPath).arrayBuffer()
    return Buffer.from(gifBuffer)
  } finally {
    try { await unlink(mp4Path) } catch {}
    try { await unlink(palettePath) } catch {}
    try { await unlink(gifPath) } catch {}
  }
}

// Generate thumbnail from video using ffmpeg
async function generateThumbnailFromVideo(videoBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const videoPath = join(tempDir, `${slug}-thumb-in.mp4`)
  const thumbPath = join(tempDir, `${slug}-thumb.webp`)
  
  try {
    await writeFile(videoPath, videoBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', videoPath,
        '-vframes', '1',
        '-vf', 'scale=400:-1',
        '-q:v', '80',
        thumbPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg thumb exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const thumbBuffer = await Bun.file(thumbPath).arrayBuffer()
    return Buffer.from(thumbBuffer)
  } finally {
    try { await unlink(videoPath) } catch {}
    try { await unlink(thumbPath) } catch {}
  }
}

// Generate WebM from MP4 using ffmpeg
async function generateWebmFromMp4(mp4Buffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const mp4Path = join(tempDir, `${slug}.mp4`)
  const webmPath = join(tempDir, `${slug}.webm`)
  
  try {
    await writeFile(mp4Path, mp4Buffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', mp4Path,
        '-c:v', 'libvpx-vp9',
        '-crf', '18',           // High quality (0-63, lower = better)
        '-b:v', '2M',           // Target bitrate 2Mbps
        '-maxrate', '3M',       // Max bitrate
        '-bufsize', '4M',       // Buffer size
        '-deadline', 'good',    // Better quality encoding
        '-cpu-used', '2',       // Slower = better quality (0-5)
        '-row-mt', '1',         // Multi-threaded row encoding
        '-an',                  // No audio
        webmPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const webmBuffer = await Bun.file(webmPath).arrayBuffer()
    return Buffer.from(webmBuffer)
  } finally {
    // Cleanup temp files
    try { await unlink(mp4Path) } catch {}
    try { await unlink(webmPath) } catch {}
  }
}

// Generate MP4 from GIF using ffmpeg
async function generateMp4FromGif(gifBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const gifPath = join(tempDir, `${slug}.gif`)
  const mp4Path = join(tempDir, `${slug}.mp4`)
  
  try {
    await writeFile(gifPath, gifBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', gifPath,
        '-movflags', 'faststart',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  // Ensure even dimensions
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'fast',
        '-an',  // No audio
        mp4Path
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const mp4Buffer = await Bun.file(mp4Path).arrayBuffer()
    return Buffer.from(mp4Buffer)
  } finally {
    // Cleanup temp files
    try { await unlink(gifPath) } catch {}
    try { await unlink(mp4Path) } catch {}
  }
}

// Generate WebM from GIF using ffmpeg
async function generateWebmFromGif(gifBuffer: Buffer, slug: string): Promise<Buffer> {
  const tempDir = join(tmpdir(), 'serika-gifs')
  await mkdir(tempDir, { recursive: true })
  
  const gifPath = join(tempDir, `${slug}.gif`)
  const webmPath = join(tempDir, `${slug}.webm`)
  
  try {
    await writeFile(gifPath, gifBuffer)
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', gifPath,
        '-c:v', 'libvpx-vp9',
        '-crf', '18',           // High quality (0-63, lower = better)
        '-b:v', '2M',           // Target bitrate 2Mbps
        '-maxrate', '3M',       // Max bitrate
        '-bufsize', '4M',       // Buffer size
        '-deadline', 'good',    // Better quality encoding
        '-cpu-used', '2',       // Slower = better quality (0-5)
        '-row-mt', '1',         // Multi-threaded row encoding
        '-an',                  // No audio
        webmPath
      ])
      
      let stderr = ''
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString() })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-200)}`))
      })
      
      ffmpeg.on('error', reject)
    })
    
    const webmBuffer = await Bun.file(webmPath).arrayBuffer()
    return Buffer.from(webmBuffer)
  } finally {
    // Cleanup temp files
    try { await unlink(gifPath) } catch {}
    try { await unlink(webmPath) } catch {}
  }
}

// ============================================
// API Functions
// ============================================

async function fetchTenorMedia(ids: string[]): Promise<Map<string, TenorResult>> {
  if (!TENOR_API_KEY || ids.length === 0) return new Map()
  
  const results = new Map<string, TenorResult>()
  
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const idsParam = batch.join(',')
    
    try {
      const url = `https://tenor.googleapis.com/v2/posts?key=${TENOR_API_KEY}&ids=${idsParam}&media_filter=gif,mp4,loopedmp4,webm`
      const response = await fetch(url)
      
      if (!response.ok) continue
      
      const data = await response.json()
      for (const item of (data.results || [])) {
        results.set(item.id, item)
      }
    } catch {
      // Continue on error
    }
    
    if (i + 50 < ids.length) {
      await new Promise(r => setTimeout(r, 100))
    }
  }
  
  return results
}

async function fetchGiphyMedia(id: string): Promise<GiphyResult | null> {
  if (!GIPHY_API_KEY) return null
  
  try {
    const url = `https://api.giphy.com/v1/gifs/${id}?api_key=${GIPHY_API_KEY}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    return data.data
  } catch {
    return null
  }
}

// ============================================
// Processing Functions
// ============================================

interface ProcessResult {
  slug: string
  gifOk: boolean
  mp4Ok: boolean
  webmOk: boolean
  thumbOk: boolean
  corrupted: { gif: boolean; mp4: boolean; webm: boolean }
  downloaded: { gif: boolean; mp4: boolean; webm: boolean; thumb: boolean }
  generated: { gif: boolean; mp4: boolean; webm: boolean; thumb: boolean }
  errors: string[]
}

async function processGif(
  gif: {
    id: string
    slug: string
    userId: string
    source: GifSource
    sourceId: string | null
    url: string
    mp4Url: string | null
    webmUrl: string | null
    thumbnailUrl: string | null
  },
  mediaData: TenorResult | GiphyResult | null,
  options: { dryRun: boolean; verbose: boolean; force: boolean; checkCorrupt: boolean }
): Promise<ProcessResult> {
  const result: ProcessResult = {
    slug: gif.slug,
    gifOk: false,
    mp4Ok: false,
    webmOk: false,
    thumbOk: false,
    corrupted: { gif: false, mp4: false, webm: false },
    downloaded: { gif: false, mp4: false, webm: false, thumb: false },
    generated: { gif: false, mp4: false, webm: false, thumb: false },
    errors: [],
  }

  const basePath = `gifs/${gif.userId}/${gif.slug}`
  const gifKey = `${basePath}.gif`
  const mp4Key = `${basePath}.mp4`
  const webmKey = `${basePath}.webm`
  const thumbKey = `thumbnails/${gif.userId}/${gif.slug}.webp`

  // Check what exists
  const [gifExists, mp4Exists, webmExists, thumbExists] = await Promise.all([
    fileExistsInB2(gifKey),
    fileExistsInB2(mp4Key),
    fileExistsInB2(webmKey),
    fileExistsInB2(thumbKey),
  ])

  // Check for corruption if requested
  let gifCorrupted = false
  let mp4Corrupted = false
  let webmCorrupted = false
  
  if (options.checkCorrupt) {
    if (gifExists) {
      gifCorrupted = await isFileCorruptedInB2(gifKey, 'gif')
      result.corrupted.gif = gifCorrupted
    }
    if (mp4Exists) {
      mp4Corrupted = await isFileCorruptedInB2(mp4Key, 'mp4')
      result.corrupted.mp4 = mp4Corrupted
    }
    if (webmExists) {
      webmCorrupted = await isFileCorruptedInB2(webmKey, 'webm')
      result.corrupted.webm = webmCorrupted
    }
  }

  // Mark as OK only if exists AND not corrupted
  result.gifOk = gifExists && !gifCorrupted
  result.mp4Ok = mp4Exists && !mp4Corrupted
  result.webmOk = webmExists && !webmCorrupted
  result.thumbOk = thumbExists

  if (options.verbose) {
    console.log(`\n📦 ${gif.slug} (${gif.source})`)
    console.log(`   GIF: ${result.gifOk ? '✓' : gifCorrupted ? '🔴 CORRUPT' : '✗'}, MP4: ${result.mp4Ok ? '✓' : mp4Corrupted ? '🔴 CORRUPT' : '✗'}, WebM: ${result.webmOk ? '✓' : webmCorrupted ? '🔴 CORRUPT' : '✗'}, Thumb: ${thumbExists ? '✓' : '✗'}`)
  }

  if (options.dryRun) {
    return result
  }

  // Get source URLs
  let sourceGifUrl: string | null = null
  let sourceMp4Url: string | null = null
  let sourceWebmUrl: string | null = null

  if (gif.source === 'TENOR' && mediaData) {
    const tenor = mediaData as TenorResult
    sourceGifUrl = tenor.media_formats?.gif?.url || null
    sourceMp4Url = tenor.media_formats?.loopedmp4?.url || tenor.media_formats?.mp4?.url || null
    sourceWebmUrl = tenor.media_formats?.webm?.url || null
  } else if (gif.source === 'GIPHY' && mediaData) {
    const giphy = mediaData as GiphyResult
    sourceGifUrl = giphy.images?.original?.url || null
    sourceMp4Url = giphy.images?.original?.mp4 || giphy.images?.original_mp4?.mp4 || null
    // Giphy doesn't provide WebM
  }

  let gifBuffer: Buffer | null = null
  let mp4Buffer: Buffer | null = null

  // Download GIF if missing, corrupted, or forced
  if ((!result.gifOk || options.force) && sourceGifUrl) {
    try {
      if (options.verbose) console.log(`   ⬇️  Downloading GIF...`)
      gifBuffer = await downloadFile(sourceGifUrl)
      
      // Verify it's actually a valid GIF
      if (!isValidGif(gifBuffer)) {
        throw new Error('Downloaded file is not a valid GIF')
      }
      
      await uploadToB2(gifBuffer, gifKey, 'image/gif')
      result.gifOk = true
      result.downloaded.gif = true
      
      // Update database
      await prisma.gif.update({
        where: { id: gif.id },
        data: { 
          url: `${CDN_BASE}/${gifKey}`,
          fileSize: gifBuffer.length,
        },
      })
      
      if (options.verbose) console.log(`   ✓ GIF uploaded (${formatBytes(gifBuffer.length)})`)
    } catch (e) {
      result.errors.push(`GIF: ${e}`)
      if (options.verbose) console.log(`   ✗ GIF failed: ${e}`)
    }
  }

  // Download MP4 if missing, corrupted, or forced
  if ((!result.mp4Ok || options.force) && sourceMp4Url) {
    try {
      if (options.verbose) console.log(`   ⬇️  Downloading MP4...`)
      mp4Buffer = await downloadFile(sourceMp4Url)
      
      // Verify it's actually a valid MP4
      if (!isValidMp4(mp4Buffer)) {
        throw new Error('Downloaded file is not a valid MP4')
      }
      
      await uploadToB2(mp4Buffer, mp4Key, 'video/mp4')
      result.mp4Ok = true
      result.downloaded.mp4 = true
      
      await prisma.gif.update({
        where: { id: gif.id },
        data: { mp4Url: `${CDN_BASE}/${mp4Key}` },
      })
      
      if (options.verbose) console.log(`   ✓ MP4 uploaded (${formatBytes(mp4Buffer.length)})`)
    } catch (e) {
      result.errors.push(`MP4: ${e}`)
      if (options.verbose) console.log(`   ✗ MP4 failed: ${e}`)
    }
  }

  // Download WebM if missing, corrupted, or forced
  if ((!result.webmOk || options.force)) {
    // Try to download from source first
    if (sourceWebmUrl) {
      try {
        if (options.verbose) console.log(`   ⬇️  Downloading WebM...`)
        const webmBuffer = await downloadFile(sourceWebmUrl)
        
        // Verify it's actually a valid WebM
        if (!isValidWebm(webmBuffer)) {
          throw new Error('Downloaded file is not a valid WebM')
        }
        
        await uploadToB2(webmBuffer, webmKey, 'video/webm')
        result.webmOk = true
        result.downloaded.webm = true
        
        await prisma.gif.update({
          where: { id: gif.id },
          data: { webmUrl: `${CDN_BASE}/${webmKey}` },
        })
        
        if (options.verbose) console.log(`   ✓ WebM uploaded (${formatBytes(webmBuffer.length)})`)
      } catch (e) {
        result.errors.push(`WebM download: ${e}`)
        if (options.verbose) console.log(`   ✗ WebM download failed: ${e}`)
      }
    }
    
    // If no source WebM or download failed, generate from MP4 or GIF
    if (!result.webmOk) {
      // Get MP4 buffer if we don't have it
      if (!mp4Buffer && result.mp4Ok) {
        try {
          const mp4Url = gif.mp4Url || `${CDN_BASE}/${mp4Key}`
          mp4Buffer = await downloadFile(mp4Url)
        } catch {
          // Can't get MP4
        }
      }
      
      // Get GIF buffer if we don't have it (for fallback)
      if (!gifBuffer && result.gifOk) {
        try {
          const gifUrl = gif.url || `${CDN_BASE}/${gifKey}`
          gifBuffer = await downloadFile(gifUrl)
        } catch {
          // Can't get GIF
        }
      }
      
      if (mp4Buffer) {
        try {
          if (options.verbose) console.log(`   🔄 Generating WebM from MP4...`)
          const webmBuffer = await generateWebmFromMp4(mp4Buffer, gif.slug)
          
          await uploadToB2(webmBuffer, webmKey, 'video/webm')
          result.webmOk = true
          result.generated.webm = true
          
          await prisma.gif.update({
            where: { id: gif.id },
            data: { webmUrl: `${CDN_BASE}/${webmKey}` },
          })
          
          if (options.verbose) console.log(`   ✓ WebM generated from MP4 (${formatBytes(webmBuffer.length)})`)
        } catch (e) {
          result.errors.push(`WebM generate from MP4: ${e}`)
          if (options.verbose) console.log(`   ✗ WebM generation from MP4 failed: ${e}`)
        }
      } else if (gifBuffer) {
        // No MP4 available, generate WebM directly from GIF
        try {
          if (options.verbose) console.log(`   🔄 Generating WebM from GIF...`)
          const webmBuffer = await generateWebmFromGif(gifBuffer, gif.slug)
          
          await uploadToB2(webmBuffer, webmKey, 'video/webm')
          result.webmOk = true
          result.generated.webm = true
          
          await prisma.gif.update({
            where: { id: gif.id },
            data: { webmUrl: `${CDN_BASE}/${webmKey}` },
          })
          
          if (options.verbose) console.log(`   ✓ WebM generated from GIF (${formatBytes(webmBuffer.length)})`)
        } catch (e) {
          result.errors.push(`WebM generate from GIF: ${e}`)
          if (options.verbose) console.log(`   ✗ WebM generation from GIF failed: ${e}`)
        }
      }
    }
  }

  // Also generate MP4 from GIF if missing
  if (!result.mp4Ok && !sourceMp4Url) {
    // Get GIF buffer if we don't have it
    if (!gifBuffer && result.gifOk) {
      try {
        const gifUrl = gif.url || `${CDN_BASE}/${gifKey}`
        gifBuffer = await downloadFile(gifUrl)
      } catch {
        // Can't get GIF
      }
    }
    
    if (gifBuffer) {
      try {
        if (options.verbose) console.log(`   🔄 Generating MP4 from GIF...`)
        mp4Buffer = await generateMp4FromGif(gifBuffer, gif.slug)
        
        await uploadToB2(mp4Buffer, mp4Key, 'video/mp4')
        result.mp4Ok = true
        result.generated.mp4 = true
        
        await prisma.gif.update({
          where: { id: gif.id },
          data: { mp4Url: `${CDN_BASE}/${mp4Key}` },
        })
        
        if (options.verbose) console.log(`   ✓ MP4 generated from GIF (${formatBytes(mp4Buffer.length)})`)
      } catch (e) {
        result.errors.push(`MP4 generate: ${e}`)
        if (options.verbose) console.log(`   ✗ MP4 generation failed: ${e}`)
      }
    }
  }

  // Generate GIF from MP4 if GIF is missing but MP4 exists (for user uploads)
  if (!result.gifOk && !sourceGifUrl && result.mp4Ok) {
    // Get MP4 buffer if we don't have it
    if (!mp4Buffer) {
      try {
        const mp4Url = gif.mp4Url || `${CDN_BASE}/${mp4Key}`
        mp4Buffer = await downloadFile(mp4Url)
      } catch {
        // Can't get MP4
      }
    }
    
    if (mp4Buffer) {
      try {
        if (options.verbose) console.log(`   🔄 Generating GIF from MP4...`)
        gifBuffer = await generateGifFromMp4(mp4Buffer, gif.slug)
        
        await uploadToB2(gifBuffer, gifKey, 'image/gif')
        result.gifOk = true
        result.generated.gif = true
        
        await prisma.gif.update({
          where: { id: gif.id },
          data: { 
            url: `${CDN_BASE}/${gifKey}`,
          },
        })
        
        if (options.verbose) console.log(`   ✓ GIF generated from MP4 (${formatBytes(gifBuffer.length)})`)
      } catch (e) {
        result.errors.push(`GIF generate from MP4: ${e}`)
        if (options.verbose) console.log(`   ✗ GIF generation from MP4 failed: ${e}`)
      }
    }
  }

  // Generate thumbnail if missing or forced
  if ((!thumbExists || options.force)) {
    try {
      if (options.verbose) console.log(`   🖼️  Generating thumbnail...`)
      
      let thumbBuffer: Buffer | null = null
      
      // Try to generate from GIF first
      if (!gifBuffer && result.gifOk) {
        try {
          const existingUrl = gif.url || `${CDN_BASE}/${gifKey}`
          gifBuffer = await downloadFile(existingUrl)
        } catch {
          // Can't get GIF
        }
      }
      
      if (gifBuffer) {
        // Generate from GIF using sharp
        thumbBuffer = await sharp(gifBuffer, { animated: false, pages: 1 })
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()
      } else if (result.mp4Ok || mp4Buffer) {
        // Fallback: generate from MP4/video using ffmpeg
        if (!mp4Buffer) {
          try {
            const mp4Url = gif.mp4Url || `${CDN_BASE}/${mp4Key}`
            mp4Buffer = await downloadFile(mp4Url)
          } catch {
            // Can't get MP4
          }
        }
        
        if (mp4Buffer) {
          thumbBuffer = await generateThumbnailFromVideo(mp4Buffer, gif.slug)
          result.generated.thumb = true
        }
      }
      
      if (thumbBuffer) {
        await uploadToB2(thumbBuffer, thumbKey, 'image/webp')
        result.thumbOk = true
        if (!result.generated.thumb) result.downloaded.thumb = true
        
        await prisma.gif.update({
          where: { id: gif.id },
          data: { thumbnailUrl: `${CDN_BASE}/${thumbKey}` },
        })
        
        if (options.verbose) console.log(`   ✓ Thumbnail generated (${formatBytes(thumbBuffer.length)})`)
      }
    } catch (e) {
      result.errors.push(`Thumb: ${e}`)
      if (options.verbose) console.log(`   ✗ Thumbnail failed: ${e}`)
    }
  }

  return result
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  const checkOnly = args.includes('--check-only')
  const force = args.includes('--force')
  const reset = args.includes('--reset')
  const checkCorrupt = args.includes('--check-corrupt')
  
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceFilter = sourceArg ? sourceArg.split('=')[1].toUpperCase() as GifSource : null
  
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 10

  console.log('═══════════════════════════════════════════════════')
  console.log('           Media Sync - All-in-One Tool')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) console.log('🔸 DRY RUN MODE')
  if (checkOnly) console.log('📋 CHECK ONLY MODE')
  if (checkCorrupt) console.log('🔍 CHECKING FOR CORRUPTION (slower)')
  if (force) console.log('🔄 FORCE RE-DOWNLOAD')
  if (reset) console.log('⚠️  RESET MODE - Will re-download everything')
  if (sourceFilter) console.log(`📌 Source: ${sourceFilter}`)
  if (limit) console.log(`📌 Limit: ${limit}`)
  console.log(`🔄 Concurrency: ${concurrency}`)
  console.log('')

  // Check API keys
  if (!TENOR_API_KEY) console.log('⚠️  TENOR_API_KEY not set')
  if (!GIPHY_API_KEY) console.log('⚠️  GIPHY_API_KEY not set')
  console.log('')

  // Query GIFs
  const whereClause: Record<string, unknown> = {}
  
  if (sourceFilter) {
    whereClause.source = sourceFilter
  }

  const gifs = await prisma.gif.findMany({
    where: whereClause,
    select: {
      id: true,
      slug: true,
      userId: true,
      source: true,
      sourceId: true,
      url: true,
      mp4Url: true,
      webmUrl: true,
      thumbnailUrl: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Found ${gifs.length} GIFs to process\n`)

  if (gifs.length === 0) {
    console.log('✅ No GIFs to process!')
    return
  }

  // Separate by source
  const tenorGifs = gifs.filter(g => g.source === 'TENOR' && g.sourceId)
  const giphyGifs = gifs.filter(g => g.source === 'GIPHY' && g.sourceId)
  const otherGifs = gifs.filter(g => (g.source !== 'TENOR' && g.source !== 'GIPHY') || !g.sourceId)

  console.log(`📊 Distribution: Tenor: ${tenorGifs.length}, Giphy: ${giphyGifs.length}, Other: ${otherGifs.length}\n`)

  // Fetch all media data from APIs
  console.log('🔍 Fetching media data from APIs...')
  
  const tenorIds = tenorGifs.map(g => g.sourceId!).filter(Boolean)
  const tenorMediaMap = await fetchTenorMedia(tenorIds)
  console.log(`   Tenor: ${tenorMediaMap.size}/${tenorIds.length} found`)

  // Stats
  let totalProcessed = 0
  let missing = { gif: 0, mp4: 0, webm: 0, thumb: 0 }
  let corrupted = { gif: 0, mp4: 0, webm: 0 }
  let downloaded = { gif: 0, mp4: 0, webm: 0, thumb: 0 }
  let generated = { gif: 0, mp4: 0, webm: 0, thumb: 0 }
  let errors = 0

  // Process Tenor GIFs
  if (tenorGifs.length > 0) {
    console.log(`\n🎵 Processing ${tenorGifs.length} Tenor GIFs...`)
    
    const startTime = Date.now()
    for (let i = 0; i < tenorGifs.length; i += concurrency) {
      const batch = tenorGifs.slice(i, i + concurrency)
      
      const results = await Promise.all(
        batch.map(gif => {
          const mediaData = tenorMediaMap.get(gif.sourceId!) || null
          return processGif(gif, mediaData, { dryRun: dryRun || checkOnly, verbose, force: force || reset, checkCorrupt })
        })
      )
      
      for (const result of results) {
        totalProcessed++
        if (!result.gifOk) missing.gif++
        if (!result.mp4Ok) missing.mp4++
        if (!result.webmOk) missing.webm++
        if (!result.thumbOk) missing.thumb++
        if (result.corrupted.gif) corrupted.gif++
        if (result.corrupted.mp4) corrupted.mp4++
        if (result.corrupted.webm) corrupted.webm++
        if (result.downloaded.gif) downloaded.gif++
        if (result.downloaded.mp4) downloaded.mp4++
        if (result.downloaded.webm) downloaded.webm++
        if (result.downloaded.thumb) downloaded.thumb++
        if (result.generated.gif) generated.gif++
        if (result.generated.mp4) generated.mp4++
        if (result.generated.webm) generated.webm++
        if (result.generated.thumb) generated.thumb++
        if (result.errors.length > 0) errors++
      }
      
      const processed = Math.min(i + concurrency, tenorGifs.length)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (tenorGifs.length - processed) / rate
      const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`
      
      if (!verbose) {
        process.stdout.write(`\r   Processed ${processed}/${tenorGifs.length} (${rate.toFixed(1)}/s, ETA: ${eta})   `)
      }
    }
    if (!verbose) console.log()
  }

  // Process Giphy GIFs
  if (giphyGifs.length > 0) {
    console.log(`\n🎬 Processing ${giphyGifs.length} Giphy GIFs...`)
    
    const startTime = Date.now()
    for (let i = 0; i < giphyGifs.length; i += concurrency) {
      const batch = giphyGifs.slice(i, i + concurrency)
      
      const results = await Promise.all(
        batch.map(async gif => {
          const mediaData = await fetchGiphyMedia(gif.sourceId!)
          return processGif(gif, mediaData, { dryRun: dryRun || checkOnly, verbose, force: force || reset, checkCorrupt })
        })
      )
      
      for (const result of results) {
        totalProcessed++
        if (!result.gifOk) missing.gif++
        if (!result.mp4Ok) missing.mp4++
        if (!result.webmOk) missing.webm++
        if (!result.thumbOk) missing.thumb++
        if (result.corrupted.gif) corrupted.gif++
        if (result.corrupted.mp4) corrupted.mp4++
        if (result.corrupted.webm) corrupted.webm++
        if (result.downloaded.gif) downloaded.gif++
        if (result.downloaded.mp4) downloaded.mp4++
        if (result.downloaded.webm) downloaded.webm++
        if (result.downloaded.thumb) downloaded.thumb++
        if (result.generated.gif) generated.gif++
        if (result.generated.mp4) generated.mp4++
        if (result.generated.webm) generated.webm++
        if (result.generated.thumb) generated.thumb++
        if (result.errors.length > 0) errors++
      }
      
      const processed = Math.min(i + concurrency, giphyGifs.length)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (giphyGifs.length - processed) / rate
      const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`
      
      if (!verbose) {
        process.stdout.write(`\r   Processed ${processed}/${giphyGifs.length} (${rate.toFixed(1)}/s, ETA: ${eta})   `)
      }
      
      // Rate limit for Giphy
      await new Promise(r => setTimeout(r, 50))
    }
    if (!verbose) console.log()
  }

  // Process Other GIFs (uploads, etc.) - no API data, just check/generate files
  if (otherGifs.length > 0) {
    console.log(`\n📁 Processing ${otherGifs.length} other GIFs (uploads, etc.)...`)
    
    const startTime = Date.now()
    for (let i = 0; i < otherGifs.length; i += concurrency) {
      const batch = otherGifs.slice(i, i + concurrency)
      
      const results = await Promise.all(
        batch.map(gif => {
          // No API data for uploads
          return processGif(gif, null, { dryRun: dryRun || checkOnly, verbose, force: force || reset, checkCorrupt })
        })
      )
      
      for (const result of results) {
        totalProcessed++
        if (!result.gifOk) missing.gif++
        if (!result.mp4Ok) missing.mp4++
        if (!result.webmOk) missing.webm++
        if (!result.thumbOk) missing.thumb++
        if (result.corrupted.gif) corrupted.gif++
        if (result.corrupted.mp4) corrupted.mp4++
        if (result.corrupted.webm) corrupted.webm++
        if (result.downloaded.gif) downloaded.gif++
        if (result.downloaded.mp4) downloaded.mp4++
        if (result.downloaded.webm) downloaded.webm++
        if (result.downloaded.thumb) downloaded.thumb++
        if (result.generated.gif) generated.gif++
        if (result.generated.mp4) generated.mp4++
        if (result.generated.webm) generated.webm++
        if (result.generated.thumb) generated.thumb++
        if (result.errors.length > 0) errors++
      }
      
      const processed = Math.min(i + concurrency, otherGifs.length)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (otherGifs.length - processed) / rate
      const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`
      
      if (!verbose) {
        process.stdout.write(`\r   Processed ${processed}/${otherGifs.length} (${rate.toFixed(1)}/s, ETA: ${eta})   `)
      }
    }
    if (!verbose) console.log()
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════')
  console.log('                   Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Total processed:  ${totalProcessed}`)
  console.log('')
  console.log('Missing files (before sync):')
  console.log(`   GIF:       ${missing.gif}`)
  console.log(`   MP4:       ${missing.mp4}`)
  console.log(`   WebM:      ${missing.webm}`)
  console.log(`   Thumbnail: ${missing.thumb}`)
  if (checkCorrupt) {
    console.log('')
    console.log('Corrupted files found:')
    console.log(`   GIF:       ${corrupted.gif}`)
    console.log(`   MP4:       ${corrupted.mp4}`)
    console.log(`   WebM:      ${corrupted.webm}`)
  }
  console.log('')
  if (!checkOnly) {
    console.log('Downloaded:')
    console.log(`   GIF:       ${downloaded.gif}`)
    console.log(`   MP4:       ${downloaded.mp4}`)
    console.log(`   WebM:      ${downloaded.webm}`)
    console.log(`   Thumbnail: ${downloaded.thumb}`)
    console.log('')
    console.log('Generated:')
    console.log(`   GIF:       ${generated.gif} (from MP4)`)
    console.log(`   MP4:       ${generated.mp4} (from GIF)`)
    console.log(`   WebM:      ${generated.webm} (from MP4/GIF)`)
    console.log(`   Thumbnail: ${generated.thumb} (from video)`)
    console.log('')
  }
  console.log(`Errors:           ${errors}`)
  
  if (dryRun || checkOnly) {
    console.log('\n🔸 This was a check/dry-run. Run without --dry-run or --check-only to apply changes.')
  }
  
  console.log('\n✅ Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
