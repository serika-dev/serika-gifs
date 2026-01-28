/**
 * Generate static thumbnails for existing GIFs
 * 
 * This script downloads GIFs that don't have thumbnails (or have animated thumbnails),
 * generates static WebP thumbnails, and updates the database.
 * 
 * Usage:
 *   bun run scripts/generate-thumbnails.ts [--dry-run] [--verbose] [--limit N] [--force] [--concurrency N]
 * 
 * Options:
 *   --dry-run: Don't make any changes, just show what would be done
 *   --verbose: Show detailed progress
 *   --limit N: Only process N GIFs
 *   --force: Regenerate thumbnails even if they exist
 *   --concurrency N: Process N GIFs at a time (default: 10)
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

const s3Client = new S3Client({
  region: 'eu-central-003',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
})

// Parse args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const force = args.includes('--force')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : undefined
const concurrencyIdx = args.indexOf('--concurrency')
const concurrency = concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1]) : 10

function log(message: string) {
  if (verbose) console.log(message)
}

async function downloadFromB2(key: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    })
    
    const response = await s3Client.send(command)
    if (!response.Body) return null
    
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  } catch (error) {
    log(`  Error downloading ${key}: ${error}`)
    return null
  }
}

async function uploadToB2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })
  
  await s3Client.send(command)
  return `https://cdn.ado.wtf/${key}`
}

async function generateStaticThumbnail(gifBuffer: Buffer): Promise<Buffer> {
  return sharp(gifBuffer, { 
    animated: false,
    pages: 1,
  })
    .resize(320, 320, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ 
      quality: 80,
      effort: 4,
    })
    .toBuffer()
}

function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Remove leading slash from pathname
    return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
  } catch {
    return null
  }
}

async function main() {
  console.log('🖼️  Generating static thumbnails for existing GIFs...')
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`   Concurrency: ${concurrency}`)
  if (force) console.log('   Force: Regenerating all thumbnails')
  if (limit) console.log(`   Limit: ${limit} GIFs`)
  console.log('')
  
  // Find GIFs that need thumbnails
  const where: any = {}
  
  if (!force) {
    // Only process GIFs without thumbnails or with animated (GIF) thumbnails
    where.OR = [
      { thumbnailUrl: null },
      { thumbnailUrl: { endsWith: '.gif' } },
    ]
  }
  
  const gifs = await prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      url: true,
      thumbnailUrl: true,
      userId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  
  console.log(`Found ${gifs.length} GIFs that need thumbnails`)
  console.log('')
  
  let processed = 0
  let success = 0
  let failed = 0
  let skipped = 0
  
  // Process a single GIF
  async function processGif(gif: typeof gifs[0]): Promise<'success' | 'failed' | 'skipped'> {
    log(`Processing ${gif.slug}...`)
    
    // Skip if not a GIF URL
    if (!gif.url.endsWith('.gif')) {
      log(`  Skipped: Not a GIF file`)
      return 'skipped'
    }
    
    // Extract key from URL
    const key = extractKeyFromUrl(gif.url)
    if (!key) {
      log(`  Skipped: Could not extract key from URL`)
      return 'skipped'
    }
    
    if (dryRun) {
      log(`  Would generate thumbnail for: ${key}`)
      return 'success'
    }
    
    try {
      // Download GIF
      log(`  Downloading from: ${key}`)
      const gifBuffer = await downloadFromB2(key)
      if (!gifBuffer) {
        log(`  Failed: Could not download GIF`)
        return 'failed'
      }
      
      // Generate thumbnail
      log(`  Generating static thumbnail...`)
      const thumbnailBuffer = await generateStaticThumbnail(gifBuffer)
      
      // Upload thumbnail
      const thumbnailKey = `thumbnails/${gif.userId}/${gif.slug}.webp`
      log(`  Uploading to: ${thumbnailKey}`)
      const thumbnailUrl = await uploadToB2(thumbnailBuffer, thumbnailKey, 'image/webp')
      
      // Update database
      await prisma.gif.update({
        where: { id: gif.id },
        data: { thumbnailUrl },
      })
      
      const sizeBefore = gifBuffer.length
      const sizeAfter = thumbnailBuffer.length
      const reduction = ((sizeBefore - sizeAfter) / sizeBefore * 100).toFixed(1)
      
      log(`  Success: ${(sizeBefore / 1024).toFixed(1)}KB -> ${(sizeAfter / 1024).toFixed(1)}KB (${reduction}% smaller)`)
      return 'success'
    } catch (error) {
      log(`  Error: ${error}`)
      return 'failed'
    }
  }
  
  // Process GIFs in batches with concurrency
  for (let i = 0; i < gifs.length; i += concurrency) {
    const batch = gifs.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(processGif))
    
    for (const result of results) {
      processed++
      if (result === 'success') success++
      else if (result === 'failed') failed++
      else skipped++
    }
    
    // Progress update after each batch
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const rate = processed / elapsed || 0
    const eta = Math.round((gifs.length - processed) / rate) || 0
    console.log(`Progress: ${processed}/${gifs.length} (${success} ✓, ${failed} ✗, ${skipped} ⊘) | ${rate.toFixed(1)}/s | ETA: ${eta}s`)
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('Summary:')
  console.log(`  Total processed: ${processed}`)
  console.log(`  Success: ${success}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Skipped: ${skipped}`)
  
  if (dryRun) {
    console.log('')
    console.log('This was a dry run. Run without --dry-run to apply changes.')
  }
  
  await prisma.$disconnect()
}

const startTime = Date.now()

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
