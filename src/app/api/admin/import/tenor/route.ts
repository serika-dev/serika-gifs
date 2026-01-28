import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import {
  importGifsBatch,
  GifToImport,
  checkExistingBySourceId,
} from '@/lib/import-utils'

interface TenorSearchResult {
  results: TenorGif[]
  next: string
}

interface TenorGif {
  id: string
  title?: string
  content_description: string
  url: string
  tags?: string[]
  media_formats: {
    gif?: { url: string; dims: number[] }
    mediumgif?: { url: string }
    tinygif?: { url: string }
    mp4?: { url: string }
    loopedmp4?: { url: string }
    webm?: { url: string }
  }
}

// Tenor API integration with pagination
async function searchTenor(query: string, limit: number = 20, pos?: string): Promise<TenorSearchResult> {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) throw new Error('TENOR_API_KEY not configured')

  const params = new URLSearchParams({
    q: query,
    key: apiKey,
    limit: limit.toString(),
    // Request all formats including mp4 and webm for highest quality
    media_filter: 'gif,mediumgif,tinygif,mp4,loopedmp4,webm',
  })
  
  if (pos) {
    params.set('pos', pos)
  }

  const response = await fetch(
    `https://tenor.googleapis.com/v2/search?${params}`
  )

  if (!response.ok) {
    throw new Error('Tenor API request failed')
  }

  const data = await response.json()
  return {
    results: data.results || [],
    next: data.next || '',
  }
}

// Tenor featured/trending API
async function getTenorFeatured(limit: number = 30, pos?: string): Promise<TenorSearchResult> {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) throw new Error('TENOR_API_KEY not configured')

  const params = new URLSearchParams({
    key: apiKey,
    limit: limit.toString(),
    media_filter: 'gif,mediumgif,tinygif,mp4,loopedmp4,webm',
  })
  
  if (pos) {
    params.set('pos', pos)
  }

  const response = await fetch(
    `https://tenor.googleapis.com/v2/featured?${params}`
  )

  if (!response.ok) {
    throw new Error('Tenor API request failed')
  }

  const data = await response.json()
  return {
    results: data.results || [],
    next: data.next || '',
  }
}

// Tenor trending search terms
async function getTenorTrendingTerms(): Promise<string[]> {
  const apiKey = process.env.TENOR_API_KEY
  if (!apiKey) throw new Error('TENOR_API_KEY not configured')

  const response = await fetch(
    `https://tenor.googleapis.com/v2/trending_terms?key=${apiKey}&limit=20`
  )

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  return data.results || []
}

// POST /api/admin/import/tenor - Import from Tenor (concurrent)
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
        source: 'TENOR',
        query,
        status: 'PROCESSING',
      },
    })

    try {
      const { results, next } = await searchTenor(query, limit, pos)
      
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: { totalItems: results.length },
      })

      // Pre-check for existing GIFs to show skipped count
      const sourceIds = results.map(r => r.id)
      const existingMap = await checkExistingBySourceId('TENOR', sourceIds)

      // Transform to common format
      const gifsToImport: GifToImport[] = results
        .filter(result => {
          // Only import if we have the full quality GIF (not mediumgif)
          const gifUrl = result.media_formats?.gif?.url
          return gifUrl && !existingMap.has(result.id)
        })
        .map(result => {
          const dimensions = result.media_formats?.gif?.dims || [0, 0]
          // Get MP4 URL (prefer loopedmp4 for seamless looping)
          const mp4Url = result.media_formats?.loopedmp4?.url || result.media_formats?.mp4?.url
          // Get WebM URL (smaller than MP4, good for web)
          const webmUrl = result.media_formats?.webm?.url
          return {
            sourceId: result.id,
            title: result.title || result.content_description || query,
            // Always use the highest quality gif format
            gifUrl: result.media_formats!.gif!.url,
            mp4Url,
            webmUrl,
            previewUrl: result.media_formats?.tinygif?.url,
            sourceUrl: result.url,
            width: dimensions[0] || 0,
            height: dimensions[1] || 0,
            source: 'TENOR' as const,
            // Use Tenor's tags array directly (these are proper curated tags)
            sourceTags: result.tags || [],
          }
        })

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
        hasNextPage: !!next,
        nextPos: next || null,
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
    console.error('Tenor import error:', error)
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

// GET /api/admin/import/tenor - Search Tenor (preview)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const trending = searchParams.get('trending') === 'true'
    const trendingTerms = searchParams.get('trending_terms') === 'true'
    const limit = parseInt(searchParams.get('limit') || '30')
    const pos = searchParams.get('pos') || undefined

    // Return trending search terms
    if (trendingTerms) {
      const terms = await getTenorTrendingTerms()
      return NextResponse.json({ terms })
    }

    // Get trending/featured GIFs
    if (trending) {
      const { results, next } = await getTenorFeatured(limit, pos)
      
      const sourceIds = results.map(r => r.id)
      const existingMap = await checkExistingBySourceId('TENOR', sourceIds)

      return NextResponse.json({
        results: results.map((r) => ({
          id: r.id,
          title: r.content_description || r.title || 'Trending GIF',
          url: r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url,
          preview: r.media_formats?.tinygif?.url || r.media_formats?.mediumgif?.url,
          mp4Preview: r.media_formats?.mp4?.url,
          sourceUrl: r.url,
          alreadyImported: existingMap.has(r.id),
          tags: r.tags || [],
        })),
        totalCount: results.length,
        hasNextPage: !!next,
        nextPos: next || null,
      })
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const { results, next } = await searchTenor(query, limit, pos)

    // Check which ones are already imported
    const sourceIds = results.map(r => r.id)
    const existingMap = await checkExistingBySourceId('TENOR', sourceIds)

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        title: r.content_description || r.title || query,
        url: r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url,
        preview: r.media_formats?.tinygif?.url || r.media_formats?.mediumgif?.url,
        mp4Preview: r.media_formats?.mp4?.url,
        sourceUrl: r.url,
        alreadyImported: existingMap.has(r.id),
        tags: r.tags || [],
      })),
      totalCount: results.length,
      hasNextPage: !!next,
      nextPos: next || null,
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
