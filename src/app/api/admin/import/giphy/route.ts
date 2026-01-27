import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { nanoid } from 'nanoid'

// Giphy API integration
async function searchGiphy(query: string, limit: number = 20, offset: number = 0) {
  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) throw new Error('GIPHY_API_KEY not configured')

  const response = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g`
  )

  if (!response.ok) {
    throw new Error('Giphy API request failed')
  }

  const data = await response.json()
  return data.data
}

// POST /api/admin/import/giphy - Import from Giphy
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
        source: 'GIPHY',
        query,
        status: 'PROCESSING',
      },
    })

    try {
      const results = await searchGiphy(query, limit)
      
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
              source: 'GIPHY',
              sourceId: result.id,
            },
          })

          if (existing) {
            continue
          }

          const gifUrl = result.images?.original?.url
          const previewUrl = result.images?.fixed_height_small?.url

          if (!gifUrl) {
            failed++
            continue
          }

          // Download and re-upload to B2
          const gifResponse = await fetch(gifUrl)
          const gifBuffer = Buffer.from(await gifResponse.arrayBuffer())
          
          const slug = nanoid(10)
          const key = `gifs/imports/giphy/${slug}.gif`
          const url = await uploadToB2(gifBuffer, key, 'image/gif')

          let thumbnailUrl = null
          if (previewUrl) {
            const thumbResponse = await fetch(previewUrl)
            const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer())
            const thumbKey = `gifs/imports/giphy/${slug}_thumb.gif`
            thumbnailUrl = await uploadToB2(thumbBuffer, thumbKey, 'image/gif')
          }

          await prisma.gif.create({
            data: {
              slug,
              title: result.title || query,
              url,
              thumbnailUrl,
              width: parseInt(result.images?.original?.width) || 0,
              height: parseInt(result.images?.original?.height) || 0,
              fileSize: parseInt(result.images?.original?.size) || gifBuffer.length,
              source: 'GIPHY',
              sourceId: result.id,
              sourceUrl: result.url,
              userId: admin.id,
            },
          })

          imported++
        } catch (e) {
          console.error('Error importing Giphy gif:', e)
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
    console.error('Giphy import error:', error)
    
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

// GET /api/admin/import/giphy - Search Giphy (preview)
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

    const results = await searchGiphy(query, limit)

    return NextResponse.json({
      results: results.map((r: any) => ({
        id: r.id,
        title: r.title,
        url: r.images?.original?.url,
        preview: r.images?.fixed_height_small?.url,
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
