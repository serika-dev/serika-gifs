import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// POST /api/admin/dmca/[id]/process - Execute DMCA takedown
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const dmcaRequest = await prisma.dmcaRequest.findUnique({
      where: { id },
    })

    if (!dmcaRequest) {
      return NextResponse.json({ error: 'DMCA request not found' }, { status: 404 })
    }

    if (dmcaRequest.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 })
    }

    let removedCount = 0

    // Update status to PROCESSING
    await prisma.dmcaRequest.update({
      where: { id },
      data: { status: 'PROCESSING' },
    })

    try {
      // Handle tag-based takedown
      if (dmcaRequest.tagSlug) {
        const tag = await prisma.tag.findUnique({
          where: { slug: dmcaRequest.tagSlug },
          include: {
            gifs: {
              include: { gif: true },
            },
          },
        })

        if (tag) {
          const gifIds = tag.gifs.map((gt) => gt.gifId)
          
          // Delete all GIF-tag relations first
          await prisma.tagOnGif.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete all favorites
          await prisma.favorite.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete all collection items
          await prisma.gifOnCollection.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete the GIFs
          const deleteResult = await prisma.gif.deleteMany({
            where: { id: { in: gifIds } },
          })

          removedCount = deleteResult.count
        }
      }

      // Handle URL-based takedown
      if (dmcaRequest.infringingUrls.length > 0) {
        // Extract slugs from URLs
        const slugs: string[] = []
        for (const url of dmcaRequest.infringingUrls) {
          // Try to extract slug from URL patterns like /gif/[slug] or just the slug
          const match = url.match(/\/gif\/([^/\s?]+)/) || url.match(/^([a-z0-9-]+)$/i)
          if (match) {
            slugs.push(match[1])
          }
        }

        if (slugs.length > 0) {
          const gifs = await prisma.gif.findMany({
            where: { slug: { in: slugs } },
          })

          const gifIds = gifs.map((g) => g.id)

          // Delete all GIF-tag relations first
          await prisma.tagOnGif.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete all favorites
          await prisma.favorite.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete all collection items
          await prisma.gifOnCollection.deleteMany({
            where: { gifId: { in: gifIds } },
          })

          // Delete the GIFs
          const deleteResult = await prisma.gif.deleteMany({
            where: { id: { in: gifIds } },
          })

          removedCount += deleteResult.count
        }
      }

      // Mark as completed
      await prisma.dmcaRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          removedCount,
        },
      })

      return NextResponse.json({
        success: true,
        removedCount,
        message: `Successfully removed ${removedCount} item(s)`,
      })
    } catch (error) {
      // If processing fails, revert to PENDING
      await prisma.dmcaRequest.update({
        where: { id },
        data: { status: 'PENDING' },
      })
      throw error
    }
  } catch (error) {
    console.error('Error processing DMCA request:', error)
    return NextResponse.json(
      { error: 'Failed to process DMCA request' },
      { status: 500 }
    )
  }
}
