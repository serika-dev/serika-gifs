import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Sparkles, TrendingUp, Upload } from 'lucide-react'
import prisma from '@/lib/prisma'

async function getPopularTags() {
  const tags = await prisma.tag.findMany({
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
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Share & Discover{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Amazing GIFs
              </span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              The ultimate GIF sharing platform. Upload, discover, and share your favorite animated moments with the world.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  <Upload className="mr-2 h-5 w-5" />
                  Start Sharing
                </Button>
              </Link>
              <Link href="/trending">
                <Button size="lg" variant="outline">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Browse Trending
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Popular:</span>
            {popularTags.map((tag) => (
              <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 transition-colors whitespace-nowrap"
                >
                  {tag.name}
                  <span className="ml-1 text-muted-foreground">({tag.count})</span>
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* GIF Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Latest GIFs</h2>
          <Link href="/trending">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>
        <GifGrid />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">SerikaGIFs</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/about" className="hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/api-docs" className="hover:text-foreground transition-colors">
                API
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              © 2026 SerikaGIFs. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
