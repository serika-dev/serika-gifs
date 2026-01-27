import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { GifViewer } from './gif-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Eye, Heart, Calendar, FileType, Maximize } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDistanceToNow } from 'date-fns'

async function getGif(slug: string) {
  const gif = await prisma.gif.findUnique({
    where: { slug },
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
        select: {
          favorites: true,
        },
      },
    },
  })

  if (!gif) return null

  // Increment view count
  await prisma.gif.update({
    where: { id: gif.id },
    data: { views: { increment: 1 } },
  })

  return {
    id: gif.id,
    slug: gif.slug,
    title: gif.title,
    description: gif.description,
    url: gif.url,
    thumbnailUrl: gif.thumbnailUrl,
    width: gif.width,
    height: gif.height,
    fileSize: gif.fileSize,
    duration: gif.duration,
    source: gif.source,
    sourceUrl: gif.sourceUrl,
    views: gif.views + 1,
    favorites: gif._count.favorites,
    tags: gif.tags.map((t) => ({
      name: t.tag.name,
      slug: t.tag.slug,
    })),
    user: gif.user,
    createdAt: gif.createdAt,
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default async function GifPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const gif = await getGif(slug)

  if (!gif) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* GIF Display */}
          <div className="lg:col-span-2">
            <GifViewer gif={gif} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Title and Description */}
            <div>
              <h1 className="text-2xl font-bold mb-2">{gif.title}</h1>
              {gif.description && (
                <p className="text-muted-foreground">{gif.description}</p>
              )}
            </div>

            {/* User Info */}
            <Link href={`/user/${gif.user.username}`} className="flex items-center gap-3 group">
              <Avatar className="h-10 w-10">
                <AvatarImage src={gif.user.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {gif.user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium group-hover:text-primary transition-colors">
                  {gif.user.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(gif.createdAt), { addSuffix: true })}
                </p>
              </div>
            </Link>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>{gif.views.toLocaleString()} views</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                <span>{gif.favorites.toLocaleString()} favorites</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Maximize className="h-4 w-4" />
                <span>{gif.width} × {gif.height}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileType className="h-4 w-4" />
                <span>{formatBytes(gif.fileSize)}</span>
              </div>
            </div>

            {/* Tags */}
            {gif.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {gif.tags.map((tag) => (
                      <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 transition-colors"
                        >
                          {tag.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Source */}
            {gif.source !== 'UPLOAD' && gif.sourceUrl && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2">Source</h3>
                  <p className="text-sm text-muted-foreground">
                    Imported from {gif.source.toLowerCase()}
                  </p>
                  <a
                    href={gif.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View original
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
