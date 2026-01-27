import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'

interface Props {
  params: Promise<{ id: string }>
}

// DELETE - Delete API key
export async function DELETE(_request: NextRequest, { params }: Props) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const key = await prisma.apiKey.findUnique({
      where: { id },
    })

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (key.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
