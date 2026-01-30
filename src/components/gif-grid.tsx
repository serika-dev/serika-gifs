'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { GifCard, GifCardSkeleton } from '@/components/gif-card'
import type { Gif } from '@/hooks/use-gifs'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface GifGridProps {
  initialGifs?: Gif[]
  search?: string
  tag?: string
  userId?: string
  source?: string
  sort?: 'trending' | 'newest' | 'popular' | 'most-viewed' | 'random'
  timeRange?: 'day' | 'week' | 'month' | 'all'
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
  sort = 'trending',
  timeRange = 'all',
  emptyMessage = 'No GIFs found',
  emptySubMessage = 'Try a different search or upload some GIFs!',
  columns = 'default',
}: GifGridProps) {
  const [gifs, setGifs] = useState<Gif[]>(initialGifs || [])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(!initialGifs)

  // Responsive grid classes with better mobile support
  const gridClasses = {
    default: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    compact: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
    wide: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  }

  const fetchGifs = useCallback(async (pageNum: number) => {
    setIsLoading(true)

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
      })

      if (search) params.set('search', search)
      if (tag) params.set('tag', tag)
      if (userId) params.set('userId', userId)
      if (source) params.set('source', source)
      if (sort) params.set('sort', sort)
      if (timeRange) params.set('timeRange', timeRange)

      const response = await fetch(`/api/gifs?${params}`)
      const data = await response.json()

      setGifs(data.gifs)
      setTotalPages(data.pagination.totalPages)

      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Failed to load GIFs')
    } finally {
      setIsLoading(false)
    }
  }, [search, tag, userId, source, sort, timeRange])

  // Reset to page 1 and refetch when filters change - but only if not using initialGifs
  useEffect(() => {
    // Skip fetching if we have initialGifs and no search/filter params
    if (initialGifs && !search && !tag && !userId && !source) {
      return
    }
    setPage(1)
    fetchGifs(1)
  }, [search, tag, userId, source, sort, timeRange])

  const goToPage = (pageNum: number) => {
    setPage(pageNum)
    fetchGifs(pageNum)
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
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

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent className="flex-wrap gap-1">
            <PaginationItem>
              <PaginationPrevious
                onClick={() => page > 1 && goToPage(page - 1)}
                className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>

            {getPageNumbers().map((pageNum, idx) => (
              <PaginationItem key={idx}>
                {pageNum === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    onClick={() => goToPage(pageNum)}
                    isActive={page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() => page < totalPages && goToPage(page + 1)}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
