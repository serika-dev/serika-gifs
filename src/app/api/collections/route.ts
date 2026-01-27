import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET /api/collections - List collections
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const skip = (page - 1) * limit

    const where: any = {}

    if (userId) {
      where.userId = userId
      // If viewing own collections, show all. Otherwise only public
      if (!session || session.id !== userId) {
        where.isPublic = true
      }
    } else {
      where.isPublic = true
    }

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          gifs: {
            include: {
              gif: true,
            },
            take: 4,
            orderBy: { addedAt: 'desc' },
          },
          _count: {
            select: { gifs: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.collection.count({ where }),
    ])

    return NextResponse.json({
      collections: collections.map((col: typeof collections[number]) => ({
        id: col.id,
        name: col.name,
        slug: col.slug,
        description: col.description,
        isPublic: col.isPublic,
        user: col.user,
        gifCount: col._count.gifs,
        previewGifs: col.gifs.map((g: typeof col.gifs[number]) => ({
          url: g.gif.url,
          thumbnailUrl: g.gif.thumbnailUrl,
        })),
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

// POST /api/collections - Create a collection
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, description, isPublic = true } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check for duplicate slug for this user
    const existing = await prisma.collection.findUnique({
      where: {
        userId_slug: {
          userId: session.id,
          slug,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A collection with this name already exists' },
        { status: 400 }
      )
    }

    const collection = await prisma.collection.create({
      data: {
        name,
        slug,
        description,
        isPublic,
        userId: session.id,
      },
    })

    return NextResponse.json({
      success: true,
      collection,
    })
  } catch (error) {
    console.error('Error creating collection:', error)
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    )
  }
}
