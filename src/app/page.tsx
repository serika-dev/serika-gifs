import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { TrendingUp, Upload, Search } from 'lucide-react'
import prisma from '@/lib/prisma'

async function getPopularTags() {
  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' },
    },
    include: {
      _count: {
        select: { gifs: true },
      },
    },
    orderBy: {
      gifs: {
        _count: 'desc',
      },
    },
    take: 12,
  })

  return tags.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    count: tag._count.gifs,
  }))
}

export default async function HomePage() {
  const popularTags = await getPopularTags()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.15] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-4">
              Discover & share
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                the best GIFs
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl">
              Upload, explore, and share animated moments with the world.
            </p>

            {/* Search bar */}
            <form action="/search" className="w-full max-w-xl mb-6">
              <div className="relative flex items-center">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-5 w-5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search for GIFs, tags, reactions..."
                  className="w-full h-12 pl-12 pr-28 rounded-xl border border-border bg-background/80 backdrop-blur text-sm shadow-sm transition-all focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  type="submit"
                  size="default"
                  className="absolute right-1.5 h-9 rounded-lg"
                >
                  Search
                </Button>
              </div>
            </form>

            {/* Popular tags */}
            {popularTags.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                <span className="text-xs text-muted-foreground">Trending:</span>
                {popularTags.slice(0, 8).map((tag) => (
                  <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link href="/register">
                <Button size="lg" className="h-11 px-6 rounded-xl">
                  <Upload className="h-4 w-4" />
                  Start Sharing
                </Button>
              </Link>
              <Link href="/trending">
                <Button size="lg" variant="outline" className="h-11 px-6 rounded-xl">
                  <TrendingUp className="h-4 w-4" />
                  Browse Trending
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* GIF Grid */}
      <main className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Popular GIFs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Most viewed across the platform</p>
          </div>
          <Link href="/trending">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>
        <GifGrid sort="most-viewed" />
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <span className="font-semibold text-sm">SerikaGIFs</span>
            <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <Link href="/developer/docs/getting-started" className="hover:text-foreground transition-colors">
                API
              </Link>
              <Link href="/guidelines" className="hover:text-foreground transition-colors">
                Guidelines
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/dmca" className="hover:text-foreground transition-colors">
                DMCA
              </Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              © 2026 SerikaGIFs
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
