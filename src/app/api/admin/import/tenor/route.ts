import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/session'
import { uploadToB2 } from '@/lib/storage'
import { nanoid } from 'nanoid'

interface TenorSearchResult {
  results: TenorGif[]
  next: string
}

interface TenorGif {
  id: string
  content_description: string
  url: string
  media_formats: {
    gif?: { url: string; dims: number[] }
    mediumgif?: { url: string }
    tinygif?: { url: string }
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
    media_filter: 'gif',
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

// POST /api/admin/import/tenor - Import from Tenor
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const { query, limit = 20, pos } = await request.json()

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

          if (!gifUrl) {
            failed++
            continue
          }

          const previewUrl = result.media_formats?.tinygif?.url

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

          // Extract tags from query and description
          const tagsToCreate = new Set<string>()
          
          // Add query as a tag (split by spaces and clean)
          const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
          queryWords.forEach(word => tagsToCreate.add(word))
          
          // Add words from description (if available)
          if (result.content_description) {
            const descWords = result.content_description.toLowerCase()
              .split(/\s+/)
              .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(word))
              .slice(0, 5) // Limit to 5 words from description
            descWords.forEach(word => tagsToCreate.add(word))
          }

          const gif = await prisma.gif.create({
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

          // Create and assign tags
          for (const tagName of tagsToCreate) {
            try {
              // Upsert tag (create if doesn't exist)
              const tag = await prisma.tag.upsert({
                where: { slug: tagName },
                update: {},
                create: {
                  name: tagName,
                  slug: tagName,
                },
              })

              // Connect tag to GIF
              await prisma.tagOnGif.create({
                data: {
                  gifId: gif.id,
                  tagId: tag.id,
                },
              })
            } catch (e) {
              // Ignore tag creation errors (likely duplicates)
              console.error('Error creating tag:', e)
            }
          }

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
    const limit = parseInt(searchParams.get('limit') || '20')
    const pos = searchParams.get('pos') || undefined

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const { results, next } = await searchTenor(query, limit, pos)

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        title: r.content_description,
        url: r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url,
        preview: r.media_formats?.tinygif?.url,
        sourceUrl: r.url,
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
