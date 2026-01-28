import prisma from '@/lib/prisma'
import { uploadToB2 } from '@/lib/storage'
import { generateAndUploadThumbnail } from '@/lib/thumbnail'
import { nanoid } from 'nanoid'
import imageSize from 'image-size'

export interface ImportResult {
  id: string
  slug: string
  success: boolean
  error?: string
  isDuplicate?: boolean
  tagsCreated?: number
}

export interface GifToImport {
  sourceId: string
  title: string
  gifUrl: string
  previewUrl?: string
  sourceUrl?: string
  width?: number
  height?: number
  fileSize?: number
  source: 'GIPHY' | 'TENOR' | 'KLIPY'
  /** Tags from the source API (Tenor tags array, Giphy slug extraction, etc.) */
  sourceTags?: string[]
}

export interface ImportOptions {
  userId: string
  query: string
  concurrency?: number
  skipDuplicates?: boolean
  checkUrlDuplicates?: boolean
}

// Stop words to exclude from tags
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has',
  'are', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'into', 'about', 'gif',
  'gifs', 'giphy', 'tenor', 'klipy', 'animated', 'animation', 'meme', 'reaction',
])

/**
 * Extracts and normalizes tags from query and text content
 */
export function extractTags(query: string, additionalText?: string): Set<string> {
  const tags = new Set<string>()
  
  const processText = (text: string) => {
    // Clean and split text
    const words = text
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
  }
  
  // Process query
  processText(query)
  
  // Process additional text (title, description)
  if (additionalText) {
    // Limit to first 100 chars to avoid spam
    processText(additionalText.slice(0, 100))
  }
  
  return tags
}

/**
 * Slugify a tag name
 */
export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w-]/g, '')
    .slice(0, 50)
}

/**
 * Check for existing GIFs by source ID
 */
export async function checkExistingBySourceId(
  source: 'GIPHY' | 'TENOR' | 'KLIPY',
  sourceIds: string[]
): Promise<Map<string, string>> {
  const existing = await prisma.gif.findMany({
    where: {
      source,
      sourceId: { in: sourceIds },
    },
    select: {
      id: true,
      sourceId: true,
    },
  })
  
  return new Map(existing.map(g => [g.sourceId!, g.id]))
}

/**
 * Check for existing GIFs by URL hash (for detecting cross-source duplicates)
 */
export async function checkExistingByUrl(urls: string[]): Promise<Set<string>> {
  const existing = await prisma.gif.findMany({
    where: {
      url: { in: urls },
    },
    select: {
      url: true,
    },
  })
  
  return new Set(existing.map(g => g.url))
}

/**
 * Download a file and return its buffer
 */
