import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { generateAndUploadThumbnail } from '@/lib/thumbnail'
import { generateMp4FromGif, generateWebmFromGif, generateWebmFromMp4, generateGifFromMp4, getVideoDimensions, generateThumbnailFromVideo } from '@/lib/media-convert'
import { nanoid } from 'nanoid'
import imageSize from 'image-size'
import { checkRateLimit, rateLimitResponse, addRateLimitHeaders } from '@/lib/rate-limit'

// Shared include shape for GIF list queries
const GIF_LIST_INCLUDE = {
  user: {
    select: { id: true, username: true, avatar: true },
  },
  tags: {
    include: { tag: true },
  },
  _count: {
    select: { favorites: true },
  },
} as const

/**
 * Time-decayed "hotness" score for trending.
 *
 * Blends engagement quality (views + weighted favorites, log-scaled so a few
 * viral GIFs don't permanently dominate) with a freshness term that decays over
 * days. New uploads surface immediately, then fall off unless they earn views;
 * consistently popular GIFs keep a baseline. Higher is hotter.
 */
function hotnessScore(views: number, favorites: number, createdAt: Date): number {
  const engagement = views + favorites * 4 + 1
  const quality = Math.log10(engagement)
  const ageHours = Math.max(0, Date.now() - new Date(createdAt).getTime()) / 3_600_000
  const freshness = 6 / Math.pow(ageHours + 2, 0.8)
  return quality + freshness
}

/**
 * All-time "top" score: pure engagement (views + weighted favorites), no
 * freshness decay, so the best GIFs ever surface regardless of upload date.
 */
function topScore(views: number, favorites: number): number {
  return views + favorites * 4
}

type ScoredGif = {
  title: string
  description: string | null
  views: number
  _count: { favorites: number }
  tags: { tag: { name: string } }[]
}

/**
 * Relevance score for search. Rewards GIFs that match *all* query terms (via
 * tags, title, or description), strongly boosts tag matches and exact-phrase
 * tag/title matches, and penalizes terms that don't appear at all — so a search
 * like "kamiina botan" surfaces the GIFs actually tagged/titled that, instead of
 * every high-view GIF that merely contains "botan". Popularity only breaks ties.
 */
function searchScore(gif: ScoredGif, terms: string[], phrase: string): number {
  const title = gif.title.toLowerCase()
  const desc = (gif.description || '').toLowerCase()
  const tagNames = gif.tags.map((t) => t.tag.name.toLowerCase())
  const tagBlob = tagNames.join(' ')

  let score = 0
  for (const term of terms) {
    const inTag = tagNames.some((n) => n.includes(term))
    const inTitle = title.includes(term)
    const inDesc = desc.includes(term)
    if (inTag) score += 10
    if (inTitle) score += 6
    if (inDesc) score += 2
    if (!inTag && !inTitle && !inDesc) score -= 5 // missing term hurts
  }

  // Reward matching every term (AND relevance)
  const allSomewhere = terms.every(
    (t) => title.includes(t) || desc.includes(t) || tagNames.some((n) => n.includes(t))
  )
  const allInTags = terms.every((t) => tagNames.some((n) => n.includes(t)))
  if (allSomewhere) score += 15
  if (allInTags) score += 20

  // Exact / phrase matches
  if (tagNames.includes(phrase)) score += 40
  if (title === phrase) score += 30
  if (tagBlob.includes(phrase)) score += 14
  if (title.includes(phrase)) score += 12

  // Popularity/recency only nudges ties
  score += Math.log10(gif.views + gif._count.favorites * 3 + 1)
  return score
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    },
  })
}

