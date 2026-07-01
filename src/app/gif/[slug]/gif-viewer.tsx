'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Heart, Copy, Download, Share2, Link as LinkIcon, Code, MoreHorizontal, Loader2, Pencil, Settings2, Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { SaveToCollection } from '@/components/save-to-collection'
import Link from 'next/link'

type QualityOption = 'webm' | 'mp4' | 'gif'

interface GifViewerProps {
  gif: {
    id: string
    slug: string
    title: string
    url: string
    mp4Url?: string | null
    webmUrl?: string | null
    width: number
    height: number
    user?: {
      id: string
      username: string
    }
  }
}

export function GifViewer({ gif }: GifViewerProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [isFavorited, setIsFavorited] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Start with 'gif' for SSR consistency, then load preference after mount
  const [quality, setQuality] = useState<QualityOption>('gif')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Check if current user can edit this GIF
  const canEdit = user && gif.user && (user.id === gif.user.id || user.isAdmin)

  // Load quality preference after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('gif-quality')
    if (saved === 'mp4' && gif.mp4Url) {
      setQuality('mp4')
    } else if (saved === 'webm' && gif.webmUrl) {
      setQuality('webm')
    } else if (saved === 'gif') {
      setQuality('gif')
    } else if (gif.mp4Url) {
      // Default to mp4 if available (best quality)
      setQuality('mp4')
    } else if (gif.webmUrl) {
      // Fallback to webm if available
      setQuality('webm')
    }
  }, [gif.mp4Url, gif.webmUrl])

  // Save quality preference
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('gif-quality', quality)
    }
  }, [quality, mounted])

  // Get current display URL based on quality
  const getVideoUrl = () => {
    if (quality === 'webm' && gif.webmUrl) return gif.webmUrl
    if (quality === 'mp4' && gif.mp4Url) return gif.mp4Url
    return null
  }
  const videoUrl = getVideoUrl()
  const showVideo = quality !== 'gif' && videoUrl

  useEffect(() => {
    // Check if favorited
    fetch(`/api/gifs/${gif.slug}/favorite`)
      .then((res) => res.json())
      .then((data) => setIsFavorited(data.favorited))
      .catch(() => {})
  }, [gif.slug])

  const toggleFavorite = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/gifs/${gif.slug}/favorite`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.error) {
        if (data.error === 'Unauthorized') {
          toast.error('Please log in to favorite GIFs')
        } else {
          toast.error(data.error)
        }
        return
      }

      setIsFavorited(data.favorited)
      toast.success(data.favorited ? 'Added to favorites' : 'Removed from favorites')
    } catch {
      toast.error('Failed to update favorite')
    } finally {
      setIsLoading(false)
    }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(gif.url)
    toast.success('GIF URL copied to clipboard!')
  }

  const copyPageUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Page URL copied to clipboard!')
  }

  const copyEmbed = () => {
    const embedCode = `<img src="${gif.url}" alt="${gif.title}" width="${gif.width}" height="${gif.height}" />`
    navigator.clipboard.writeText(embedCode)
    toast.success('Embed code copied to clipboard!')
  }

  const downloadGif = () => {
    // Use direct link download to avoid CORS issues
    const a = document.createElement('a')
    a.href = gif.url
    a.download = `${gif.slug}.gif`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Download started!')
  }

  const shareGif = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: gif.title,
          text: `Check out this GIF: ${gif.title}`,
          url: window.location.href,
        })
      } catch {
        // User cancelled share
      }
    } else {
      copyPageUrl()
    }
  }

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <div className="relative bg-muted flex items-center justify-center min-h-[250px]">
        {showVideo ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="max-w-full max-h-[50vh] lg:max-h-[70vh] object-contain w-auto h-auto"
          />
        ) : (
          <img
            src={gif.url}
            alt={gif.title}
            className="max-w-full max-h-[50vh] lg:max-h-[70vh] object-contain w-auto h-auto"
          />
        )}
        
        {/* Quality Selector - positioned in corner */}
        {(gif.mp4Url || gif.webmUrl) && (
          <div className="absolute bottom-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-7 px-2 text-xs bg-black/60 hover:bg-black/80 border-0">
                  <Settings2 className="h-3 w-3 mr-1" />
                  {quality === 'webm' ? 'WebM' : quality === 'mp4' ? 'MP4' : 'GIF'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">Quality</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={quality} onValueChange={(v) => setQuality(v as QualityOption)}>
                  {gif.mp4Url && (
                    <DropdownMenuRadioItem value="mp4" className="text-sm">
                      MP4
                      <span className="ml-auto text-xs text-muted-foreground">Best</span>
                    </DropdownMenuRadioItem>
                  )}
                  {gif.webmUrl && (
                    <DropdownMenuRadioItem value="webm" className="text-sm">
                      WebM
                      <span className="ml-auto text-xs text-muted-foreground">Smallest</span>
                    </DropdownMenuRadioItem>
                  )}
                  <DropdownMenuRadioItem value="gif" className="text-sm">
                    GIF
                    <span className="ml-auto text-xs text-muted-foreground">Compatible</span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 border-t border-border">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant={isFavorited ? 'default' : 'outline'}
            size="sm"
            onClick={toggleFavorite}
            disabled={isLoading}
            className={isFavorited ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            )}
            <span className="ml-2 hidden xs:inline">{isFavorited ? 'Favorited' : 'Favorite'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={shareGif} className="flex-1 sm:flex-none">
            <Share2 className="h-4 w-4 sm:mr-2" />
            <span className="ml-2 sm:ml-0 hidden xs:inline">Share</span>
          </Button>

          <SaveToCollection 
            gifId={gif.id} 
            variant="button"
            className="flex-1 sm:flex-none h-8 sm:h-9 px-3"
          />
          
          <Button variant="outline" size="sm" onClick={copyUrl} className="flex-1 sm:flex-none hidden xs:flex">
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="ml-2 sm:ml-0 hidden sm:inline">Copy URL</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadGif} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="ml-2 sm:ml-0 hidden sm:inline">Download</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyPageUrl}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Copy page URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyEmbed}>
                <Code className="mr-2 h-4 w-4" />
                Copy embed code
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyUrl} className="xs:hidden">
                <Copy className="mr-2 h-4 w-4" />
                Copy GIF URL
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/gif/${gif.slug}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit GIF
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  )
}
