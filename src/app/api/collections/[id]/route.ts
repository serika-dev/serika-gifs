import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET /api/collections/[id] - Get collection details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    const collection = await prisma.collection.findUnique({
      where: { id },
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
            gif: {
              include: {
                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Check access
    if (!collection.isPublic && (!session || session.id !== collection.userId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        isPublic: collection.isPublic,
        user: collection.user,
        gifs: collection.gifs.map((g: typeof collection.gifs[number]) => ({
          id: g.gif.id,
          slug: g.gif.slug,
          title: g.gif.title,
          url: g.gif.url,
          thumbnailUrl: g.gif.thumbnailUrl,
          tags: g.gif.tags.map((t: { tag: { name: string } }) => t.tag.name),
          addedAt: g.addedAt,
        })),
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching collection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}

// PATCH /api/collections/[id] - Update collection
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const collection = await prisma.collection.findUnique({
      where: { id },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    if (collection.userId !== session.id && !session.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (body.name !== undefined) {
      updateData.name = body.name
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    }
    if (body.description !== undefined) updateData.description = body.description
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

    const updated = await prisma.collection.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      collection: updated,
    })
  } catch (error) {
    console.error('Error updating collection:', error)
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    )
  }
}

// DELETE /api/collections/[id] - Delete collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    const collection = await prisma.collection.findUnique({
      where: { id },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    if (collection.userId !== session.id && !session.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    await prisma.collection.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    )
  }
}
