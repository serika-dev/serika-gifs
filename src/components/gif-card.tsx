'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Heart, Eye, Copy, Download, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Gif } from '@/hooks/use-gifs'

interface GifCardProps {
  gif: Gif
  showStats?: boolean
  showQuickActions?: boolean
  onFavorite?: () => void
}

export function GifCard({ 
  gif, 
  showStats = true, 
  showQuickActions = true,
  onFavorite,
}: GifCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const copyUrl = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(gif.url)
    toast.success('URL copied to clipboard!')
  }

  const downloadGif = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = gif.url
    link.download = `${gif.slug || gif.id}.gif`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Download started!')
  }

  const shareGif = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: gif.title,
          url: `${window.location.origin}/gif/${gif.slug}`,
        })
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/gif/${gif.slug}`)
      toast.success('Link copied to clipboard!')
    }
  }

  const favoriteCount = gif._count?.favorites ?? 0

  return (
    <Link href={`/gif/${gif.slug}`}>
      <Card
        className="group relative aspect-square overflow-hidden border-border/50 bg-muted cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-primary/50"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image */}
        <img
          src={isHovered ? gif.url : (gif.thumbnailUrl || gif.url)}
          alt={gif.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-sm font-medium text-white truncate">{gif.title}</p>
            
            {showStats && (
              <div className="flex items-center gap-3 mt-1 text-xs text-white/80">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {formatNumber(gif.views)}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {formatNumber(favoriteCount)}
                </span>
              </div>
            )}
          </div>
          
          {/* Quick actions */}
          {showQuickActions && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <QuickActionButton onClick={copyUrl} icon={<Copy className="h-3 w-3" />} />
              <QuickActionButton onClick={downloadGif} icon={<Download className="h-3 w-3" />} />
              <QuickActionButton onClick={shareGif} icon={<Share2 className="h-3 w-3" />} />
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}

function QuickActionButton({ 
  onClick, 
  icon 
}: { 
  onClick: (e: React.MouseEvent) => void
  icon: React.ReactNode 
}) {
  return (
    <Button
      size="icon"
      variant="secondary"
      className="h-7 w-7 bg-black/50 hover:bg-black/70 border-0 text-white"
      onClick={onClick}
    >
      {icon}
    </Button>
  )
}

// Skeleton for loading state
export function GifCardSkeleton() {
  return <Skeleton className="aspect-square rounded-lg" />
}

// Helper to format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return String(num)
}
