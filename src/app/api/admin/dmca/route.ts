import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { DmcaStatus } from '@prisma/client'

// GET /api/admin/dmca - List all DMCA requests
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as DmcaStatus | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where = status ? { status } : {}

    const [dmcaRequests, total] = await Promise.all([
      prisma.dmcaRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dmcaRequest.count({ where }),
    ])

    return NextResponse.json({
      dmcaRequests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching DMCA requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DMCA requests' },
      { status: 500 }
    )
  }
}
