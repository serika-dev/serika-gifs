#!/usr/bin/env bun
/**
 * Migrate Imported GIFs Script
 * 
 * This script migrates imported GIFs to use the same storage path format
 * as regular uploads and adds an "import" tag to them.
 * 
 * Old format: gifs/imports/{source}/{slug}.gif
 * New format: gifs/{userId}/{slug}.gif
 * 
 * Usage:
 *   bun run scripts/migrate-imports.ts [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run   Show what would be changed without actually changing
 *   --verbose   Show detailed information about each migration
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

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
const BUCKET_ENDPOINT = process.env.B2_ENDPOINT!

interface GifToMigrate {
  id: string
  slug: string
  url: string
  thumbnailUrl: string | null
  userId: string
  source: string
}

function extractKeyFromUrl(url: string): string | null {
  // URL format: https://bucket.endpoint/key
  const match = url.match(/https:\/\/[^/]+\/(.+)$/)
  return match ? match[1] : null
}

function isImportPath(key: string): boolean {
  return key.startsWith('gifs/imports/')
}

function getNewKey(oldKey: string, userId: string, slug: string): string {
  // Extract file extension
  const ext = oldKey.split('.').pop() || 'gif'
  const isThumb = oldKey.includes('_thumb')
  
  if (isThumb) {
    return `gifs/${userId}/${slug}_thumb.${ext}`
  }
  return `gifs/${userId}/${slug}.${ext}`
}

async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await s3Client.send(new CopyObjectCommand({
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/${sourceKey}`,
    Key: destKey,
  }))
}

async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }))
}

async function ensureImportTag(): Promise<string> {
  const tag = await prisma.tag.upsert({
    where: { slug: 'import' },
    create: { name: 'import', slug: 'import' },
    update: {},
  })
  return tag.id
}

async function addImportTagToGif(gifId: string, tagId: string): Promise<boolean> {
  try {
    await prisma.tagOnGif.create({
      data: { gifId, tagId },
    })
    return true
  } catch {
    // Already has tag
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  console.log('═══════════════════════════════════════════════════')
  console.log('        Import Migration Script')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made\n')
  }

  // Get import tag ID
  const importTagId = await ensureImportTag()
  console.log(`✓ Import tag ready (ID: ${importTagId})\n`)

  // Find all imported GIFs
  const gifs: GifToMigrate[] = await prisma.gif.findMany({
    where: {
      source: { in: ['GIPHY', 'TENOR', 'KLIPY'] },
    },
    select: {
      id: true,
      slug: true,
      url: true,
      thumbnailUrl: true,
      userId: true,
      source: true,
    },
  })

  console.log(`Found ${gifs.length} imported GIFs\n`)

  let migratedFiles = 0
  let migratedThumbnails = 0
  let tagsAdded = 0
  let skippedAlreadyMigrated = 0
  let errors = 0

  for (const gif of gifs) {
    const mainKey = extractKeyFromUrl(gif.url)
    const thumbKey = gif.thumbnailUrl ? extractKeyFromUrl(gif.thumbnailUrl) : null

    if (!mainKey) {
      console.error(`  ✗ Could not extract key from URL: ${gif.url}`)
      errors++
      continue
    }

    // Check if already migrated
    if (!isImportPath(mainKey)) {
      if (verbose) {
        console.log(`  ○ Already migrated: ${gif.slug}`)
      }
      skippedAlreadyMigrated++
      
      // Still add import tag if missing
      if (!dryRun) {
        if (await addImportTagToGif(gif.id, importTagId)) {
          tagsAdded++
        }
      }
      continue
    }

    const newMainKey = getNewKey(mainKey, gif.userId, gif.slug)
    const newThumbKey = thumbKey ? getNewKey(thumbKey, gif.userId, gif.slug) : null

    if (verbose) {
      console.log(`\n📦 ${gif.slug} (${gif.source})`)
      console.log(`   Old: ${mainKey}`)
      console.log(`   New: ${newMainKey}`)
      if (thumbKey && newThumbKey) {
        console.log(`   Thumb Old: ${thumbKey}`)
        console.log(`   Thumb New: ${newThumbKey}`)
      }
    }

    if (!dryRun) {
      try {
        // Copy main file
        await copyObject(mainKey, newMainKey)
        
        // Copy thumbnail if exists
        if (thumbKey && newThumbKey) {
          try {
            await copyObject(thumbKey, newThumbKey)
            migratedThumbnails++
          } catch {
            // Thumbnail might not exist
          }
        }

        // Update database
        const newUrl = `https://${BUCKET_NAME}.${BUCKET_ENDPOINT}/${newMainKey}`
        const newThumbUrl = newThumbKey 
          ? `https://${BUCKET_NAME}.${BUCKET_ENDPOINT}/${newThumbKey}`
          : gif.thumbnailUrl

        await prisma.gif.update({
          where: { id: gif.id },
          data: {
            url: newUrl,
            thumbnailUrl: newThumbUrl,
          },
        })

        // Delete old files
        await deleteObject(mainKey)
        if (thumbKey) {
          try {
            await deleteObject(thumbKey)
          } catch {
            // Thumbnail might not exist
          }
        }

        // Add import tag
        if (await addImportTagToGif(gif.id, importTagId)) {
          tagsAdded++
        }

        migratedFiles++
      } catch (error) {
        console.error(`  ✗ Error migrating ${gif.slug}:`, error)
        errors++
      }
    } else {
      migratedFiles++
      if (thumbKey) migratedThumbnails++
      tagsAdded++
    }

    // Progress update
    if ((migratedFiles + skippedAlreadyMigrated + errors) % 50 === 0) {
      console.log(`Progress: ${migratedFiles + skippedAlreadyMigrated + errors}/${gifs.length}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                    Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`Total GIFs: ${gifs.length}`)
  console.log(`Migrated: ${migratedFiles}`)
  console.log(`Thumbnails migrated: ${migratedThumbnails}`)
  console.log(`Already migrated: ${skippedAlreadyMigrated}`)
  console.log(`Import tags added: ${tagsAdded}`)
  console.log(`Errors: ${errors}`)

  if (dryRun) {
    console.log('\n🔸 Run without --dry-run to actually migrate')
  } else {
    console.log('\n✅ Migration completed!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
