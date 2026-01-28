import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { deleteFromB2 } from '@/lib/storage'

// GET /api/gifs/[slug] - Get a single GIF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const gif = await prisma.gif.findUnique({
      where: { slug },
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
    })

    if (!gif) {
      return NextResponse.json(
        { error: 'GIF not found' },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.gif.update({
      where: { id: gif.id },
      data: { views: { increment: 1 } },
    })

    return NextResponse.json({
      gif: {
        id: gif.id,
        slug: gif.slug,
        title: gif.title,
        description: gif.description,
        url: gif.url,
        mp4Url: gif.mp4Url,
        webmUrl: gif.webmUrl,
        thumbnailUrl: gif.thumbnailUrl,
        width: gif.width,
        height: gif.height,
        fileSize: gif.fileSize,
        duration: gif.duration,
        source: gif.source,
        sourceUrl: gif.sourceUrl,
        views: gif.views + 1,
        favorites: gif._count.favorites,
        tags: gif.tags.map((t: { tag: { name: string } }) => t.tag.name),
        user: gif.user,
        createdAt: gif.createdAt,
      },
    })
  } catch (error) {
    console.error('Error fetching gif:', error)
    return NextResponse.json(
      { error: 'Failed to fetch gif' },
      { status: 500 }
    )
  }
}

// PATCH /api/gifs/[slug] - Update a GIF
export async function PATCH(
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
    const body = await request.json()

    const gif = await prisma.gif.findUnique({
      where: { slug },
    })

    if (!gif) {
      return NextResponse.json(
        { error: 'GIF not found' },
        { status: 404 }
      )
    }

    // Check ownership or admin
    if (gif.userId !== session.id && !session.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

    const updatedGif = await prisma.gif.update({
      where: { id: gif.id },
      data: updateData,
    })

    // Handle tags if provided
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      // Remove existing tags
      await prisma.tagOnGif.deleteMany({
        where: { gifId: gif.id },
      })

      // Add new tags
      for (const tagName of body.tags) {
        const normalizedTag = tagName.trim().toLowerCase()
        if (!normalizedTag) continue
        
        const tagSlug = normalizedTag.replace(/\s+/g, '-')
        
        const tag = await prisma.tag.upsert({
          where: { slug: tagSlug },
          create: { name: tagName.trim(), slug: tagSlug },
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
      gif: updatedGif,
    })
  } catch (error) {
    console.error('Error updating gif:', error)
    return NextResponse.json(
      { error: 'Failed to update gif' },
      { status: 500 }
    )
  }
}

// DELETE /api/gifs/[slug] - Delete a GIF
export async function DELETE(
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

    // Check ownership or admin
    if (gif.userId !== session.id && !session.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Extract key from URL for B2 deletion
    const urlParts = new URL(gif.url)
    const key = urlParts.pathname.slice(1) // Remove leading slash

    // Delete from B2
    try {
      await deleteFromB2(key)
    } catch (e) {
      console.error('Error deleting from B2:', e)
      // Continue with database deletion even if B2 deletion fails
    }

    // Delete from database (cascades to tags and favorites)
    await prisma.gif.delete({
      where: { id: gif.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting gif:', error)
    return NextResponse.json(
      { error: 'Failed to delete gif' },
      { status: 500 }
    )
  }
}
