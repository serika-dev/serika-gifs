import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// PATCH /api/admin/quotas/[id] - Approve or deny a quota request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, adminNote } = body

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "deny"' },
        { status: 400 }
      )
    }

    const quotaRequest = await prisma.quotaRequest.findUnique({
      where: { id },
      include: { apiKey: true },
    })

    if (!quotaRequest) {
      return NextResponse.json({ error: 'Quota request not found' }, { status: 404 })
    }

    if (quotaRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Update both the quota request and the API key tier
      await prisma.$transaction([
        prisma.quotaRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminNote,
            resolvedAt: new Date(),
          },
        }),
        prisma.apiKey.update({
          where: { id: quotaRequest.apiKeyId },
          data: { tier: quotaRequest.requestedTier },
        }),
      ])
    } else {
      // Just update the quota request status
      await prisma.quotaRequest.update({
        where: { id },
        data: {
          status: 'DENIED',
          adminNote,
          resolvedAt: new Date(),
        },
      })
    }

    const updatedRequest = await prisma.quotaRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true, avatar: true },
        },
        apiKey: {
          select: { id: true, name: true, tier: true },
        },
      },
    })

    return NextResponse.json({ success: true, request: updatedRequest })
  } catch (error) {
    console.error('Error processing quota request:', error)
    return NextResponse.json({ error: 'Failed to process quota request' }, { status: 500 })
  }
}
