import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

// GET /api/quota-requests - Get user's quota requests (or all for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const all = searchParams.get('all') === 'true'

    // Admin can see all requests
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isAdmin: true },
    })

    const where: Record<string, unknown> = {}
    
    if (!user?.isAdmin || !all) {
      where.userId = session.id
    }

    if (status) {
      where.status = status
    }

    const requests = await prisma.quotaRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, email: true, avatar: true },
        },
        apiKey: {
          select: { id: true, name: true, tier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests, isAdmin: user?.isAdmin })
  } catch (error) {
    console.error('Error fetching quota requests:', error)
    return NextResponse.json({ error: 'Failed to fetch quota requests' }, { status: 500 })
  }
}

// POST /api/quota-requests - Create a new quota request
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { apiKeyId, requestedTier, reason } = body

    if (!apiKeyId || !requestedTier || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKeyId, requestedTier, reason' },
        { status: 400 }
      )
    }

    // Validate the API key belongs to the user
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true, tier: true },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (apiKey.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if requested tier is higher than current
    const tierOrder = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_5']
    const currentIndex = tierOrder.indexOf(apiKey.tier)
    const requestedIndex = tierOrder.indexOf(requestedTier)

    if (requestedIndex <= currentIndex) {
      return NextResponse.json(
        { error: 'Requested tier must be higher than current tier' },
        { status: 400 }
      )
    }

    // Check for existing pending request
    const existingRequest = await prisma.quotaRequest.findFirst({
      where: {
        apiKeyId,
        status: 'PENDING',
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending quota request for this API key' },
        { status: 400 }
      )
    }

    const quotaRequest = await prisma.quotaRequest.create({
      data: {
        userId: session.id,
        apiKeyId,
        requestedTier,
        reason,
      },
      include: {
        apiKey: {
          select: { id: true, name: true, tier: true },
        },
      },
    })

    return NextResponse.json({ success: true, request: quotaRequest })
  } catch (error) {
    console.error('Error creating quota request:', error)
    return NextResponse.json({ error: 'Failed to create quota request' }, { status: 500 })
  }
}
