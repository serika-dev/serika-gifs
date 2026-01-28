#!/usr/bin/env bun
/**
 * Retag Imports Script
 * 
 * This script completely re-tags all imported GIFs by:
 * 1. Wiping all existing tags (except keeping 'import' tag)
 * 2. Extracting better tags from title and slug using smarter parsing
 * 
 * For Giphy: Tags are extracted from the slug (e.g., "confused-flying-YsTs5ltWtEhnq" -> ["confused", "flying"])
 * For Tenor: Tags are extracted from the content_description stored in title
 * For Klipy: Tags are extracted from title
 * 
 * Usage:
 *   bun run scripts/retag-imports.ts [--dry-run] [--source=TENOR|GIPHY|KLIPY] [--limit=100]
 * 
 * Options:
 *   --dry-run         Show what would be done without actually doing it
 *   --source=SOURCE   Only process GIFs from a specific source
 *   --limit=N         Maximum number of GIFs to process (default: all)
 *   --verbose         Show detailed information about each GIF
 *   --keep-existing   Don't wipe existing tags, only add new ones
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Stop words to exclude from tags
const STOP_WORDS = new Set([
  // Common words
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has',
  'are', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'into', 'about',
  'when', 'you', 'your', 'they', 'them', 'their', 'what', 'where', 'which',
  'who', 'whom', 'how', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
  'some', 'any', 'most', 'other', 'such', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'but', 'now', 'also', 'well', 'back', 'even',
  'new', 'want', 'way', 'look', 'use', 'day', 'good', 'first', 'last',
  'long', 'great', 'little', 'old', 'right', 'big', 'high', 'small',
  'his', 'her', 'its', 'our', 'out', 'one', 'two', 'three',
  // Prepositions and articles
  'a', 'an', 'of', 'on', 'in', 'to', 'at', 'by', 'up', 'is', 'it',
  'as', 'or', 'if', 'so', 'be', 'do', 'go', 'no', 'my', 'me', 'he', 'we',
  // GIF-specific stop words
  'gif', 'gifs', 'giphy', 'tenor', 'klipy', 'animated', 'animation',
  'sticker', 'stickers', 'meme', 'memes', 'reaction', 'reactions',
  'discover', 'share', 'perfect', 'best', 'top', 'popular', 'trending',
  'download', 'free', 'hd', 'original', 'source', 'image', 'picture',
  'video', 'clip', 'watch', 'see', 'find', 'get', 'make', 'made',
  // Very common reaction words that aren't useful alone
  'yes', 'no', 'okay', 'ok', 'yeah', 'yep', 'nope',
  // Common descriptors from image recognition
  'close', 'front', 'next', 'wearing', 'standing', 'sitting', 'says',
  'written', 'words', 'above', 'below', 'shows', 'shown',
])

// Known phrases to keep together (these won't be split)
const KNOWN_PHRASES = [
  'eye roll', 'side eye', 'thumbs up', 'thumbs down', 'face palm', 'facepalm',
  'high five', 'slow clap', 'mic drop', 'mind blown', 'deal with it',
  'shut up', 'come on', 'lets go', 'oh no', 'oh yeah', 'hell yeah',
  'good morning', 'good night', 'happy birthday', 'thank you', 'thanks',
]

function extractTagsFromText(text: string): Set<string> {
  const tags = new Set<string>()
  
  // Normalize text
  let normalized = text
    .toLowerCase()
    .replace(/[_-]+/g, ' ')  // Replace underscores and hyphens with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // Split camelCase
    .replace(/[^\w\s]/g, ' ')  // Remove special chars
    .replace(/\s+/g, ' ')  // Normalize spaces
    .trim()
  
  // First, check for known phrases and extract them
  for (const phrase of KNOWN_PHRASES) {
    if (normalized.includes(phrase)) {
      tags.add(phrase.replace(/\s+/g, '-'))
      normalized = normalized.replace(new RegExp(phrase, 'g'), ' ')
    }
  }
  
  // Split remaining text into words
  const words = normalized
    .split(/\s+/)
    .filter(word => {
      // Must be 2+ chars, not a stop word, and not purely numeric
      return word.length >= 2 && 
             !STOP_WORDS.has(word) && 
             !/^\d+$/.test(word) &&
             !/^[a-z0-9]{10,}$/i.test(word)  // Skip long ID-like strings
    })
  
  // Add individual words
  words.forEach(word => {
    if (word.length >= 2 && word.length <= 30) {
      tags.add(word)
    }
  })
  
  return tags
}

function extractTagsFromGiphySlug(slug: string): Set<string> {
  // Giphy slugs look like: "confused-flying-YsTs5ltWtEhnq"
  // The last part is the ID, everything before is the actual tag info
  const parts = slug.split('-')
  
  // Remove the last part if it looks like an ID (alphanumeric, 10+ chars)
  if (parts.length > 1 && /^[a-zA-Z0-9]{10,}$/.test(parts[parts.length - 1])) {
    parts.pop()
  }
  
  // Join back and extract tags
  return extractTagsFromText(parts.join(' '))
}

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
  // Delete all tags except 'import'
  const result = await prisma.tagOnGif.deleteMany({
    where: {
      gifId,
      tagId: { not: importTagId },
    },
  })
  return result.count
}

async function createAndLinkTags(gifId: string, tagNames: Set<string>, importTagId: string): Promise<number> {
  if (tagNames.size === 0) return 0
  
  let linked = 0
  const tagArray = Array.from(tagNames).slice(0, 15) // Allow up to 15 tags per GIF
  
  interface TagRecord {
    id: string
    name: string
    slug: string
    createdAt: Date
  }
  
  // Batch upsert tags
  const tags: (TagRecord | null)[] = await Promise.all(
    tagArray.map(async (name): Promise<TagRecord | null> => {
      const slug = slugifyTag(name)
      if (!slug || slug === 'import') return null  // Skip 'import' tag, we handle it separately
      
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

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')
  const keepExisting = args.includes('--keep-existing')
  
  // Parse source filter
  const sourceArg = args.find(a => a.startsWith('--source='))
  const sourceFilter = sourceArg ? sourceArg.split('=')[1].toUpperCase() : null
  
  // Parse limit
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined

  console.log('═══════════════════════════════════════════════════')
  console.log('        Re-Tag Imports Script')
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
  console.log('')

  // Get the import tag ID
  const importTagId = await ensureImportTag()
  console.log(`✓ Import tag ready (ID: ${importTagId})\n`)

  // Build query - only get imported GIFs (not UPLOAD)
  const where: any = {
    source: { not: 'UPLOAD' }
  }
  
  if (sourceFilter && ['TENOR', 'GIPHY', 'KLIPY'].includes(sourceFilter)) {
    where.source = sourceFilter
  }

  // Find all imported GIFs
  const gifs = await prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
      sourceUrl: true,
      _count: { select: { tags: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  console.log(`Found ${gifs.length} imported GIFs to process\n`)

  if (gifs.length === 0) {
    console.log('✅ No GIFs to process!')
    return
  }

  let processed = 0
  let tagsWiped = 0
  let tagsAdded = 0
  const newTagCounts: Record<string, number> = {}

  for (const gif of gifs) {
    // Extract tags based on source
    let tags: Set<string>
    
    if (gif.source === 'GIPHY' && gif.sourceUrl) {
      // For Giphy, extract from the URL slug
      const urlSlug = gif.sourceUrl.split('/').pop()?.split('-').slice(0, -1).join('-') || ''
      tags = extractTagsFromGiphySlug(urlSlug)
      // Also add from title
      const titleTags = extractTagsFromText(gif.title)
      titleTags.forEach(t => tags.add(t))
    } else {
      // For Tenor and Klipy, extract from title
      tags = extractTagsFromText(gif.title)
    }
    
    if (verbose) {
      console.log(`\n📦 ${gif.slug} (${gif.source})`)
      console.log(`   Title: ${gif.title}`)
      console.log(`   Source URL: ${gif.sourceUrl || 'N/A'}`)
      console.log(`   Current tags: ${gif._count.tags}`)
      console.log(`   New tags: ${Array.from(tags).join(', ') || '(none)'}`)
    }

    if (!dryRun) {
      // Wipe existing tags (unless --keep-existing)
      if (!keepExisting && gif._count.tags > 0) {
        const wiped = await wipeTagsForGif(gif.id, importTagId)
        tagsWiped += wiped
      }
      
      // Add new tags
      const added = await createAndLinkTags(gif.id, tags, importTagId)
      tagsAdded += added
      
      // Count new tags for summary
      tags.forEach(tag => {
        newTagCounts[tag] = (newTagCounts[tag] || 0) + 1
      })
    } else {
      // Count for dry run summary
      tags.forEach(tag => {
        newTagCounts[tag] = (newTagCounts[tag] || 0) + 1
      })
    }
    
    processed++
    
    // Progress update every 100 GIFs
    if (processed % 100 === 0) {
      console.log(`   Processed ${processed}/${gifs.length}...`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log('                   Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`GIFs processed: ${processed}`)
  if (!dryRun) {
    console.log(`Tags wiped: ${tagsWiped}`)
    console.log(`Tags added: ${tagsAdded}`)
  }
  
  // Show top 30 tags
  const sortedTags = Object.entries(newTagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  
  console.log('\nTop 30 tags:')
  sortedTags.forEach(([tag, count], i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${tag.padEnd(20)} (${count})`)
  })
  
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
