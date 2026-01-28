/**
 * Migrate existing URLs to use the new CDN (cdn.ado.wtf)
 * 
 * This script updates all GIF URLs from the old Backblaze format to the new CDN format.
 * 
 * Usage:
 *   bun run scripts/migrate-cdn-urls.ts [--dry-run] [--verbose]
 * 
 * Options:
 *   --dry-run: Don't make any changes, just show what would be done
 *   --verbose: Show detailed progress
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// Parse args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')

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
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made\n')
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

  let updated = 0
  let alreadyCDN = 0
  let errors = 0

  for (const gif of gifs) {
    const newUrl = convertToCDN(gif.url)
    const newThumbUrl = gif.thumbnailUrl ? convertToCDN(gif.thumbnailUrl) : null

    if (!newUrl && !newThumbUrl) {
      if (isAlreadyCDN(gif.url)) {
        alreadyCDN++
      }
      continue
    }

    if (verbose) {
      console.log(`\n📦 ${gif.slug}`)
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
        updated++
      } catch (error) {
        console.error(`  ✗ Error updating ${gif.slug}:`, error)
        errors++
      }
    } else {
      updated++
    }
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
