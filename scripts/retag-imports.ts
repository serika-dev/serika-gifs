#!/usr/bin/env bun
/**
 * Retag Imports Script (API-based)
 * 
 * This script completely re-tags all imported GIFs by fetching tags from the source APIs:
 * - Tenor: Uses the `tags` array returned by the API
 * - Giphy: Extracts tags from the slug (e.g., "confused-flying-YsTs5ltWtEhnq" -> ["confused", "flying"])
 * - Klipy: Uses tags from API if available
 * 
 * The script batches API requests to avoid rate limiting and handles errors gracefully.
 * 
 * Usage:
 *   bun run scripts/retag-imports.ts [--dry-run] [--source=TENOR|GIPHY|KLIPY] [--limit=100] [--concurrency=5]
 * 
 * Options:
 *   --dry-run            Show what would be done without actually doing it
 *   --source=SOURCE      Only process GIFs from a specific source
 *   --limit=N            Maximum number of GIFs to process (default: all)
 *   --concurrency=N      Number of concurrent API requests (default: 5)
 *   --verbose            Show detailed information about each GIF
 *   --keep-existing      Don't wipe existing tags, only add new ones
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

// API Keys
const TENOR_API_KEY = process.env.TENOR_API_KEY
const GIPHY_API_KEY = process.env.GIPHY_API_KEY

interface GifRecord {
  id: string
  slug: string
  title: string
  source: string
  sourceId: string | null
  sourceUrl: string | null
  _count: { tags: number }
}

interface TenorResponse {
  results: Array<{
    id: string
    tags?: string[]
    title?: string
    content_description?: string
  }>
}

interface GiphyResponse {
  data: {
    id: string
    slug: string
    title?: string
  }
}

// ========================================
// API Functions
// ========================================

async function fetchTenorTags(sourceIds: string[]): Promise<Map<string, string[]>> {
  if (!TENOR_API_KEY) {
    console.warn('⚠️  TENOR_API_KEY not set, skipping Tenor API calls')
    return new Map()
  }

  const results = new Map<string, string[]>()
  
  // Tenor API allows fetching up to 50 IDs at once
  const batchSize = 50
  for (let i = 0; i < sourceIds.length; i += batchSize) {
    const batch = sourceIds.slice(i, i + batchSize)
    const ids = batch.join(',')
    
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/posts?key=${TENOR_API_KEY}&ids=${ids}`
      )
      
      if (!response.ok) {
        console.warn(`⚠️  Tenor API error: ${response.status}`)
        continue
      }
      
      const data: TenorResponse = await response.json()
      
      for (const result of data.results) {
        if (result.tags && result.tags.length > 0) {
          results.set(result.id, result.tags)
        }
      }
      
      // Small delay between batches
      if (i + batchSize < sourceIds.length) {
        await new Promise(r => setTimeout(r, 100))
      }
    } catch (error) {
      console.warn(`⚠️  Tenor API fetch error:`, error)
    }
  }
  
  return results
}

async function fetchGiphyTags(sourceId: string): Promise<string[] | null> {
  if (!GIPHY_API_KEY) {
    return null
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/${sourceId}?api_key=${GIPHY_API_KEY}`
    )
    
    if (!response.ok) {
      return null
    }
    
    const data: GiphyResponse = await response.json()
    
    // Extract tags from slug
    if (data.data?.slug) {
      return extractTagsFromGiphySlug(data.data.slug, data.data.id)
    }
    
    return null
  } catch {
    return null
  }
}

function extractTagsFromGiphySlug(slug: string, id: string): string[] {
  if (!slug) return []
  
  // Remove the ID suffix (Giphy slugs end with the ID)
  const withoutId = slug.replace(new RegExp(`-?${id}$`, 'i'), '')
  
  // Split by hyphens and filter
  return withoutId
    .split('-')
    .map(t => t.toLowerCase().trim())
    .filter(tag => {
      // Must be 2+ chars, not purely numeric, not too long
      return tag.length >= 2 && 
             tag.length <= 30 &&
             !/^\d+$/.test(tag) &&
             !/^[a-z0-9]{10,}$/i.test(tag)  // Skip ID-like strings
    })
}

// ========================================
// Database Functions
// ========================================

function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w-]/g, '')
    .slice(0, 50)
}

async function ensureImportTag(): Promise<string> {
  const tag = await prisma.tag.upsert({
    where: { slug: 'import' },
    update: {},
    create: { name: 'import', slug: 'import' },
  })
  return tag.id
}

async function wipeTagsForGif(gifId: string, importTagId: string): Promise<number> {
  const result = await prisma.tagOnGif.deleteMany({
    where: {
      gifId,
      tagId: { not: importTagId },
    },
  })
  return result.count
}

async function createAndLinkTags(
  gifId: string, 
  tagNames: string[], 
  importTagId: string
): Promise<number> {
  if (tagNames.length === 0) return 0
  
  let linked = 0
  const tagArray = tagNames.slice(0, 15) // Allow up to 15 tags per GIF
  
  // Batch upsert tags
  const tags = await Promise.all(
    tagArray.map(async (name) => {
      const slug = slugifyTag(name)
      if (!slug || slug === 'import') return null
      
      try {
        return await prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name, slug },
        })
      } catch {
        return prisma.tag.findUnique({ where: { slug } })
      }
    })
  )
  
  // Build tag links
  const validTags = tags.filter(t => t !== null)
  const tagLinks = validTags.map(tag => ({
    gifId,
    tagId: tag.id,
  }))
  
  // Also ensure the import tag link exists
  tagLinks.push({ gifId, tagId: importTagId })
  
  if (tagLinks.length > 0) {
    const result = await prisma.tagOnGif.createMany({
      data: tagLinks,
      skipDuplicates: true,
    })
    linked = result.count
  }
  
  return linked
}

// ========================================
// Main Script
// ========================================

async function processGifsInBatches(
  gifs: GifRecord[],
  options: {
    dryRun: boolean
    verbose: boolean
    keepExisting: boolean
    concurrency: number
    importTagId: string
  }
): Promise<{
  processed: number
  tagsWiped: number
  tagsAdded: number
  tagCounts: Record<string, number>
}> {
  let processed = 0
  let tagsWiped = 0
  let tagsAdded = 0
  const tagCounts: Record<string, number> = {}

  // Group GIFs by source for batch API calls
  const tenorGifs = gifs.filter(g => g.source === 'TENOR' && g.sourceId)
  const giphyGifs = gifs.filter(g => g.source === 'GIPHY' && g.sourceId)
  const klipyGifs = gifs.filter(g => g.source === 'KLIPY')

  console.log(`\n📊 Distribution: Tenor: ${tenorGifs.length}, Giphy: ${giphyGifs.length}, Klipy: ${klipyGifs.length}`)

  // ========================================
  // Process Tenor GIFs (batch API calls)
  // ========================================
  if (tenorGifs.length > 0) {
    console.log(`\n🎵 Fetching tags for ${tenorGifs.length} Tenor GIFs...`)
    
    const tenorIds = tenorGifs.map(g => g.sourceId!).filter(Boolean)
    const tenorTagsMap = await fetchTenorTags(tenorIds)
    
    console.log(`   ✓ Got tags for ${tenorTagsMap.size}/${tenorIds.length} GIFs`)
    
    for (const gif of tenorGifs) {
      const apiTags = tenorTagsMap.get(gif.sourceId!) || []
      
      if (options.verbose) {
        console.log(`\n📦 ${gif.slug} (TENOR)`)
        console.log(`   Source ID: ${gif.sourceId}`)
        console.log(`   Current tags: ${gif._count.tags}`)
        console.log(`   API tags: ${apiTags.join(', ') || '(none from API)'}`)
      }

      if (!options.dryRun) {
        if (!options.keepExisting && gif._count.tags > 0) {
          const wiped = await wipeTagsForGif(gif.id, options.importTagId)
          tagsWiped += wiped
        }
        
        const added = await createAndLinkTags(gif.id, apiTags, options.importTagId)
        tagsAdded += added
      }
      
      apiTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
      
      processed++
      if (processed % 100 === 0) {
        console.log(`   Processed ${processed}/${gifs.length}...`)
      }
    }
  }

  // ========================================
  // Process Giphy GIFs (individual API calls with concurrency)
  // ========================================
  if (giphyGifs.length > 0) {
    console.log(`\n🎬 Fetching tags for ${giphyGifs.length} Giphy GIFs...`)
    
    // Process in batches with concurrency
    for (let i = 0; i < giphyGifs.length; i += options.concurrency) {
      const batch = giphyGifs.slice(i, i + options.concurrency)
      
      const results = await Promise.all(
        batch.map(async (gif) => {
          const apiTags = await fetchGiphyTags(gif.sourceId!)
          return { gif, apiTags: apiTags || [] }
        })
      )
      
      for (const { gif, apiTags } of results) {
        if (options.verbose) {
          console.log(`\n📦 ${gif.slug} (GIPHY)`)
          console.log(`   Source ID: ${gif.sourceId}`)
          console.log(`   Current tags: ${gif._count.tags}`)
          console.log(`   API tags: ${apiTags.join(', ') || '(none)'}`)
        }

        if (!options.dryRun) {
          if (!options.keepExisting && gif._count.tags > 0) {
            const wiped = await wipeTagsForGif(gif.id, options.importTagId)
            tagsWiped += wiped
          }
          
          const added = await createAndLinkTags(gif.id, apiTags, options.importTagId)
          tagsAdded += added
        }
        
        apiTags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
        
        processed++
      }
      
      if (processed % 50 === 0) {
        console.log(`   Processed ${processed}/${gifs.length}...`)
      }
      
      // Rate limiting delay
      if (i + options.concurrency < giphyGifs.length) {
        await new Promise(r => setTimeout(r, 50))
      }
    }
  }

  // ========================================
  // Process Klipy GIFs (no API, extract from title/slug)
  // ========================================
  if (klipyGifs.length > 0) {
    console.log(`\n🎪 Processing ${klipyGifs.length} Klipy GIFs (title-based)...`)
    
    for (const gif of klipyGifs) {
      // For Klipy, extract from title since we don't have API access
      const tags = extractTagsFromTitle(gif.title)
      
      if (options.verbose) {
        console.log(`\n📦 ${gif.slug} (KLIPY)`)
        console.log(`   Title: ${gif.title}`)
        console.log(`   Current tags: ${gif._count.tags}`)
        console.log(`   Extracted tags: ${tags.join(', ') || '(none)'}`)
      }

      if (!options.dryRun) {
        if (!options.keepExisting && gif._count.tags > 0) {
          const wiped = await wipeTagsForGif(gif.id, options.importTagId)
          tagsWiped += wiped
        }
        
        const added = await createAndLinkTags(gif.id, tags, options.importTagId)
        tagsAdded += added
      }
      
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
      
      processed++
      if (processed % 100 === 0) {
        console.log(`   Processed ${processed}/${gifs.length}...`)
      }
    }
  }

  return { processed, tagsWiped, tagsAdded, tagCounts }
}

// Fallback: extract tags from title (for Klipy or when API fails)
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has',
  'are', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'into', 'about',
  'when', 'you', 'your', 'they', 'them', 'their', 'what', 'where', 'which',
  'who', 'whom', 'how', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
  'some', 'any', 'most', 'other', 'such', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'but', 'now', 'also', 'well', 'back', 'even',
  'new', 'want', 'way', 'look', 'use', 'day', 'good', 'first', 'last',
  'his', 'her', 'its', 'our', 'out', 'one', 'two', 'three',
  'a', 'an', 'of', 'on', 'in', 'to', 'at', 'by', 'up', 'is', 'it',
  'as', 'or', 'if', 'so', 'be', 'do', 'go', 'no', 'my', 'me', 'he', 'we',
  'gif', 'gifs', 'giphy', 'tenor', 'klipy', 'animated', 'animation',
  'sticker', 'stickers', 'meme', 'memes', 'reaction', 'reactions',
  'close', 'front', 'next', 'wearing', 'standing', 'sitting', 'says',
  'written', 'words', 'above', 'below', 'shows', 'shown', 'face',
])

function extractTagsFromTitle(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(word => {
      return word.length >= 2 && 
             word.length <= 30 &&
             !STOP_WORDS.has(word) && 
             !/^\d+$/.test(word) &&
             !/^[a-z0-9]{10,}$/i.test(word)
    })
  
  return [...new Set(words)]
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  const keepExisting = args.includes('--keep-existing')
  
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceFilter = sourceArg ? sourceArg.split('=')[1].toUpperCase() : null
  
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  
  const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 5

  console.log('═══════════════════════════════════════════════════')
  console.log('     Re-Tag Imports Script (API-based)')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made')
  }
  if (keepExisting) {
    console.log('📌 Keeping existing tags, only adding new ones')
  } else {
    console.log('⚠️  Will WIPE all existing tags (except import)')
  }
  if (sourceFilter) {
    console.log(`📌 Filtering by source: ${sourceFilter}`)
  }
  if (limit) {
    console.log(`📌 Limiting to ${limit} GIFs`)
  }
  console.log(`🔄 Concurrency: ${concurrency}`)
  console.log('')

  // Check API keys
  if (!TENOR_API_KEY) {
    console.log('⚠️  TENOR_API_KEY not set - Tenor GIFs will be skipped')
  }
  if (!GIPHY_API_KEY) {
    console.log('⚠️  GIPHY_API_KEY not set - Giphy GIFs will use slug extraction only')
  }

  const importTagId = await ensureImportTag()
  console.log(`✓ Import tag ready (ID: ${importTagId})\n`)

  // Build query
  const where: any = {
    source: { not: 'UPLOAD' }
  }
  
  if (sourceFilter && ['TENOR', 'GIPHY', 'KLIPY'].includes(sourceFilter)) {
    where.source = sourceFilter
  }

  const gifs = await prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
      sourceId: true,
      sourceUrl: true,
      _count: { select: { tags: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  console.log(`Found ${gifs.length} imported GIFs to process`)

  if (gifs.length === 0) {
    console.log('✅ No GIFs to process!')
    return
  }

  const { processed, tagsWiped, tagsAdded, tagCounts } = await processGifsInBatches(
    gifs,
    { dryRun, verbose, keepExisting, concurrency, importTagId }
  )

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                   Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`GIFs processed: ${processed}`)
  if (!dryRun) {
    console.log(`Tags wiped: ${tagsWiped}`)
    console.log(`Tags added: ${tagsAdded}`)
  }
  
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  
  console.log('\nTop 30 tags:')
  sortedTags.forEach(([tag, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${tag.padEnd(20)} (${count})`)
  })
  
  // Clean up orphaned tags (tags with no GIFs)
  if (!dryRun) {
    console.log('\n🧹 Cleaning up orphaned tags...')
    const orphanedTags = await prisma.tag.deleteMany({
      where: {
        gifs: { none: {} },
        slug: { not: 'import' }, // Keep import tag even if empty
      },
    })
    console.log(`   Deleted ${orphanedTags.count} orphaned tags`)
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
