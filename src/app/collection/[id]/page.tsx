import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FolderOpen, Lock, Globe, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { GifGrid } from '@/components/gif-grid'

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
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          tags: true,
          _count: {
            select: { favorites: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { gifs: true },
      },
    },
  })

  return collection
}

export default async function CollectionPage({ params }: Props) {
  const { id } = await params
  const collection = await getCollection(id)

  if (!collection) {
    notFound()
  }

  // Transform gifs for GifGrid format
  const gifs = collection.gifs.map(gif => ({
    id: gif.id,
    slug: gif.slug,
    title: gif.title,
    description: gif.description,
    url: gif.url,
    thumbnailUrl: gif.thumbnailUrl,
    width: gif.width,
    height: gif.height,
    size: gif.size,
    views: gif.views,
    source: gif.source,
    createdAt: gif.createdAt.toISOString(),
    user: gif.user,
    tags: gif.tags,
    _count: gif._count,
  }))

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Link href="/collections" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to collections
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{collection.name}</h1>
            {collection.isPublic ? (
              <Globe className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          
          {collection.description && (
            <p className="text-muted-foreground mb-4">{collection.description}</p>
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
            <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">This collection is empty</p>
          </div>
        ) : (
          <GifGrid initialGifs={gifs} />
        )}
      </main>
    </div>
  )
}
