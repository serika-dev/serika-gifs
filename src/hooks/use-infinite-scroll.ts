'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface UseInfiniteScrollOptions {
  onLoadMore: () => Promise<void>
  hasMore: boolean
  isLoading: boolean
  threshold?: number
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const { onLoadMore, hasMore, isLoading, threshold = 100 } = options
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [sentinelRef, setSentinelRef] = useState<HTMLDivElement | null>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore()
      }
    },
    [hasMore, isLoading, onLoadMore]
  )

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: `${threshold}px`,
    })

    if (sentinelRef) {
      observerRef.current.observe(sentinelRef)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [sentinelRef, handleIntersect, threshold])

  return { sentinelRef: setSentinelRef }
}
