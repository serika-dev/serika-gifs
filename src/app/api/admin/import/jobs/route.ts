import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'

// GET /api/admin/import/jobs - List import jobs
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const skip = (page - 1) * limit

    const [jobs, total] = await Promise.all([
      prisma.importJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.importJob.count(),
    ])

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch import jobs' },
      { status: 500 }
    )
  }
}
