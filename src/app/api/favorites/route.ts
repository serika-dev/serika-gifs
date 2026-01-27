import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'

// GET - Get user's favorites
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.id },
      include: {
        gif: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            tags: true,
            _count: {
              select: { favorites: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const gifs = favorites.map((fav) => ({
      id: fav.gif.id,
      slug: fav.gif.slug,
      title: fav.gif.title,
      description: fav.gif.description,
      url: fav.gif.url,
      thumbnailUrl: fav.gif.thumbnailUrl,
      width: fav.gif.width,
      height: fav.gif.height,
      size: fav.gif.size,
      views: fav.gif.views,
      source: fav.gif.source,
      createdAt: fav.gif.createdAt.toISOString(),
      user: fav.gif.user,
      tags: fav.gif.tags,
      _count: fav.gif._count,
    }))

    return NextResponse.json({ favorites: gifs })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add to favorites
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gifId } = await request.json()

    if (!gifId) {
      return NextResponse.json({ error: 'GIF ID is required' }, { status: 400 })
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_gifId: {
          userId: session.id,
          gifId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Already favorited' }, { status: 400 })
    }

    await prisma.favorite.create({
      data: {
        userId: session.id,
        gifId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding favorite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove from favorites
export async function DELETE(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gifId = searchParams.get('gifId')

    if (!gifId) {
      return NextResponse.json({ error: 'GIF ID is required' }, { status: 400 })
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: session.id,
        gifId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