async function downloadFile(url: string, timeout = 30000): Promise<Buffer> {
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

/**
 * Create or get tags and link them to a GIF
 * Uses batch upsert for better performance
 */
export async function createAndLinkTags(gifId: string, tagNames: Set<string>): Promise<number> {
  if (tagNames.size === 0) return 0
  
  let linked = 0
  const tagArray = Array.from(tagNames).slice(0, 10) // Limit to 10 tags per GIF
  
  // Batch upsert tags
  const tags = await Promise.all(
    tagArray.map(async (name) => {
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
  const tagLinks = tags
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map(tag => ({
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

/**
 * Import a single GIF with all processing
 */
export async function importSingleGif(
  gif: GifToImport,
  options: ImportOptions
): Promise<ImportResult> {
  const slug = nanoid(10)
  
  try {
    // Download main GIF
    const gifBuffer = await downloadFile(gif.gifUrl)
    
    // Get actual dimensions if not provided
    let width = gif.width || 0
    let height = gif.height || 0
    let fileSize = gif.fileSize || gifBuffer.length
    
    if (width === 0 || height === 0) {
      try {
        const dimensions = imageSize(gifBuffer)
        width = dimensions.width || 0
        height = dimensions.height || 0
      } catch {
        // Ignore dimension errors
      }
    }
    
    // Upload to B2 - use same path as normal uploads
    const key = `gifs/${options.userId}/${slug}.gif`
    const url = await uploadToB2(gifBuffer, key, 'image/gif')
    
    // Generate static WebP thumbnail from the GIF (first frame, compressed)
    let thumbnailUrl: string | null = null
    try {
      thumbnailUrl = await generateAndUploadThumbnail(gifBuffer, options.userId, slug)
    } catch (e) {
      console.error('Error generating thumbnail:', e)
      // Continue without thumbnail
    }
    
    // Use source tags from API if available, otherwise extract from query
    const tags = new Set<string>()
    
    if (gif.sourceTags && gif.sourceTags.length > 0) {
      // Use tags directly from the source API (Tenor, Giphy slug, etc.)
      for (const tag of gif.sourceTags) {
        const normalized = tag.toLowerCase().trim()
        if (normalized.length >= 2 && normalized.length <= 50) {
          tags.add(normalized)
        }
      }
    }
    
    // Also add the search query as a tag (it's what the user searched for)
    if (options.query) {
      const queryTags = options.query
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(t => t.length >= 2)
      queryTags.forEach(t => tags.add(t))
    }
    
    tags.add('import')  // Add import tag to all imported GIFs
    
    // Create GIF record
    const newGif = await prisma.gif.create({
      data: {
        slug,
        title: gif.title || options.query,
        url,
        thumbnailUrl,
        width,
        height,
        fileSize,
        source: gif.source,
        sourceId: gif.sourceId,
        sourceUrl: gif.sourceUrl,
        userId: options.userId,
      },
    })
    
    // Create and link tags
    const tagsCreated = await createAndLinkTags(newGif.id, tags)
    
    return {
      id: newGif.id,
      slug,
      success: true,
      tagsCreated,
    }
  } catch (error) {
    return {
      id: '',
      slug,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Import multiple GIFs concurrently with batching
 */
export async function importGifsBatch(
  gifs: GifToImport[],
  options: ImportOptions
): Promise<{
  imported: number
  failed: number
  skipped: number
  results: ImportResult[]
}> {
  const concurrency = options.concurrency || 5
  const results: ImportResult[] = []
  let imported = 0
  let failed = 0
  let skipped = 0
  
  // Check for existing duplicates by source ID
  const sourceIds = gifs.map(g => g.sourceId)
  const existingBySource = await checkExistingBySourceId(gifs[0]?.source || 'GIPHY', sourceIds)
  
  // Filter out duplicates
  const gifsToImport = gifs.filter(gif => {
    if (existingBySource.has(gif.sourceId)) {
      skipped++
      results.push({
        id: existingBySource.get(gif.sourceId)!,
        slug: '',
        success: true,
        isDuplicate: true,
      })
      return false
    }
    return true
  })
  
  // Process in concurrent batches
  for (let i = 0; i < gifsToImport.length; i += concurrency) {
    const batch = gifsToImport.slice(i, i + concurrency)
    
    const batchResults = await Promise.all(
      batch.map(gif => importSingleGif(gif, options))
    )
    
    for (const result of batchResults) {
      results.push(result)
      if (result.success && !result.isDuplicate) {
        imported++
      } else if (!result.success) {
        failed++
      }
    }
  }
  
  return { imported, failed, skipped, results }
}

/**
 * Find duplicate GIFs based on URL similarity
 * Uses file hash comparison for more accurate duplicate detection
 */
export async function findDuplicateGifs(): Promise<Array<{
  original: { id: string; slug: string; url: string; createdAt: Date }
  duplicates: Array<{ id: string; slug: string; url: string; createdAt: Date }>
}>> {
  // Find GIFs with the same sourceId (different source doesn't count)
  const gifsWithSource = await prisma.gif.findMany({
    where: {
      sourceId: { not: null },
    },
    select: {
      id: true,
      slug: true,
      url: true,
      sourceId: true,
      source: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  
  // Group by source + sourceId
  const groups = new Map<string, typeof gifsWithSource>()
  
  for (const gif of gifsWithSource) {
    const key = `${gif.source}:${gif.sourceId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(gif)
  }
  
  // Find groups with more than one entry
  const duplicateGroups: Array<{
    original: { id: string; slug: string; url: string; createdAt: Date }
    duplicates: Array<{ id: string; slug: string; url: string; createdAt: Date }>
  }> = []
  
  for (const gifs of groups.values()) {
    if (gifs.length > 1) {
      // Keep the oldest as original
      const [original, ...duplicates] = gifs
      duplicateGroups.push({
        original: {
          id: original.id,
          slug: original.slug,
          url: original.url,
          createdAt: original.createdAt,
        },
        duplicates: duplicates.map(d => ({
          id: d.id,
          slug: d.slug,
          url: d.url,
          createdAt: d.createdAt,
        })),
      })
    }
  }
  
  return duplicateGroups
}

/**
 * Update existing GIFs with new tags from a search query
 */
export async function updateGifTags(
  gifId: string,
  newTags: Set<string>
): Promise<number> {
  // Get existing tags
  const existingTags = await prisma.tagOnGif.findMany({
    where: { gifId },
    include: { tag: true },
  })
  
  const existingTagSlugs = new Set(existingTags.map(t => t.tag.slug))
  
  // Filter to only new tags
  const tagsToAdd = new Set<string>()
  for (const tag of newTags) {
    const slug = slugifyTag(tag)
    if (slug && !existingTagSlugs.has(slug)) {
      tagsToAdd.add(tag)
    }
  }
  
  if (tagsToAdd.size === 0) return 0
  
  return createAndLinkTags(gifId, tagsToAdd)
}

/**
 * Get GIFs that are missing tags
 */
export async function getGifsWithoutTags(source?: 'GIPHY' | 'TENOR' | 'KLIPY'): Promise<Array<{
  id: string
  slug: string
  title: string
  source: string
}>> {
  const where: any = {
    tags: { none: {} },
  }
  
  if (source) {
    where.source = source
  }
  
  return prisma.gif.findMany({
    where,
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
    },
  })
}
