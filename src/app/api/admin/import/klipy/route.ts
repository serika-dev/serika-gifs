import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import {
  importGifsBatch,
  GifToImport,
  checkExistingBySourceId,
} from '@/lib/import-utils'

interface KlipySearchResult {
  results: KlipyGif[]
  nextPage?: string
}

interface KlipyGif {
  id: string
  title?: string
  description?: string
  url?: string
  gif_url?: string
  preview?: string
  thumbnail?: string
  source_url?: string
  width?: number
  height?: number
  tags?: string[]
  media?: {
    gif?: string
    thumbnail?: string
  }
}

// Klipy API integration with pagination
async function searchKlipy(query: string, limit: number = 20, page?: string): Promise<KlipySearchResult> {
  const apiKey = process.env.KLIPY_API_KEY
  if (!apiKey) throw new Error('KLIPY_API_KEY not configured')

  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  })
  
  if (page) {
    params.set('page', page)
  }

  const response = await fetch(
    `https://api.klipy.co/v1/search?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error('Klipy API error:', response.status, errorText)
    throw new Error(`Klipy API request failed: ${response.status}`)
  }

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    console.error('Klipy JSON parse error:', text.substring(0, 500))
    throw new Error('Invalid JSON response from Klipy API')
  }
  
  return {
    results: data.results || data.data || data.gifs || [],
    nextPage: data.next_page || data.nextPage || data.pagination?.next,
  }
}

// POST /api/admin/import/klipy - Import from Klipy (concurrent)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { query, limit = 50, pos, concurrency = 5 } = await request.json()

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
      const { results, nextPage } = await searchKlipy(query, limit, pos)
      
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: { totalItems: results.length },
      })

      // Pre-check for existing GIFs to show skipped count
      const sourceIds = results.map(r => r.id)
      const existingMap = await checkExistingBySourceId('KLIPY', sourceIds)

      // Transform to common format
      const gifsToImport: GifToImport[] = results
        .filter(result => {
          const gifUrl = result.url || result.gif_url || result.media?.gif
          return gifUrl && !existingMap.has(result.id)
        })
        .map(result => ({
          sourceId: result.id,
          title: result.title || result.description || query,
          gifUrl: result.url || result.gif_url || result.media?.gif || '',
          previewUrl: result.preview || result.thumbnail || result.media?.thumbnail,
          sourceUrl: result.source_url || result.url,
          width: result.width || 0,
          height: result.height || 0,
          source: 'KLIPY' as const,
          // Use Klipy's tags if available
          sourceTags: result.tags || [],
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

      return NextResponse.json({
        success: true,
        imported,
        failed,
        skipped: skipped + skippedDuplicates,
        total: results.length,
        jobId: importJob.id,
        hasNextPage: !!nextPage,
        nextPos: nextPage || null,
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
    console.error('Klipy import error:', error)
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

// GET /api/admin/import/klipy - Search Klipy (preview)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '20')
    const pos = searchParams.get('pos') || undefined

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const { results, nextPage } = await searchKlipy(query, limit, pos)

    // Check which ones are already imported
    const sourceIds = results.map(r => r.id)
    const existingMap = await checkExistingBySourceId('KLIPY', sourceIds)

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        title: r.title || r.description,
        url: r.url || r.gif_url || r.media?.gif,
        preview: r.preview || r.thumbnail || r.media?.thumbnail,
        sourceUrl: r.source_url,
        alreadyImported: existingMap.has(r.id),
      })),
      totalCount: results.length,
      hasNextPage: !!nextPage,
      nextPos: nextPage || null,
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
