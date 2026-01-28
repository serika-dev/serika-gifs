import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import {
  importGifsBatch,
  GifToImport,
  checkExistingBySourceId,
} from '@/lib/import-utils'

interface GiphySearchResult {
  results: GiphyGif[]
  totalCount: number
  offset: number
}

interface GiphyGif {
  id: string
  title: string
  url: string
  images: {
    original?: { url: string; width: string; height: string; size: string }
    fixed_height_small?: { url: string }
  }
}

// Giphy API integration with pagination
async function searchGiphy(query: string, limit: number = 20, offset: number = 0): Promise<GiphySearchResult> {
  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) throw new Error('GIPHY_API_KEY not configured')

  const response = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g`
  )

  if (!response.ok) {
    throw new Error('Giphy API request failed')
  }

  const data = await response.json()
  return {
    results: data.data || [],
    totalCount: data.pagination?.total_count || 0,
    offset: data.pagination?.offset || 0,
  }
}

// POST /api/admin/import/giphy - Import from Giphy (concurrent)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { query, limit = 50, offset = 0, concurrency = 5 } = await request.json()

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
      const { results, totalCount } = await searchGiphy(query, limit, offset)
      
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: { totalItems: results.length },
      })

      // Pre-check for existing GIFs to show skipped count
      const sourceIds = results.map(r => r.id)
      const existingMap = await checkExistingBySourceId('GIPHY', sourceIds)

      // Transform to common format
      const gifsToImport: GifToImport[] = results
        .filter(result => {
          const gifUrl = result.images?.original?.url
          return gifUrl && !existingMap.has(result.id)
        })
        .map(result => ({
          sourceId: result.id,
          title: result.title || query,
          gifUrl: result.images!.original!.url,
          previewUrl: result.images?.fixed_height_small?.url,
          sourceUrl: result.url,
          width: parseInt(result.images?.original?.width || '0'),
          height: parseInt(result.images?.original?.height || '0'),
          fileSize: parseInt(result.images?.original?.size || '0'),
          source: 'GIPHY' as const,
        }))

      const skippedDuplicates = results.length - gifsToImport.length

      // Import concurrently
      const { imported, failed, skipped } = await importGifsBatch(
        gifsToImport,
        {
          userId: admin.id,
          query,
          concurrency: Math.min(concurrency, 10), // Max 10 concurrent
          skipDuplicates: true,
        }
      )

      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'COMPLETED',
          importedItems: imported,
          failedItems: failed,
          completedAt: new Date(),
        },
      })

      const nextOffset = offset + limit
      const hasNextPage = nextOffset < totalCount

      return NextResponse.json({
        success: true,
        imported,
        failed,
        skipped: skipped + skippedDuplicates,
        total: results.length,
        jobId: importJob.id,
        hasNextPage,
        nextPos: hasNextPage ? nextOffset.toString() : null,
        totalCount,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      })
      throw error
    }
  } catch (error: unknown) {
    console.error('Giphy import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Import failed'
    
    if (errorMessage === 'Unauthorized' || errorMessage === 'Admin access required') {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
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
    const pos = searchParams.get('pos')
    const offset = pos ? parseInt(pos) : 0

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const { results, totalCount } = await searchGiphy(query, limit, offset)

    // Check which ones are already imported
    const sourceIds = results.map(r => r.id)
    const existingMap = await checkExistingBySourceId('GIPHY', sourceIds)

    const nextOffset = offset + limit
    const hasNextPage = nextOffset < totalCount

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.images?.original?.url,
        preview: r.images?.fixed_height_small?.url,
        sourceUrl: r.url,
        alreadyImported: existingMap.has(r.id),
      })),
      totalCount,
      hasNextPage,
      nextPos: hasNextPage ? nextOffset.toString() : null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Search failed'
    
    if (errorMessage === 'Unauthorized' || errorMessage === 'Admin access required') {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
