import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

async function getMatchingTags(query: string) {
  if (!query) return []

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const slugQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '')

  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' },
      OR: [
        // Tags whose name contains every term (any order)
        { AND: terms.map((t) => ({ name: { contains: t, mode: 'insensitive' as const } })) },
        // Or whose (de-spaced) slug contains the de-spaced query
        ...(slugQuery ? [{ slug: { contains: slugQuery, mode: 'insensitive' as const } }] : []),
      ],
    },
    include: {
      _count: {
        select: { gifs: true }
      }
    },
    take: 20, // Fetch a few more to allow for better sorting
    orderBy: {
      gifs: {
        _count: 'desc',
      },
    },
  })

  // Prioritize 1. Exact matches 2. Prefix matches 3. Popularity
  return tags.sort((a, b) => {
    const aLower = a.name.toLowerCase()
    const bLower = b.name.toLowerCase()
    const qLower = query.toLowerCase()

    const aExact = aLower === qLower
    const bExact = bLower === qLower
    if (aExact && !bExact) return -1
    if (bExact && !aExact) return 1

    const aPrefix = aLower.startsWith(qLower)
    const bPrefix = bLower.startsWith(qLower)
    if (aPrefix && !bPrefix) return -1
    if (bPrefix && !aPrefix) return 1

    return 0 // Keep relative order (popularity)
  }).slice(0, 12)
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams
  const query = q || ''
  
  const title = query ? `Search results for "${query}"` : 'Search GIFs'
  const description = query
    ? `Find the best animated GIFs, reaction clips, and tags matching "${query}" on SerikaGIFs. Download and share directly.`
    : 'Search for amazing animated GIFs, tags, and collections on SerikaGIFs.'

  return {
    title: `${title} | SerikaGIFs`,
    description,
    keywords: query ? [query.toLowerCase(), 'search', 'gifs', 'serikagifs'] : ['search', 'gifs', 'animated gifs', 'serikagifs'],
    alternates: {
      canonical: query ? `${SITE_URL}/search?q=${encodeURIComponent(query)}` : `${SITE_URL}/search`,
    },
    openGraph: {
      title: `${title} | SerikaGIFs`,
      description,
      siteName: 'SerikaGIFs',
      url: query ? `${SITE_URL}/search?q=${encodeURIComponent(query)}` : `${SITE_URL}/search`,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${title} | SerikaGIFs`,
      description,
    },
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = q || ''
  const matchingTags = await getMatchingTags(query)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "name": query ? `Search results for "${query}"` : "Search GIFs",
    "url": query ? `${SITE_URL}/search?q=${encodeURIComponent(query)}` : `${SITE_URL}/search`
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 overflow-hidden">
          <h1 className="text-2xl font-semibold mb-2 truncate">
            {query ? `Search results for "${query}"` : 'Search GIFs'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {query
              ? `Found GIFs and tags matching your query.`
              : 'Enter a search term to find GIFs'}
          </p>

          {matchingTags.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Related Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {matchingTags.map((tag) => (
                  <Link key={tag.id} href={`/tag/${tag.slug}`}>
                    <Badge variant="secondary" className="hover:bg-accent transition-colors cursor-pointer">
                      {tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {query && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">
              GIF Results
            </h2>
            <GifGrid search={query} sort="trending" />
          </div>
        )}
      </main>
    </div>
  )
}
