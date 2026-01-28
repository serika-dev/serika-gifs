/**
 * Migrate existing URLs to use the new CDN (cdn.ado.wtf)
 * 
 * This script updates all GIF URLs from the old Backblaze format to the new CDN format.
 * 
 * Usage:
 *   bun run scripts/migrate-cdn-urls.ts [--dry-run] [--verbose] [--concurrency N]
 * 
 * Options:
 *   --dry-run: Don't make any changes, just show what would be done
 *   --verbose: Show detailed progress
 *   --concurrency N: Process N GIFs at a time (default: 20)
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// Parse args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const concurrencyIdx = args.indexOf('--concurrency')
const concurrency = concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1]) : 20

const NEW_CDN_HOST = 'cdn.ado.wtf'

function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Remove leading slash from pathname
    return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
  } catch {
    return null
  }
}

function isAlreadyCDN(url: string): boolean {
  return url.includes(NEW_CDN_HOST)
}

function convertToCDN(url: string): string | null {
  if (isAlreadyCDN(url)) return null // Already converted
  
  const key = extractKeyFromUrl(url)
  if (!key) return null
  
  // Handle old bucket format: bucket.endpoint/key
  // Also handle /file/bucket/key format
  let cleanKey = key
  if (key.startsWith('file/')) {
    // Remove 'file/bucket-name/' prefix
    const parts = key.split('/')
    cleanKey = parts.slice(2).join('/')
  }
  
  return `https://${NEW_CDN_HOST}/${cleanKey}`
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('        CDN URL Migration Script')
  console.log('═══════════════════════════════════════════════════')
  console.log(`New CDN: https://${NEW_CDN_HOST}`)
  console.log(`Concurrency: ${concurrency}`)
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made')
  }
  console.log('')

  // Get all GIFs
  const gifs = await prisma.gif.findMany({
    select: {
      id: true,
      slug: true,
      url: true,
      thumbnailUrl: true,
    },
  })

  console.log(`Found ${gifs.length} GIFs to check\n`)

  let processed = 0
  let updated = 0
  let alreadyCDN = 0
  let errors = 0
  const startTime = Date.now()

  // Process a single GIF
  async function processGif(gif: typeof gifs[0]): Promise<'updated' | 'already' | 'error'> {
    const newUrl = convertToCDN(gif.url)
    const newThumbUrl = gif.thumbnailUrl ? convertToCDN(gif.thumbnailUrl) : null

    if (!newUrl && !newThumbUrl) {
      if (isAlreadyCDN(gif.url)) {
        return 'already'
      }
      return 'already'
    }

    if (verbose) {
      console.log(`📦 ${gif.slug}`)
      if (newUrl) {
        console.log(`   URL: ${gif.url}`)
        console.log(`     → ${newUrl}`)
      }
      if (newThumbUrl) {
        console.log(`   Thumb: ${gif.thumbnailUrl}`)
        console.log(`       → ${newThumbUrl}`)
      }
    }

    if (!dryRun) {
      try {
        await prisma.gif.update({
          where: { id: gif.id },
          data: {
            ...(newUrl && { url: newUrl }),
            ...(newThumbUrl && { thumbnailUrl: newThumbUrl }),
          },
        })
        return 'updated'
      } catch (error) {
        console.error(`  ✗ Error updating ${gif.slug}:`, error)
        return 'error'
      }
    } else {
      return 'updated'
    }
  }

  // Process GIFs in batches with concurrency
  for (let i = 0; i < gifs.length; i += concurrency) {
    const batch = gifs.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(processGif))
    
    for (const result of results) {
      processed++
      if (result === 'updated') updated++
      else if (result === 'already') alreadyCDN++
      else errors++
    }
    
    // Progress update after each batch
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const rate = processed / elapsed || 0
    const eta = Math.round((gifs.length - processed) / rate) || 0
    console.log(`Progress: ${processed}/${gifs.length} (${updated} updated, ${alreadyCDN} already CDN, ${errors} errors) | ${rate.toFixed(1)}/s | ETA: ${eta}s`)
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('Summary:')
  console.log(`  Total GIFs checked: ${gifs.length}`)
  console.log(`  Updated to CDN: ${updated}`)
  console.log(`  Already using CDN: ${alreadyCDN}`)
  console.log(`  Errors: ${errors}`)
  console.log('═══════════════════════════════════════════════════')

  if (dryRun) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.')
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
