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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

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
      fileSize: true,
      tags: {
        select: {
          tag: {
            select: {
              name: true,
            }
          }
        }
      }
    },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const gif = await getGifForMetadata(slug)
  
  if (!gif) {
    return {
      title: 'GIF Not Found | SerikaGIFs',
    }
  }

  const title = gif.title || 'GIF'
  const tagsList = gif.tags.map(t => t.tag.name).filter(name => name !== 'import')
  const formattedBytes = formatBytes(gif.fileSize)
  const description = gif.description
    ? `${gif.description} - Watch, share, and download the ${title} animated GIF on SerikaGIFs. Dimensions: ${gif.width}x${gif.height}, size: ${formattedBytes}.`
    : `Watch, share, and download the ${title} animated GIF on SerikaGIFs. Dimensions: ${gif.width}x${gif.height}, size: ${formattedBytes}.${tagsList.length > 0 ? ` Tags: ${tagsList.join(', ')}.` : ''}`

  const keywords = [
    title.toLowerCase(),
    ...tagsList.map(t => t.toLowerCase()),
    'gif', 'animated gif', 'download gif', 'free gif', 'share gif', 'serikagifs'
  ]

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
    title: `${title} GIF - Download & Share | SerikaGIFs`,
    description,
    keywords,
    alternates: {
      canonical: `${SITE_URL}/gif/${slug}`,
    },
    openGraph: {
      title: `${title} GIF`,
      description,
      siteName: 'SerikaGIFs',
      type: 'video.other',
      // Point og:url to the GIF file directly - this makes Discord render it as direct media
      url: gifUrl,
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
      title: `${title} GIF`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/gif/${slug}#image`,
        "url": gif.url,
        "contentUrl": gif.url,
        "thumbnailUrl": gif.thumbnailUrl || gif.url,
        "name": gif.title,
        "description": gif.description || `Watch, share, and download the ${gif.title} GIF on SerikaGIFs.`,
        "width": gif.width,
        "height": gif.height,
        "encodingFormat": "image/gif",
        "author": {
          "@type": "Person",
          "name": gif.user.username,
          "url": `${SITE_URL}/user/${gif.user.username}`
        },
        "datePublished": gif.createdAt.toISOString()
      },
      ...(gif.mp4Url || gif.webmUrl ? [{
        "@type": "VideoObject",
        "@id": `${SITE_URL}/gif/${slug}#video`,
        "name": gif.title,
        "description": gif.description || `Watch, share, and download the ${gif.title} GIF on SerikaGIFs.`,
        "thumbnailUrl": gif.thumbnailUrl || gif.url,
        "uploadDate": gif.createdAt.toISOString(),
        "contentUrl": gif.mp4Url || gif.webmUrl,
        "embedUrl": `${SITE_URL}/gif/${slug}`,
        "interactionStatistic": {
          "@type": "InteractionCounter",
          "interactionType": { "@type": "WatchAction" },
          "userInteractionCount": gif.views
        }
      }] : [])
    ]
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-3">
          {/* GIF Display */}
          <div className="lg:col-span-2">
            <GifViewer gif={gif} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Title and Description */}
            <div>
              <h1 className="text-xl font-semibold mb-1 leading-tight">{gif.title}</h1>
              {gif.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{gif.description}</p>
              )}
            </div>

            {/* User Info */}
            <Link href={`/user/${gif.user.username}`} className="flex items-center gap-2.5 group">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={gif.user.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {gif.user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                  {gif.user.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDistanceToNow(new Date(gif.createdAt), { addSuffix: true })}
                </p>
              </div>
            </Link>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4 shrink-0" />
                <span className="truncate">{gif.views.toLocaleString()} views</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="h-4 w-4 shrink-0" />
                <span className="truncate">{gif.favorites.toLocaleString()} favorites</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Maximize className="h-4 w-4 shrink-0" />
                <span className="truncate">{gif.width} × {gif.height}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileType className="h-4 w-4 shrink-0" />
                <span className="truncate">{formatBytes(gif.fileSize)}</span>
              </div>
            </div>

            {/* Tags */}
            {gif.tags.filter(tag => tag.slug !== 'import').length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {gif.tags.filter(tag => tag.slug !== 'import').map((tag) => (
                      <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-accent transition-colors"
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
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
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
