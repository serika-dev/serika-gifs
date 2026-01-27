import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// POST /api/gifs/[slug]/favorite - Toggle favorite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { slug } = await params

    const gif = await prisma.gif.findUnique({
      where: { slug },
    })

    if (!gif) {
      return NextResponse.json(
        { error: 'GIF not found' },
        { status: 404 }
      )
    }

    // Check if already favorited
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_gifId: {
          userId: session.id,
          gifId: gif.id,
        },
      },
    })

    if (existingFavorite) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          userId_gifId: {
            userId: session.id,
            gifId: gif.id,
          },
        },
      })

      return NextResponse.json({
        favorited: false,
      })
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: {
          userId: session.id,
          gifId: gif.id,
        },
      })

      return NextResponse.json({
        favorited: true,
      })
    }
  } catch (error) {
    console.error('Error toggling favorite:', error)
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    )
  }
}

// GET /api/gifs/[slug]/favorite - Check if favorited
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ favorited: false })
    }

    const { slug } = await params

    const gif = await prisma.gif.findUnique({
      where: { slug },
    })

    if (!gif) {
      return NextResponse.json(
        { error: 'GIF not found' },
        { status: 404 }
      )
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_gifId: {
          userId: session.id,
          gifId: gif.id,
        },
      },
    })

    return NextResponse.json({
      favorited: !!favorite,
    })
  } catch (error) {
    console.error('Error checking favorite:', error)
    return NextResponse.json(
      { error: 'Failed to check favorite' },
      { status: 500 }
    )
  }
}
