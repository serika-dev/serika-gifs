import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { TrendingUp, Upload } from 'lucide-react'
import prisma from '@/lib/prisma'

async function getPopularTags() {
  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' }, // Hide internal import tag from users
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
    take: 10,
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
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Share & Discover GIFs
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-6">
              Upload, discover, and share your favorite animated moments with the world.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link href="/register">
                <Button size="lg">
                  <Upload className="h-4 w-4" />
                  Start Sharing
                </Button>
              </Link>
              <Link href="/trending">
                <Button size="lg" variant="outline">
                  <TrendingUp className="h-4 w-4" />
                  Browse Trending
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <section className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">Popular:</span>
            {popularTags.map((tag) => (
              <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-accent transition-colors whitespace-nowrap"
                >
                  {tag.name}
                  <span className="ml-1 text-muted-foreground">{tag.count}</span>
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* GIF Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Popular GIFs</h2>
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
