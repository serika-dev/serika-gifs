import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { GifViewer } from './gif-viewer'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Eye, Heart, FileType, Maximize } from 'lucide-react'
import prisma from '@/lib/prisma'
import { formatDistanceToNow } from 'date-fns'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

async function getGifForMetadata(slug: string) {
  return prisma.gif.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      url: true,
      mp4Url: true,
      webmUrl: true,
      thumbnailUrl: true,
      width: true,
      height: true,
    },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const gif = await getGifForMetadata(slug)
  
  if (!gif) {
    return {
      title: 'GIF Not Found',
    }
  }

  const title = gif.title || 'GIF'
  const description = `Click to view the GIF`

  // Tenor's exact metadata structure for Discord inline video rendering:
  // - og:type = video.other
  // - og:image = the GIF file (type: image/gif)
  // - og:video = the MP4 file (type: video/mp4) 
  // - Second og:video = the WebM file (type: video/webm)
  const gifUrl = gif.url
  const mp4Url = gif.mp4Url
  const webmUrl = gif.webmUrl

  // Build video array for OpenGraph - include both MP4 and WebM like Tenor
  const videos: Array<{
    url: string
    secureUrl: string
    type: string
    width: number
    height: number
  }> = []

  if (mp4Url) {
    videos.push({
      url: mp4Url,
      secureUrl: mp4Url,
      type: 'video/mp4',
      width: gif.width,
      height: gif.height,
    })
  }

  if (webmUrl) {
    videos.push({
      url: webmUrl,
      secureUrl: webmUrl,
      type: 'video/webm',
      width: gif.width,
      height: gif.height,
    })
  }

  return {
    title: `${title} | SerikaGifs`,
    description,
    openGraph: {
      title,
      description,
      siteName: 'SerikaGifs',
      type: 'video.other',
      url: `${SITE_URL}/gif/${slug}`,
      images: [
        {
          url: gifUrl,
          width: gif.width,
          height: gif.height,
          alt: title,
          type: 'image/gif',
        },
      ],
      videos: videos.length > 0 ? videos : undefined,
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [gifUrl],
      players: mp4Url ? [
        {
          playerUrl: `${SITE_URL}/gif/${slug}`,
          streamUrl: mp4Url,
          width: gif.width,
          height: gif.height,
        },
      ] : undefined,
    },
  }
}

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
    mp4Url: gif.mp4Url,
    webmUrl: gif.webmUrl,
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
      
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
          {/* GIF Display */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <GifViewer gif={gif} />
          </div>

          {/* Sidebar - becomes full-width on mobile, appears below GIF */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-6 order-2 lg:order-2">
            {/* Title and Description */}
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1.5 sm:mb-2 leading-tight">{gif.title}</h1>
              {gif.description && (
                <p className="text-xs sm:text-sm lg:text-base text-muted-foreground leading-relaxed">{gif.description}</p>
              )}
            </div>

            {/* User Info */}
            <Link href={`/user/${gif.user.username}`} className="flex items-center gap-2.5 sm:gap-3 group">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0">
                <AvatarImage src={gif.user.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                  {gif.user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs sm:text-sm lg:text-base group-hover:text-primary transition-colors truncate">
                  {gif.user.username}
                </p>
                <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground truncate">
                  {formatDistanceToNow(new Date(gif.createdAt), { addSuffix: true })}
                </p>
              </div>
            </Link>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 shrink-0" />
                <span className="truncate">{gif.views.toLocaleString()} views</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 shrink-0" />
                <span className="truncate">{gif.favorites.toLocaleString()} favorites</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                <Maximize className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 shrink-0" />
                <span className="truncate">{gif.width} × {gif.height}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                <FileType className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 shrink-0" />
                <span className="truncate">{formatBytes(gif.fileSize)}</span>
              </div>
            </div>

            {/* Tags */}
            {gif.tags.filter(tag => tag.slug !== 'import').length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs sm:text-sm lg:text-base font-medium mb-2 sm:mb-2.5">Tags</h3>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {gif.tags.filter(tag => tag.slug !== 'import').map((tag) => (
                      <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 active:bg-primary/30 transition-colors text-[10px] sm:text-xs lg:text-sm px-2 py-0.5 sm:px-2.5 sm:py-1"
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
            {gif.source !== 'UPLOAD' && (
              <>
                <Separator />
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Originally from</p>
                    <p className="text-sm font-medium capitalize">{gif.source.toLowerCase()}</p>
                  </div>
                  {gif.sourceUrl && (
                    <a
                      href={gif.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View source →
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
