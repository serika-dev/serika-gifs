import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/dmca - Submit a DMCA takedown request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      claimantName,
      claimantEmail,
      claimantCompany,
      copyrightWork,
      infringingUrls,
      tagSlug,
      statement,
      signature,
    } = body

    // Validate required fields
    if (!claimantName || !claimantEmail || !copyrightWork || !statement || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Must have either URLs or a tag
    if ((!infringingUrls || infringingUrls.length === 0) && !tagSlug) {
      return NextResponse.json(
        { error: 'Must provide infringing URLs or a tag slug' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(claimantEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // If tagSlug provided, verify it exists
    if (tagSlug) {
      const tag = await prisma.tag.findUnique({
        where: { slug: tagSlug },
      })
      if (!tag) {
        return NextResponse.json(
          { error: 'Tag not found' },
          { status: 404 }
        )
      }
    }

    // Create the DMCA request
    const dmcaRequest = await prisma.dmcaRequest.create({
      data: {
        claimantName,
        claimantEmail,
        claimantCompany: claimantCompany || null,
        copyrightWork,
        infringingUrls: infringingUrls || [],
        tagSlug: tagSlug || null,
        statement,
        signature,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'DMCA takedown request submitted successfully. We will review it within 24-48 hours.',
      requestId: dmcaRequest.id,
    })
  } catch (error) {
    console.error('Error creating DMCA request:', error)
    return NextResponse.json(
      { error: 'Failed to submit DMCA request' },
      { status: 500 }
    )
  }
}
