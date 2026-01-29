import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { DmcaStatus } from '@prisma/client'

// GET /api/admin/dmca/[id] - Get a specific DMCA request
export async function GET(
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

    return NextResponse.json(dmcaRequest)
  } catch (error) {
    console.error('Error fetching DMCA request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DMCA request' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/dmca/[id] - Update a DMCA request status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, adminNote } = body

    if (status && !Object.values(DmcaStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const dmcaRequest = await prisma.dmcaRequest.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(adminNote !== undefined && { adminNote }),
        ...(status === 'COMPLETED' && { processedAt: new Date() }),
      },
    })

    return NextResponse.json(dmcaRequest)
  } catch (error) {
    console.error('Error updating DMCA request:', error)
    return NextResponse.json(
      { error: 'Failed to update DMCA request' },
      { status: 500 }
    )
  }
}
