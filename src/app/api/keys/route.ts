import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { ApiKeyTier } from '@prisma/client'

// GET - Get user's API keys
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.id },
      select: {
        id: true,
        name: true,
        key: true,
        tier: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Check if user is admin (admin keys are always effectively TIER_3)
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isAdmin: true },
    })

    const keysWithEffectiveTier = keys.map(key => ({
      ...key,
      effectiveTier: user?.isAdmin ? ApiKeyTier.TIER_3 : key.tier,
    }))

    return NextResponse.json({ keys: keysWithEffectiveTier, isAdmin: user?.isAdmin })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new API key
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await request.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate a secure API key
    const key = `sgif_${nanoid(32)}`

    // New keys always start at TIER_1 (default in schema)
    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        key,
        userId: session.id,
        tier: ApiKeyTier.TIER_1,
      },
    })

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { isAdmin: true },
    })

    return NextResponse.json({
      success: true,
      key: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        tier: apiKey.tier,
        effectiveTier: user?.isAdmin ? ApiKeyTier.TIER_3 : apiKey.tier,
        createdAt: apiKey.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
