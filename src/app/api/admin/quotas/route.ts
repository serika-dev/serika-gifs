import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET /api/admin/quotas - Get all quota requests (admin only)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const requests = await prisma.quotaRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, email: true, avatar: true },
        },
        apiKey: {
          select: { id: true, name: true, tier: true, key: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get stats
    const stats = await prisma.quotaRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    const statsSummary = {
      pending: stats.find((s) => s.status === 'PENDING')?._count.status || 0,
      approved: stats.find((s) => s.status === 'APPROVED')?._count.status || 0,
      denied: stats.find((s) => s.status === 'DENIED')?._count.status || 0,
      total: stats.reduce((acc, s) => acc + s._count.status, 0),
    }

    return NextResponse.json({ requests, stats: statsSummary })
  } catch (error) {
    console.error('Error fetching quota requests:', error)
    return NextResponse.json({ error: 'Failed to fetch quota requests' }, { status: 500 })
  }
}
