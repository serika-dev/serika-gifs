import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Badge } from '@/components/ui/badge'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

async function getTag(slug: string) {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { gifs: true },
      },
    },
  })

  return tag
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTag(slug)

  if (!tag) {
    return {
      title: 'Tag Not Found | SerikaGIFs',
    }
  }

  const title = `${tag.name} GIFs`
  const description = `Explore, watch, download, and share the best ${tag.name} animated GIFs on SerikaGIFs. We have ${tag._count.gifs.toLocaleString()} high-quality GIFs matching this tag.`

  return {
    title: `${title} - Find & Share on SerikaGIFs`,
    description,
    keywords: [tag.name.toLowerCase(), `${tag.name.toLowerCase()} gifs`, 'gifs', 'animated gifs', 'reaction gifs', 'serikagifs'],
    alternates: {
      canonical: `${SITE_URL}/tag/${slug}`,
    },
    openGraph: {
      title: `${title} - SerikaGIFs`,
      description,
      siteName: 'SerikaGIFs',
      url: `${SITE_URL}/tag/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - SerikaGIFs`,
      description,
    },
  }
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tag = await getTag(slug)

  if (!tag) {
    notFound()
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${tag.name} GIFs`,
    "description": `Browse the collection of ${tag.name} GIFs on SerikaGIFs.`,
    "url": `${SITE_URL}/tag/${tag.slug}`,
    "numberOfItems": tag._count.gifs
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary">
              {tag.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {tag._count.gifs.toLocaleString()} GIFs
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Explore all GIFs tagged with {tag.name}
          </p>
        </div>

        <GifGrid tag={slug} />
      </main>
    </div>
  )
}
