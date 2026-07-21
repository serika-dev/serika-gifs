import { Header } from '@/components/header'
import TrendingPageClient from './trending-client'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

export const metadata: Metadata = {
  title: 'Trending Animated GIFs | SerikaGIFs',
  description: 'Discover the most popular and trending animated GIFs on the web. View viral reactions, trending animations, and popular uploads on SerikaGIFs.',
  keywords: ['trending gifs', 'popular gifs', 'viral gifs', 'reaction gifs', 'animations', 'serikagifs'],
  alternates: {
    canonical: `${SITE_URL}/trending`,
  },
  openGraph: {
    title: 'Trending Animated GIFs | SerikaGIFs',
    description: 'Discover the most popular and trending animated GIFs on the web. View viral reactions, trending animations, and popular uploads on SerikaGIFs.',
    siteName: 'SerikaGIFs',
    url: `${SITE_URL}/trending`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending Animated GIFs | SerikaGIFs',
    description: 'Discover the most popular and trending animated GIFs on the web. View viral reactions, trending animations, and popular uploads on SerikaGIFs.',
  },
}

export default function TrendingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Trending Animated GIFs",
    "description": "Discover the most popular and trending animated GIFs on the web.",
    "url": `${SITE_URL}/trending`
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        <TrendingPageClient />
      </main>
    </div>
  )
}
