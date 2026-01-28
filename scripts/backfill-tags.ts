#!/usr/bin/env bun
/**
 * Backfill Tags Script
 * 
 * This script adds tags to GIFs that were imported without proper tagging.
 * It uses the title and source to generate relevant tags.
 * 
 * Usage:
 *   bun run scripts/backfill-tags.ts [--dry-run] [--source=TENOR|GIPHY|KLIPY] [--limit=100]
 * 
 * Options:
 *   --dry-run         Show what would be added without actually adding
 *   --source=SOURCE   Only process GIFs from a specific source
 *   --limit=N         Maximum number of GIFs to process (default: all)
 *   --verbose         Show detailed information about each GIF
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Stop words to exclude from tags
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has',
  'are', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'into', 'about', 'gif',
  'gifs', 'giphy', 'tenor', 'klipy', 'animated', 'animation', 'meme', 'reaction',
  'when', 'you', 'your', 'they', 'them', 'their', 'what', 'where', 'which',
  'who', 'whom', 'how', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
  'some', 'any', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than',
])

function extractTags(title: string): Set<string> {
  const tags = new Set<string>()
  
  // Clean and split text
  const words = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')  // Remove special chars except hyphens
    .split(/\s+/)
    .filter(word => {
      // Must be 2+ chars, not a stop word, and not purely numeric
      return word.length >= 2 && 
             !STOP_WORDS.has(word) && 
             !/^\d+$/.test(word)
    })
  
  words.forEach(word => tags.add(word))
  
  return tags
}

function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w-]/g, '')
    .slice(0, 50)
}

async function createAndLinkTags(gifId: string, tagNames: Set<string>): Promise<number> {
  if (tagNames.size === 0) return 0
  
  let linked = 0
  const tagArray = Array.from(tagNames).slice(0, 10) // Limit to 10 tags per GIF
  
  // Get existing tags for this GIF
  const existingTagLinks = await prisma.tagOnGif.findMany({
    where: { gifId },
    include: { tag: true },
  })
  const existingTagSlugs = new Set(existingTagLinks.map((t: { tag: { slug: string } }) => t.tag.slug))
  
  // Filter out tags that already exist
  const newTags = tagArray.filter(name => !existingTagSlugs.has(slugifyTag(name)))
  
  interface TagRecord {
    id: string
    name: string
    slug: string
    createdAt: Date
  }
  
  // Batch upsert tags
  const tags: (TagRecord | null)[] = await Promise.all(
    newTags.map(async (name): Promise<TagRecord | null> => {
      const slug = slugifyTag(name)
      if (!slug) return null
      
      try {
        return await prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name, slug },
        })
      } catch {
        // Race condition - tag already exists
        return prisma.tag.findUnique({ where: { slug } })
      }
    })
  )
  
  // Batch create tag links using createMany with skipDuplicates
  const validTags = tags.filter((t): t is TagRecord => t !== null)
  const tagLinks = validTags.map((tag: TagRecord) => ({
    gifId,
    tagId: tag.id,
  }))
  
  if (tagLinks.length > 0) {
    const result = await prisma.tagOnGif.createMany({
      data: tagLinks,
      skipDuplicates: true,
    })
    linked = result.count
  }
  
  return linked
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  
  // Parse source filter
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceFilter = sourceArg ? sourceArg.split('=')[1].toUpperCase() : null
  
  // Parse limit
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined

  console.log('═══════════════════════════════════════════════════')
  console.log('        Tag Backfill Script')
  console.log('═══════════════════════════════════════════════════')
  if (dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made')
  }
  if (sourceFilter) {
    console.log(`📌 Filtering by source: ${sourceFilter}`)
  }
  if (limit) {
    console.log(`📌 Limiting to ${limit} GIFs`)
  }
  console.log('')

  // Build query
  const where: any = {}
  
  if (sourceFilter && ['TENOR', 'GIPHY', 'KLIPY', 'UPLOAD'].includes(sourceFilter)) {
    where.source = sourceFilter
  }

  // Find GIFs with no tags or few tags
  const gifs = await prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
      _count: { select: { tags: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  interface GifWithCount {
    id: string
    slug: string
    title: string
    source: string
    _count: { tags: number }
  }

  // Filter to those with 0 tags
  const gifsWithoutTags = gifs.filter((g: GifWithCount) => g._count.tags === 0)

  console.log(`Found ${gifsWithoutTags.length} GIFs without tags (out of ${gifs.length} total)\n`)

  if (gifsWithoutTags.length === 0) {
    console.log('✅ All GIFs already have tags!')
    return
  }

  let processed = 0
  let totalTagsAdded = 0
  const tagCounts: Record<string, number> = {}

  for (const gif of gifsWithoutTags) {
    const tags = extractTags(gif.title)
    
    if (verbose) {
      console.log(`\n📦 ${gif.slug} (${gif.source})`)
      console.log(`   Title: ${gif.title}`)
      console.log(`   Tags: ${Array.from(tags).join(', ') || '(none)'}`)
    }

    if (tags.size > 0) {
      if (!dryRun) {
        const added = await createAndLinkTags(gif.id, tags)
        totalTagsAdded += added
        
        if (verbose && added > 0) {
          console.log(`   Added: ${added} tags`)
        }
      } else {
        totalTagsAdded += tags.size
      }

      // Track tag usage
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }

    processed++

    // Progress update every 100 GIFs
    if (processed % 100 === 0) {
      console.log(`Progress: ${processed}/${gifsWithoutTags.length}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                    Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`GIFs processed: ${processed}`)
  console.log(`Total tags added: ${totalTagsAdded}`)
  
  // Show top tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
  
  if (topTags.length > 0) {
    console.log('\nTop tags:')
    for (const [tag, count] of topTags) {
      console.log(`  ${tag}: ${count}`)
    }
  }

  if (dryRun) {
    console.log('\n🔸 Run without --dry-run to actually add tags')
  } else {
    console.log('\n✅ Tags added successfully!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
