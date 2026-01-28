import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { generateAndUploadThumbnail } from '@/lib/thumbnail'
import { nanoid } from 'nanoid'
import imageSize from 'image-size'

// GET /api/gifs - List GIFs
export async function GET(request: NextRequest) {
  try {
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
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
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
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' }
    }

    // Source filtering removed - all GIFs treated equally

    const [gifs, total] = await Promise.all([
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

    const formattedGifs = gifs.map((gif: typeof gifs[number]) => ({
      id: gif.id,
      slug: gif.slug,
      title: gif.title,
      description: gif.description,
      url: gif.url,
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

    return NextResponse.json({
      gifs: formattedGifs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
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

    // Get image dimensions
    let width = 0
    let height = 0
    try {
      const dimensions = imageSize(buffer)
      width = dimensions.width || 0
      height = dimensions.height || 0
    } catch (e) {
      console.error('Error getting image dimensions:', e)
    }

    // Upload to B2
    const url = await uploadToB2(buffer, key, file.type)

    // Generate static thumbnail for GIFs
    let thumbnailUrl: string | null = null
    if (file.type === 'image/gif') {
      try {
        thumbnailUrl = await generateAndUploadThumbnail(buffer, session.id, slug)
      } catch (e) {
        console.error('Error generating thumbnail:', e)
        // Continue without thumbnail
      }
    }

    // Create GIF record
    const gif = await prisma.gif.create({
      data: {
        slug,
        title,
        description: description || null,
        url,
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
