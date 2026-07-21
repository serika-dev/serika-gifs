import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import {
  importGifsBatch,
  GifToImport,
  checkExistingBySourceId,
} from '@/lib/import-utils'

interface NormalizedKlipyGif {
  id: string
  title?: string
  gifUrl?: string
  mp4Url?: string
  webmUrl?: string
  previewUrl?: string
  sourceUrl?: string
  width?: number
  height?: number
  tags?: string[]
}

interface KlipySearchResult {
  results: NormalizedKlipyGif[]
  nextPage?: string
}

/**
 * Klipy's real API places the API key in the URL path (NOT a header/query param):
 *   https://api.klipy.com/api/v1/{API_KEY}/gifs/{search|trending}?q=...&per_page=...&page=...
 * Response shape:
 *   { result: true, data: { data: [{ id, slug, title, file: { hd: { gif: {url,width,height}, mp4 }, sm, xs } }], current_page, per_page } }
 */
function normalizeKlipyItem(gif: any): NormalizedKlipyGif {
  const file = gif.file || {}
  const hd = file.hd || {}
  const md = file.md || {}
  const sm = file.sm || {}
  const xs = file.xs || {}

  const hdGif = hd.gif || md.gif || sm.gif || {}
  const previewGif = sm.gif || xs.gif || hdGif

  return {
    id: (gif.id ?? gif.slug ?? '').toString(),
    title: gif.title || gif.slug || undefined,
    gifUrl: hdGif.url || '',
    mp4Url: hd.mp4?.url || md.mp4?.url || sm.mp4?.url || undefined,
    // Klipy provides WebM on every rendition (hd/md/sm/xs) — prefer highest quality.
    webmUrl: hd.webm?.url || md.webm?.url || sm.webm?.url || xs.webm?.url || undefined,
    previewUrl: previewGif.url || undefined,
    sourceUrl: gif.url || gif.source || undefined,
    width: hdGif.width || 0,
    height: hdGif.height || 0,
    tags: Array.isArray(gif.tags)
      ? gif.tags.map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : [],
  }
}

// Klipy API integration with pagination
async function searchKlipy(query: string, limit: number = 20, page?: string): Promise<KlipySearchResult> {
  const apiKey = process.env.KLIPY_API_KEY
  if (!apiKey) throw new Error('KLIPY_API_KEY not configured')

  const pageNum = page ? parseInt(page, 10) || 1 : 1
  const params = new URLSearchParams({
    q: query,
    per_page: limit.toString(),
    page: pageNum.toString(),
  })

  const response = await fetch(
    `https://api.klipy.com/api/v1/${apiKey}/gifs/search?${params}`,
    {
      headers: {
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
  } catch {
    console.error('Klipy JSON parse error:', text.substring(0, 500))
    throw new Error('Invalid JSON response from Klipy API')
  }

  const items: any[] = data?.data?.data || data?.data || data?.results || []
  const results = (Array.isArray(items) ? items : [])
    .map(normalizeKlipyItem)
    .filter((g) => g.gifUrl)

  // Klipy paginates by page number; assume more pages exist while it returns a full page.
  const hasMore = results.length >= limit
  return {
    results,
    nextPage: hasMore ? (pageNum + 1).toString() : undefined,
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
        .filter(result => result.gifUrl && !existingMap.has(result.id))
        .map(result => ({
          sourceId: result.id,
          title: result.title || query,
          gifUrl: result.gifUrl || '',
          mp4Url: result.mp4Url,
          webmUrl: result.webmUrl,
          previewUrl: result.previewUrl,
          sourceUrl: result.sourceUrl,
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
        title: r.title,
        url: r.gifUrl,
        preview: r.previewUrl || r.gifUrl,
        sourceUrl: r.sourceUrl,
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
