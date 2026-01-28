import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/tags - List tags
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const where: any = {
      slug: { not: 'import' }, // Hide internal import tag from users
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const tags = await prisma.tag.findMany({
      where,
      include: {
        _count: {
          select: { gifs: true },
        },
      },
      orderBy: {
        gifs: {
          _count: 'desc',
        },
      },
      take: limit,
    })

    return NextResponse.json({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        count: tag._count.gifs,
      })),
    })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}
