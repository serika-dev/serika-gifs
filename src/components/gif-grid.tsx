'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { GifCard, GifCardSkeleton } from '@/components/gif-card'
import type { Gif } from '@/hooks/use-gifs'

interface GifGridProps {
  initialGifs?: Gif[]
  search?: string
  tag?: string
  userId?: string
  source?: string
  emptyMessage?: string
  emptySubMessage?: string
  columns?: 'default' | 'compact' | 'wide'
}

export function GifGrid({ 
  initialGifs, 
  search, 
  tag, 
  userId, 
  source,
  emptyMessage = 'No GIFs found',
  emptySubMessage = 'Try a different search or upload some GIFs!',
  columns = 'default',
}: GifGridProps) {
  const [gifs, setGifs] = useState<Gif[]>(initialGifs || [])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(!initialGifs)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Responsive grid classes with better mobile support
  const gridClasses = {
    default: 'grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    compact: 'grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
    wide: 'grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  }

  const fetchGifs = useCallback(async (pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '24',
      })

      if (search) params.set('search', search)
      if (tag) params.set('tag', tag)
      if (userId) params.set('userId', userId)
      if (source) params.set('source', source)

      const response = await fetch(`/api/gifs?${params}`)
      const data = await response.json()

      if (append) {
        setGifs((prev) => [...prev, ...data.gifs])
      } else {
        setGifs(data.gifs)
      }

      setHasMore(data.pagination.page < data.pagination.totalPages)
    } catch {
      toast.error('Failed to load GIFs')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [search, tag, userId, source])

  useEffect(() => {
    if (!initialGifs) {
      fetchGifs(1)
    }
  }, [fetchGifs, initialGifs])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchGifs(nextPage, true)
  }

  if (isLoading) {
    return (
      <div className={`grid ${gridClasses[columns]} gap-2 sm:gap-3`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <GifCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (gifs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground px-4">
        <p className="text-base sm:text-lg text-center">{emptyMessage}</p>
        <p className="text-xs sm:text-sm text-center mt-1">{emptySubMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`grid ${gridClasses[columns]} gap-2 sm:gap-3`}>
        {gifs.map((gif) => (
          <GifCard key={gif.id} gif={gif} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="w-full sm:w-auto min-w-[140px]"
            size="lg"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
