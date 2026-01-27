'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Heart, Copy, Download, Share2, Link as LinkIcon, Code, MoreHorizontal, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'

interface GifViewerProps {
  gif: {
    id: string
    slug: string
    title: string
    url: string
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

  // Check if current user can edit this GIF
  const canEdit = user && gif.user && (user.id === gif.user.id || user.isAdmin)

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
    <Card className="overflow-hidden border-border/50">
      <div className="relative bg-muted flex items-center justify-center min-h-[300px]">
        <img
          src={gif.url}
          alt={gif.title}
          className="max-w-full max-h-[70vh] object-contain"
        />
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant={isFavorited ? 'default' : 'outline'}
            size="sm"
            onClick={toggleFavorite}
            disabled={isLoading}
            className={isFavorited ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            )}
            <span className="ml-2">{isFavorited ? 'Favorited' : 'Favorite'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={shareGif}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="h-4 w-4 mr-2" />
            Copy URL
          </Button>

          <Button variant="outline" size="sm" onClick={downloadGif}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
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
