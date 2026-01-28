import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Sparkles, TrendingUp, Upload } from 'lucide-react'
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
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-12 md:py-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
              <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 px-2">
              Share & Discover{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Amazing GIFs
              </span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 px-4">
              The ultimate GIF sharing platform. Upload, discover, and share your favorite animated moments with the world.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 h-11 sm:h-12 text-base">
                  <Upload className="mr-2 h-5 w-5" />
                  Start Sharing
                </Button>
              </Link>
              <Link href="/trending" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 sm:h-12 text-base">
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
        <section className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap shrink-0">Popular:</span>
            {popularTags.map((tag) => (
              <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 active:bg-primary/30 transition-colors whitespace-nowrap text-xs sm:text-sm py-1 px-2 sm:px-3"
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
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Popular GIFs</h2>
          <Link href="/trending">
            <Button variant="ghost" size="sm" className="h-8 sm:h-9 text-sm">
              View all
            </Button>
          </Link>
        </div>
        <GifGrid sort="most-viewed" />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-8 sm:mt-12 md:mt-16">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">SerikaGIFs</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
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
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              © 2026 SerikaGIFs. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
