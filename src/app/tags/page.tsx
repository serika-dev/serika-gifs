import { Header } from '@/components/header'
import { CategoryCard } from '@/components/category-card'
import { TagSearch } from '@/components/tag-search'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

export const revalidate = 3600 // Cache the popular-tags grid for an hour

export const metadata: Metadata = {
  title: 'Browse GIF Tags & Categories | SerikaGIFs',
  description: 'Explore popular GIF tags and categories. Search and find animated GIFs by topics, reactions, emotions, and more on SerikaGIFs.',
  keywords: ['gif tags', 'gif categories', 'search gifs', 'animated gifs', 'reactions', 'emotions', 'serikagifs'],
  alternates: {
    canonical: `${SITE_URL}/tags`,
  },
  openGraph: {
    title: 'Browse GIF Tags & Categories | SerikaGIFs',
    description: 'Explore popular GIF tags and categories. Search and find animated GIFs by topics, reactions, emotions, and more on SerikaGIFs.',
    siteName: 'SerikaGIFs',
    url: `${SITE_URL}/tags`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse GIF Tags & Categories | SerikaGIFs',
    description: 'Explore popular GIF tags and categories. Search and find animated GIFs by topics, reactions, emotions, and more on SerikaGIFs.',
  },
}

const GRID_SIZE = 120
const SIDEBAR_SIZE = 40

async function getPopularTags() {
  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' }, // Hide internal import tag from users
    },
    include: {
      _count: {
        select: { gifs: true },
      },
      // Grab one representative GIF for the card preview
      gifs: {
        where: { gif: { isPublic: true, isNsfw: false } },
        take: 1,
        select: {
          gif: { select: { thumbnailUrl: true, url: true } },
        },
      },
    },
    orderBy: {
      gifs: {
        _count: 'desc',
      },
    },
    take: GRID_SIZE,
  })

  return tags.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    count: tag._count.gifs,
    thumbnailUrl: tag.gifs[0]?.gif.thumbnailUrl ?? null,
    previewUrl: tag.gifs[0]?.gif.url ?? null,
  }))
}

const numberFmt = new Intl.NumberFormat('en', { notation: 'compact' })

export default async function TagsPage() {
  const tags = await getPopularTags()
  const sidebarTags = tags.slice(0, SIDEBAR_SIZE)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Browse GIF Tags & Categories",
    "description": "Explore popular GIF tags and categories on SerikaGIFs.",
    "url": `${SITE_URL}/tags`
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero + search */}
        <div className="mb-8 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Browse Tags</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore GIFs across {numberFmt.format(23000)}+ tags — or search for anything.
            </p>
          </div>
          <TagSearch />
        </div>

        {tags.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            No tags yet. Upload some GIFs with tags to get started!
          </p>
        ) : (
          <div className="flex gap-8">
            {/* Sidebar — popular tags */}
            <aside className="hidden w-56 shrink-0 lg:block">
              <div className="sticky top-20">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                  Popular
                </h2>
                <nav className="flex flex-col">
                  {sidebarTags.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/tag/${tag.slug}`}
                      className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="truncate capitalize">{tag.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground/70 group-hover:text-muted-foreground">
                        {numberFmt.format(tag.count)}
                      </span>
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Category grid */}
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {tags.map((tag) => (
                  <CategoryCard
                    key={tag.slug}
                    name={tag.name}
                    slug={tag.slug}
                    count={tag.count}
                    thumbnailUrl={tag.thumbnailUrl}
                    previewUrl={tag.previewUrl}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
