import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET /api/collections/[id]/gifs/check - Check if a GIF is in the collection
export async function GET(
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
    const { searchParams } = new URL(request.url)
    const gifId = searchParams.get('gifId')

    if (!gifId) {
      return NextResponse.json(
        { error: 'gifId is required' },
        { status: 400 }
      )
    }

    const collection = await prisma.collection.findUnique({
      where: { id },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Only owner can check their collection
    if (collection.userId !== session.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const exists = await prisma.gifOnCollection.findUnique({
      where: {
        gifId_collectionId: {
          gifId,
          collectionId: id,
        },
      },
    })

    return NextResponse.json({ exists: !!exists })
  } catch (error) {
    console.error('Error checking gif in collection:', error)
    return NextResponse.json(
      { error: 'Failed to check gif' },
      { status: 500 }
    )
  }
}
