import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { generateAndUploadThumbnail } from '@/lib/thumbnail'
import { generateMp4FromGif, generateWebmFromGif, generateWebmFromMp4, generateGifFromMp4, getVideoDimensions, generateThumbnailFromVideo } from '@/lib/media-convert'
import { nanoid } from 'nanoid'
import imageSize from 'image-size'
import { checkRateLimit, rateLimitResponse, addRateLimitHeaders } from '@/lib/rate-limit'

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
    const search = searchParams.get('search') || ''
    const tag = searchParams.get('tag') || ''
    const userId = searchParams.get('userId') || ''
    const source = searchParams.get('source') || ''
    const sort = searchParams.get('sort') || 'newest'
    const timeRange = searchParams.get('timeRange') || 'all'

    const skip = (page - 1) * limit

    const where: any = {
      isPublic: true,
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

    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean)
      if (searchTerms.length > 0) {
        where.AND = searchTerms.map((term) => ({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            {
              tags: {
                some: {
                  tag: {
                    name: { contains: term, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        }))
      }
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

    // Determine sort order
    let orderBy: any
    switch (sort) {
      case 'trending':
        // Trending = combination of recent views and favorites
        // For now, use views as proxy, weighted by recency
        orderBy = [{ views: 'desc' }, { createdAt: 'desc' }]
        break
      case 'popular':
        // Most favorited
        orderBy = { favorites: { _count: 'desc' } }
        break
      case 'most-viewed':
        orderBy = { views: 'desc' }
        break
      case 'random':
        // Will be handled separately
        orderBy = undefined
        break
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      default:
        // Default to trending (popular)
        orderBy = [{ views: 'desc' }, { createdAt: 'desc' }]
    }

    // Source filtering removed - all GIFs treated equally

    let gifs
    let total

    if (sort === 'random') {
      total = await prisma.gif.count({ where })
      const randomSkip = Math.floor(Math.random() * Math.max(0, total - limit))

      gifs = await prisma.gif.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              favorites: true,
            },
          },
        },
        skip: randomSkip,
        take: limit,
      })
    } else {
      const result = await Promise.all([
        prisma.gif.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: {
                favorites: true,
              },
            },
          },
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
            include: {
              user: {
                select: { id: true, username: true, avatar: true },
              },
              tags: {
                include: { tag: true },
              },
              _count: {
                select: { favorites: true },
              },
            },
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
      views: gif.views,
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

    // Upload to B2
    const url = await uploadToB2(buffer, key, file.type)

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

      // Generate GIF from MP4
      try {
        const gifBuffer = await generateGifFromMp4(buffer, slug)
        const gifKey = `gifs/${session.id}/${slug}.gif`
        await uploadToB2(gifBuffer, gifKey, 'image/gif')
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

      // Generate thumbnail from video
      try {
        const thumbnailBuffer = await generateThumbnailFromVideo(buffer, slug)
        const thumbnailKey = `thumbnails/${session.id}/${slug}.webp`
        thumbnailUrl = await uploadToB2(thumbnailBuffer, thumbnailKey, 'image/webp')
      } catch (e) {
        console.error('Error generating thumbnail from WebM:', e)
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