// GET /api/gifs - List GIFs (public, rate limited)
export async function GET(request: NextRequest) {
  try {
    // Check rate limit for anonymous users
    const rateLimitResult = await checkRateLimit(request)

    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult.resetTime)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const search = (searchParams.get('search') || searchParams.get('q') || '').trim()
    const tag = searchParams.get('tag') || ''
    const userId = searchParams.get('userId') || ''
    const source = searchParams.get('source') || ''
    // Default to all-time TOP so apps that don't pass a sort get the best GIFs
    // ever, not a recency-biased "trending today/this week" feed.
    const sort = searchParams.get('sort') || 'top'
    const timeRange = searchParams.get('timeRange') || 'all'
    // NSFW handling: 'exclude' (default, SFW only), 'include' (SFW + NSFW), 'only' (NSFW only)
    const nsfw = (searchParams.get('nsfw') || 'exclude').toLowerCase()

    const skip = (page - 1) * limit

    const where: any = {
      isPublic: true,
    }

    if (nsfw === 'only') {
      where.isNsfw = true
    } else if (nsfw !== 'include') {
      where.isNsfw = false
    }

    // Time range filter
    if (timeRange !== 'all') {
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(0)
      }

      where.createdAt = { gte: startDate }
    }

    const isSearching = !!search
    const searchTerms = search ? search.toLowerCase().split(/\s+/).filter(Boolean) : []

    // Match a single term across title, description, tag name, and tag slug
    // (slug has spaces/punctuation stripped, so "kamiina-botan" also matches).
    const termMatch = (term: string) => {
      const slugTerm = term.replace(/[^a-z0-9]/gi, '')
      const or: any[] = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { tags: { some: { tag: { name: { contains: term, mode: 'insensitive' } } } } },
      ]
      if (slugTerm) {
        or.push({ tags: { some: { tag: { slug: { contains: slugTerm, mode: 'insensitive' } } } } })
      }
      return { OR: or }
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: tag,
          },
        },
      }
    }

    if (userId) {
      where.userId = userId
    }

    // Determine sort order (trending is handled separately below via scoring)
    let orderBy: any
    switch (sort) {
      case 'popular':
        orderBy = { favorites: { _count: 'desc' } }
        break
      case 'most-viewed':
        orderBy = [{ views: 'desc' }, { createdAt: 'desc' }]
        break
      case 'random':
        orderBy = undefined
        break
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'trending':
      case 'top':
      default:
        // Both use a scored pool below; this is only the deep-page fallback.
        orderBy = [{ views: 'desc' }, { createdAt: 'desc' }]
    }

    // Source filtering removed - all GIFs treated equally

    let gifs
    let total

    if (isSearching && searchTerms.length > 0) {
      // Two candidate pools: a STRICT pool that requires every term to match
      // (this surfaces the truly relevant GIFs even when they have few views),
      // and a BROAD pool matching any term (typo/partial tolerance). Both are
      // merged and re-ranked by relevance so page 1 is the best matches.
      const POOL_SIZE = 500
      const strictWhere = { ...where, AND: searchTerms.map(termMatch) }
      const broadWhere = { ...where, OR: searchTerms.flatMap((t) => termMatch(t).OR) }

      const [strictPool, broadPool, count] = await Promise.all([
        prisma.gif.findMany({
          where: strictWhere,
          include: GIF_LIST_INCLUDE,
          orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
          take: POOL_SIZE,
        }),
        prisma.gif.findMany({
          where: broadWhere,
          include: GIF_LIST_INCLUDE,
          orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
          take: POOL_SIZE,
        }),
        prisma.gif.count({ where: broadWhere }),
      ])

      const byId = new Map<string, typeof broadPool[number]>()
      for (const g of strictPool) byId.set(g.id, g)
      for (const g of broadPool) byId.set(g.id, g)

      const phrase = search.toLowerCase()
      const ranked = Array.from(byId.values()).sort((a, b) => {
        const d = searchScore(b, searchTerms, phrase) - searchScore(a, searchTerms, phrase)
        if (d !== 0) return d
        if (a.views !== b.views) return b.views - a.views
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      total = count
      gifs = ranked.slice(skip, skip + limit)
    } else if (sort === 'random') {
      total = await prisma.gif.count({ where })
      const randomSkip = Math.floor(Math.random() * Math.max(0, total - limit))

      gifs = await prisma.gif.findMany({
        where,
        include: GIF_LIST_INCLUDE,
        skip: randomSkip,
        take: limit,
      })
    } else if (!isSearching && (sort === 'trending' || sort === 'top')) {
      // Build a candidate pool (freshest + most-viewed) and score each. 'top'
      // ranks by pure all-time engagement; 'trending' adds a freshness term.
      const POOL_SIZE = 600
      const [recentPool, viewedPool, count] = await Promise.all([
        prisma.gif.findMany({
          where,
          include: GIF_LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: POOL_SIZE,
        }),
        prisma.gif.findMany({
          where,
          include: GIF_LIST_INCLUDE,
          orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
          take: POOL_SIZE,
        }),
        prisma.gif.count({ where }),
      ])

      const byId = new Map<string, typeof recentPool[number]>()
      for (const g of recentPool) byId.set(g.id, g)
      for (const g of viewedPool) byId.set(g.id, g)

      const score =
        sort === 'top'
          ? (g: typeof recentPool[number]) => topScore(g.views, g._count.favorites)
          : (g: typeof recentPool[number]) =>
              hotnessScore(g.views, g._count.favorites, g.createdAt)

      const ranked = Array.from(byId.values()).sort((a, b) => score(b) - score(a))

      total = count
      gifs = ranked.slice(skip, skip + limit)

      // Deep pages fall outside the scored pool; fall back to a DB query.
      if (gifs.length === 0 && skip > 0) {
        gifs = await prisma.gif.findMany({
          where,
          include: GIF_LIST_INCLUDE,
          orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        })
      }
    } else {
      const result = await Promise.all([
        prisma.gif.findMany({
          where,
          include: GIF_LIST_INCLUDE,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.gif.count({ where }),
      ])

      gifs = result[0]
      total = result[1]

      // Fallback if no results found for specific timeRange
      if (total === 0 && timeRange !== 'all') {
        const fallbackWhere = { ...where }
        delete fallbackWhere.createdAt

        const fallbackResult = await Promise.all([
          prisma.gif.findMany({
            where: fallbackWhere,
            include: GIF_LIST_INCLUDE,
            orderBy,
            skip,
            take: limit,
          }),
          prisma.gif.count({ where: fallbackWhere }),
        ])

        gifs = fallbackResult[0]
        total = fallbackResult[1]
      }
    }

    // Count a view for every GIF the API hands back (list, search, and app
    // usage all count), matching single-GIF view behaviour. Fire the increment
    // and reflect it in the returned counts.
    let viewed = false
    if (gifs.length > 0) {
      try {
        await prisma.gif.updateMany({
          where: { id: { in: gifs.map((g: typeof gifs[number]) => g.id) } },
          data: { views: { increment: 1 } },
        })
        viewed = true
      } catch (e) {
        console.error('Error incrementing views:', e)
      }
    }

    const formattedGifs = gifs.map((gif: typeof gifs[number]) => ({
      id: gif.id,
      slug: gif.slug,
      title: gif.title,
      description: gif.description,
      url: gif.url,
      webmUrl: gif.webmUrl,
      thumbnailUrl: gif.thumbnailUrl,
      width: gif.width,
      height: gif.height,
      fileSize: gif.fileSize,
      duration: gif.duration,
      source: gif.source,
      isNsfw: gif.isNsfw,
      views: viewed ? gif.views + 1 : gif.views,
      favorites: gif._count.favorites,
      tags: gif.tags.map((t: { tag: { name: string } }) => t.tag.name),
      user: gif.user,
      createdAt: gif.createdAt,
    }))

    const response = NextResponse.json({
      gifs: formattedGifs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

    // Add rate limit headers for anonymous users
    return addRateLimitHeaders(response, rateLimitResult)
  } catch (error) {
    console.error('Error fetching gifs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch gifs' },
      { status: 500 }
    )
  }
}

// POST /api/gifs - Upload a GIF
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const tags = formData.get('tags') as string
    const isPublic = formData.get('isPublic') !== 'false'
    const isNsfw = formData.get('isNsfw') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/gif', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: GIF, WebP, MP4, WebM' },
        { status: 400 }
      )
    }

    // Max file size: 50MB
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileExtension = file.type.split('/')[1]
    const slug = nanoid(10)
    const key = `gifs/${session.id}/${slug}.${fileExtension}`

    // Get image/video dimensions
    let width = 0
    let height = 0

    if (file.type === 'video/mp4' || file.type === 'video/webm') {
      // Use ffprobe for video files
      try {
        const dimensions = await getVideoDimensions(buffer, slug)
        width = dimensions.width || 0
        height = dimensions.height || 0
      } catch (e) {
        console.error('Error getting video dimensions:', e)
      }
    } else {
      // Use imageSize for images
      try {
        const dimensions = imageSize(buffer)
        width = dimensions.width || 0
        height = dimensions.height || 0
      } catch (e) {
        console.error('Error getting image dimensions:', e)
      }
    }

    // Upload original to B2
    let url = await uploadToB2(buffer, key, file.type)

    // Generate MP4 and WebM versions, and thumbnail
    let mp4Url: string | null = null
    let webmUrl: string | null = null
    let thumbnailUrl: string | null = null

    if (file.type === 'image/gif') {
      // Generate MP4 from GIF
      try {
        const mp4Buffer = await generateMp4FromGif(buffer, slug)
        const mp4Key = `gifs/${session.id}/${slug}.mp4`
        mp4Url = await uploadToB2(mp4Buffer, mp4Key, 'video/mp4')
      } catch (e) {
        console.error('Error generating MP4:', e)
      }

      // Generate WebM from GIF
      try {
        const webmBuffer = await generateWebmFromGif(buffer, slug)
        const webmKey = `gifs/${session.id}/${slug}.webm`
        webmUrl = await uploadToB2(webmBuffer, webmKey, 'video/webm')
      } catch (e) {
        console.error('Error generating WebM:', e)
      }

      // Generate static thumbnail
      try {
        thumbnailUrl = await generateAndUploadThumbnail(buffer, session.id, slug)
      } catch (e) {
        console.error('Error generating thumbnail:', e)
      }
    } else if (file.type === 'video/mp4') {
      // For MP4 uploads, generate GIF, WebM, and thumbnail
      mp4Url = url  // The original is already MP4

      // Generate GIF from MP4 and use it as the primary URL
      try {
        const gifBuffer = await generateGifFromMp4(buffer, slug)
        const gifKey = `gifs/${session.id}/${slug}.gif`
        url = await uploadToB2(gifBuffer, gifKey, 'image/gif')
      } catch (e) {
        console.error('Error generating GIF from MP4:', e)
      }

      // Generate WebM from MP4
      try {
        const webmBuffer = await generateWebmFromMp4(buffer, slug)
        const webmKey = `gifs/${session.id}/${slug}.webm`
        webmUrl = await uploadToB2(webmBuffer, webmKey, 'video/webm')
      } catch (e) {
        console.error('Error generating WebM from MP4:', e)
      }

      // Generate thumbnail from video
      try {
        const thumbnailBuffer = await generateThumbnailFromVideo(buffer, slug)
        const thumbnailKey = `thumbnails/${session.id}/${slug}.webp`
        thumbnailUrl = await uploadToB2(thumbnailBuffer, thumbnailKey, 'image/webp')
      } catch (e) {
        console.error('Error generating thumbnail from MP4:', e)
      }
    } else if (file.type === 'video/webm') {
      // For WebM uploads, the original is already WebM
      webmUrl = url

      // Generate GIF from WebM and use it as the primary URL
      try {
        const gifBuffer = await generateGifFromMp4(buffer, slug)
        const gifKey = `gifs/${session.id}/${slug}.gif`
        url = await uploadToB2(gifBuffer, gifKey, 'image/gif')
      } catch (e) {
        console.error('Error generating GIF from WebM:', e)
      }

      // Generate MP4 from WebM
      try {
        const mp4Buffer = await generateMp4FromGif(buffer, slug)
        const mp4Key = `gifs/${session.id}/${slug}.mp4`
        mp4Url = await uploadToB2(mp4Buffer, mp4Key, 'video/mp4')
      } catch (e) {
        console.error('Error generating MP4 from WebM:', e)
      }

      // Generate thumbnail from video
      try {
        const thumbnailBuffer = await generateThumbnailFromVideo(buffer, slug)
        const thumbnailKey = `thumbnails/${session.id}/${slug}.webp`
        thumbnailUrl = await uploadToB2(thumbnailBuffer, thumbnailKey, 'image/webp')
      } catch (e) {
        console.error('Error generating thumbnail from WebM:', e)
      }
    } else if (file.type === 'image/webp') {
      // For WebP uploads, generate thumbnail and try video conversions
      try {
        thumbnailUrl = await generateAndUploadThumbnail(buffer, session.id, slug)
      } catch (e) {
        console.error('Error generating thumbnail from WebP:', e)
      }

      // Try to generate MP4 from WebP (works if animated)
      try {
        const mp4Buffer = await generateMp4FromGif(buffer, slug)
        const mp4Key = `gifs/${session.id}/${slug}.mp4`
        mp4Url = await uploadToB2(mp4Buffer, mp4Key, 'video/mp4')
      } catch (e) {
        console.error('Error generating MP4 from WebP:', e)
      }

      // Try to generate WebM from WebP
      try {
        const webmBuffer = await generateWebmFromGif(buffer, slug)
        const webmKey = `gifs/${session.id}/${slug}.webm`
        webmUrl = await uploadToB2(webmBuffer, webmKey, 'video/webm')
      } catch (e) {
        console.error('Error generating WebM from WebP:', e)
      }
    }

    // Create GIF record
    const gif = await prisma.gif.create({
      data: {
        slug,
        title,
        description: description || null,
        url,
        mp4Url,
        webmUrl,
        thumbnailUrl,
        width,
        height,
        fileSize: file.size,
        isPublic,
        isNsfw,
        userId: session.id,
      },
    })

    // Handle tags
    if (tags) {
      const tagNames = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

      for (const tagName of tagNames) {
        const tagSlug = tagName.replace(/\s+/g, '-')

        const tag = await prisma.tag.upsert({
          where: { slug: tagSlug },
          create: { name: tagName, slug: tagSlug },
          update: {},
        })

        await prisma.tagOnGif.create({
          data: {
            gifId: gif.id,
            tagId: tag.id,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      gif: {
        id: gif.id,
        slug: gif.slug,
        title: gif.title,
        url: gif.url,
      },
    })
  } catch (error) {
    console.error('Error uploading gif:', error)
    return NextResponse.json(
      { error: 'Failed to upload gif' },
      { status: 500 }
    )
  }
}
