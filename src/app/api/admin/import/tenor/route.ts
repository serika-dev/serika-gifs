import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { nanoid } from 'nanoid'

// Tenor API integration
async function searchTenor(query: string, limit: number = 20) {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) throw new Error('TENOR_API_KEY not configured')

  const response = await fetch(
    `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${limit}&media_filter=gif`
  )

  if (!response.ok) {
    throw new Error('Tenor API request failed')
  }

  const data = await response.json()
  return data.results
}

// POST /api/admin/import/tenor - Import from Tenor
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { query, limit = 20 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    // Create import job
    const importJob = await prisma.importJob.create({
      data: {
        source: 'TENOR',
        query,
        status: 'PROCESSING',
      },
    })

    try {
      const results = await searchTenor(query, limit)
      
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: { totalItems: results.length },
      })

      let imported = 0
      let failed = 0

      for (const result of results) {
        try {
          // Check if already imported
          const existing = await prisma.gif.findFirst({
            where: {
              source: 'TENOR',
              sourceId: result.id,
            },
          })

          if (existing) {
            continue
          }

          const gifUrl = result.media_formats?.gif?.url || result.media_formats?.mediumgif?.url
          const previewUrl = result.media_formats?.tinygif?.url

          if (!gifUrl) {
            failed++
            continue
          }

          // Download and re-upload to B2
          const gifResponse = await fetch(gifUrl)
          const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
          
          const slug = nanoid(10)
          const key = `gifs/imports/tenor/${slug}.gif`
          const url = await uploadToB2(gifBuffer, key, 'image/gif')

          let thumbnailUrl = null
          if (previewUrl) {
            const thumbResponse = await fetch(previewUrl)
            const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
            const thumbKey = `gifs/imports/tenor/${slug}_thumb.gif`
            thumbnailUrl = await uploadToB2(thumbBuffer, thumbKey, 'image/gif')
          }

          const dimensions = result.media_formats?.gif?.dims || [0, 0]

          await prisma.gif.create({
            data: {
              slug,
              title: result.content_description || query,
              url,
              thumbnailUrl,
              width: dimensions[0] || 0,
              height: dimensions[1] || 0,
              fileSize: gifBuffer.length,
              source: 'TENOR',
              sourceId: result.id,
              sourceUrl: result.url,
              userId: admin.id,
            },
          })

          imported++
        } catch (e) {
          console.error('Error importing Tenor gif:', e)
          failed++
        }
      }

      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'COMPLETED',
          importedItems: imported,
          failedItems: failed,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        imported,
        failed,
        total: results.length,
        jobId: importJob.id,
      })
    } catch (error: any) {
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'FAILED',
          error: error.message,
        },
      })
      throw error
    }
  } catch (error: any) {
    console.error('Tenor import error:', error)
    
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}

// GET /api/admin/import/tenor - Search Tenor (preview)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const results = await searchTenor(query, limit)

    return NextResponse.json({
      results: results.map((r: any) => ({
        id: r.id,
        title: r.content_description,
        url: r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url,
        preview: r.media_formats?.tinygif?.url,
        sourceUrl: r.url,
      })),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    )
  }
}
