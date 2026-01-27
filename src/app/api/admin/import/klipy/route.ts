import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { nanoid } from 'nanoid'

// Klipy API integration
async function searchKlipy(query: string, limit: number = 20) {
  const apiKey = process.env.KLIPY_API_KEY
  if (!apiKey) throw new Error('KLIPY_API_KEY not configured')

  const response = await fetch(
    `https://api.klipy.co/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error('Klipy API request failed')
  }

  const data = await response.json()
  return data.results || data.data || []
}

// POST /api/admin/import/klipy - Import from Klipy
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
        source: 'KLIPY',
        query,
        status: 'PROCESSING',
      },
    })

    try {
      const results = await searchKlipy(query, limit)
      
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
              source: 'KLIPY',
              sourceId: result.id,
            },
          })

          if (existing) {
            continue
          }

          const gifUrl = result.url || result.gif_url || result.media?.gif
          const previewUrl = result.preview || result.thumbnail || result.media?.thumbnail

          if (!gifUrl) {
            failed++
            continue
          }

          // Download and re-upload to B2
          const gifResponse = await fetch(gifUrl)
          const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
          
          const slug = nanoid(10)
          const key = `gifs/imports/klipy/${slug}.gif`
          const url = await uploadToB2(gifBuffer, key, 'image/gif')

          let thumbnailUrl = null
          if (previewUrl) {
            const thumbResponse = await fetch(previewUrl)
            const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
            const thumbKey = `gifs/imports/klipy/${slug}_thumb.gif`
            thumbnailUrl = await uploadToB2(thumbBuffer, thumbKey, 'image/gif')
          }

          await prisma.gif.create({
            data: {
              slug,
              title: result.title || result.description || query,
              url,
              thumbnailUrl,
              width: result.width || 0,
              height: result.height || 0,
              fileSize: gifBuffer.length,
              source: 'KLIPY',
              sourceId: result.id,
              sourceUrl: result.source_url || result.url,
              userId: admin.id,
            },
          })

          imported++
        } catch (e) {
          console.error('Error importing Klipy gif:', e)
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
    console.error('Klipy import error:', error)
    
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

// GET /api/admin/import/klipy - Search Klipy (preview)
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

    const results = await searchKlipy(query, limit)

    return NextResponse.json({
      results: results.map((r: any) => ({
        id: r.id,
        title: r.title || r.description,
        url: r.url || r.gif_url || r.media?.gif,
        preview: r.preview || r.thumbnail || r.media?.thumbnail,
        sourceUrl: r.source_url,
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
