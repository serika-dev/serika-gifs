import { Header } from '@/components/header'
import { Badge } from '@/components/ui/badge'
import { Globe, Lock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { GifGrid } from '@/components/gif-grid'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

interface Props {
  params: Promise<{ id: string }>
}

async function getCollection(id: string) {
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      gifs: {
        include: {
          gif: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                },
              },
              tags: {
                include: {
                  tag: true,
                },
              },
              _count: {
                select: { favorites: true },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      },
      _count: {
        select: { gifs: true },
      },
    },
  })

  return collection
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const collection = await getCollection(id)

  if (!collection || !collection.isPublic) {
    return {
      title: 'Collection Not Found | SerikaGIFs',
    }
  }

  const title = `${collection.name} GIF Collection`
  const description = collection.description
    ? `${collection.description} - Browse the ${collection.name} GIF collection curated by ${collection.user.username} on SerikaGIFs. Contains ${collection._count.gifs} amazing GIFs.`
    : `Browse the ${collection.name} GIF collection curated by ${collection.user.username} on SerikaGIFs. Contains ${collection._count.gifs} amazing GIFs.`

  return {
    title: `${title} - Curated by ${collection.user.username} | SerikaGIFs`,
    description,
    keywords: [collection.name.toLowerCase(), 'gif collection', 'curated gifs', collection.user.username, 'serikagifs'],
    alternates: {
      canonical: `${SITE_URL}/collection/${id}`,
    },
    openGraph: {
      title: `${title} | SerikaGIFs`,
      description,
      siteName: 'SerikaGIFs',
      url: `${SITE_URL}/collection/${id}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | SerikaGIFs`,
      description,
    },
  }
}

export default async function CollectionPage({ params }: Props) {
  const { id } = await params
  const collection = await getCollection(id)

  if (!collection) {
    notFound()
  }

  // Transform gifs for GifGrid format
  const gifs = collection.gifs.map((item: typeof collection.gifs[number]) => ({
    id: item.gif.id,
    slug: item.gif.slug,
    title: item.gif.title,
    description: item.gif.description,
    url: item.gif.url,
    thumbnailUrl: item.gif.thumbnailUrl,
    width: item.gif.width,
    height: item.gif.height,
    fileSize: item.gif.fileSize,
    views: item.gif.views,
    source: item.gif.source,
    createdAt: item.gif.createdAt.toISOString(),
    user: item.gif.user,
    tags: item.gif.tags.map((t: { tag: { name: string } }) => t.tag.name),
    _count: item.gif._count,
  }))

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${collection.name} GIF Collection`,
    "description": collection.description || `Browse the ${collection.name} GIF collection curated by ${collection.user.username} on SerikaGIFs.`,
    "url": `${SITE_URL}/collection/${collection.id}`,
    "numberOfItems": collection._count.gifs,
    "author": {
      "@type": "Person",
      "name": collection.user.username,
      "url": `${SITE_URL}/user/${collection.user.username}`
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Link href="/collections" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to collections
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-semibold">{collection.name}</h1>
            {collection.isPublic ? (
              <Globe className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          {collection.description && (
            <p className="text-sm text-muted-foreground mb-4">{collection.description}</p>
          )}
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary">{collection._count.gifs} GIFs</Badge>
            <Link href={`/user/${collection.user.username}`} className="text-sm text-muted-foreground hover:text-foreground">
              by {collection.user.username}
            </Link>
          </div>
        </div>

        {gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-base">This collection is empty</p>
          </div>
        ) : (
          <GifGrid initialGifs={gifs} />
        )}
      </main>
    </div>
  )
}
