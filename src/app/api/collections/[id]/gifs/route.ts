import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// POST /api/collections/[id]/gifs - Add GIF to collection
export async function POST(
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
    const { gifId } = await request.json()

    const collection = await prisma.collection.findUnique({
      where: { id },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    if (collection.userId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const gif = await prisma.gif.findUnique({
      where: { id: gifId },
    })

    if (!gif) {
      return NextResponse.json(
        { error: 'GIF not found' },
        { status: 404 }
      )
    }

    // Check if already in collection
    const existing = await prisma.gifOnCollection.findUnique({
      where: {
        gifId_collectionId: {
          gifId,
          collectionId: id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'GIF already in collection' },
        { status: 400 }
      )
    }

    await prisma.gifOnCollection.create({
      data: {
        gifId,
        collectionId: id,
      },
    })

    // Update collection timestamp
    await prisma.collection.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding gif to collection:', error)
    return NextResponse.json(
      { error: 'Failed to add gif to collection' },
      { status: 500 }
    )
  }
}

// DELETE /api/collections/[id]/gifs - Remove GIF from collection
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
    const { gifId } = await request.json()

    const collection = await prisma.collection.findUnique({
      where: { id },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    if (collection.userId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    await prisma.gifOnCollection.delete({
      where: {
        gifId_collectionId: {
          gifId,
          collectionId: id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing gif from collection:', error)
    return NextResponse.json(
      { error: 'Failed to remove gif from collection' },
      { status: 500 }
    )
  }
}
