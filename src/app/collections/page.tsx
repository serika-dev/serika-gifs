import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pin } from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

export const metadata: Metadata = {
  title: 'Curated GIF Collections | SerikaGIFs',
  description: 'Discover curated GIF collections created by the SerikaGIFs community. Browse featured, staff-pinned, and popular collections.',
  keywords: ['gif collections', 'curated gifs', 'featured gifs', 'playlists', 'serikagifs'],
  alternates: {
    canonical: `${SITE_URL}/collections`,
  },
  openGraph: {
    title: 'Curated GIF Collections | SerikaGIFs',
    description: 'Discover curated GIF collections created by the SerikaGIFs community. Browse featured, staff-pinned, and popular collections.',
    siteName: 'SerikaGIFs',
    url: `${SITE_URL}/collections`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Curated GIF Collections | SerikaGIFs',
    description: 'Discover curated GIF collections created by the SerikaGIFs community. Browse featured, staff-pinned, and popular collections.',
  },
}

async function getPublicCollections() {
  const collections = await prisma.collection.findMany({
    where: { isPublic: true },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      _count: {
        select: { gifs: true },
      },
    },
    orderBy: [
      { isGlobal: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 50,
  })

  return collections
}

export default async function CollectionsPage() {
  const collections = await getPublicCollections()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Curated GIF Collections",
    "description": "Discover curated GIF collections created by the SerikaGIFs community.",
    "url": `${SITE_URL}/collections`
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
          <h1 className="text-2xl font-semibold mb-1">Collections</h1>
          <p className="text-sm text-muted-foreground">Browse curated GIF collections</p>
        </div>

        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-base">No public collections yet</p>
            <p className="text-sm mt-1">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((collection: typeof collections[number]) => (
              <Link key={collection.id} href={`/collection/${collection.id}`}>
                <Card className={`hover:border-primary/50 transition-colors cursor-pointer h-full ${collection.isGlobal ? 'border-primary/30' : ''}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {collection.name}
                      {collection.isGlobal && (
                        <Pin className="h-3.5 w-3.5 text-primary" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collection.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {collection.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {collection._count.gifs} GIFs
                        </Badge>
                        {collection.isGlobal && (
                          <Badge variant="outline">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        by {collection.user.username}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
