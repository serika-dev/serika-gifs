'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
}

export function GifCard({ 
  gif, 
  showStats = true, 
  showQuickActions = true,
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
        className="group relative aspect-square overflow-hidden border-border/50 bg-muted cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 active:scale-[0.98]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setTimeout(() => setIsHovered(false), 2000)}
      >
        {/* Image with next/image for optimization */}
        <Image
          src={isHovered ? gif.url : (gif.thumbnailUrl || gif.url)}
          alt={gif.title || 'Animated GIF'}
          fill
          className="object-cover"
          sizes="(max-width: 480px) 50vw, (max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
          unoptimized
        />
        
        {/* Overlay - always visible on mobile touch */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
            <p className="text-xs sm:text-sm font-medium text-white truncate">{gif.title}</p>
            
            {showStats && (
              <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/80">
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {formatNumber(gif.views)}
                </span>
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Heart className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {formatNumber(favoriteCount)}
                </span>
              </div>
            )}
          </div>
          
          {/* Quick actions - larger touch targets on mobile */}
          {showQuickActions && (
            <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <QuickActionButton onClick={copyUrl} icon={<Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} />
              <QuickActionButton onClick={downloadGif} icon={<Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} />
              <QuickActionButton onClick={shareGif} icon={<Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />} />
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
      className="h-7 w-7 sm:h-7 sm:w-7 min-h-[28px] min-w-[28px] bg-black/50 hover:bg-black/70 active:bg-black/80 border-0 text-white touch-manipulation"
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
