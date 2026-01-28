/**
 * Generate static thumbnails for existing GIFs
 * 
 * This script downloads GIFs that don't have thumbnails (or have animated thumbnails),
 * generates static WebP thumbnails, and updates the database.
 * 
 * Usage:
 *   bun run scripts/generate-thumbnails.ts [--dry-run] [--verbose] [--limit N] [--force]
 * 
 * Options:
 *   --dry-run: Don't make any changes, just show what would be done
 *   --verbose: Show detailed progress
 *   --limit N: Only process N GIFs
 *   --force: Regenerate thumbnails even if they exist
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
  return `https://${process.env.B2_BUCKET_NAME}.${process.env.B2_ENDPOINT}/${key}`
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
  if (force) console.log('   Force: Regenerating all thumbnails')
  if (limit) console.log(`   Limit: ${limit} GIFs`)
  console.log('')
  
  // Find GIFs that need thumbnails
  const where: any = {
    url: { not: null },
  }
  
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
  
  for (const gif of gifs) {
    processed++
    
    log(`[${processed}/${gifs.length}] Processing ${gif.slug}...`)
    
    // Skip if not a GIF URL
    if (!gif.url.endsWith('.gif')) {
      log(`  Skipped: Not a GIF file`)
      skipped++
      continue
    }
    
    // Extract key from URL
    const key = extractKeyFromUrl(gif.url)
    if (!key) {
      log(`  Skipped: Could not extract key from URL`)
      skipped++
      continue
    }
    
    if (dryRun) {
      log(`  Would generate thumbnail for: ${key}`)
      success++
      continue
    }
    
    try {
      // Download GIF
      log(`  Downloading from: ${key}`)
      const gifBuffer = await downloadFromB2(key)
      if (!gifBuffer) {
        log(`  Failed: Could not download GIF`)
        failed++
        continue
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
      success++
    } catch (error) {
      log(`  Error: ${error}`)
      failed++
    }
    
    // Progress update every 10 GIFs
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${gifs.length} (${success} success, ${failed} failed, ${skipped} skipped)`)
    }
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

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
