'use client'

import { useState, useCallback } from 'react'
import { API_ENDPOINTS } from '@/lib/constants'

export interface Gif {
  id: string
  slug: string
  title: string
  description?: string | null
  url: string
  thumbnailUrl?: string | null
  width: number
  height: number
  size: number
  views: number
  source: string
  createdAt: string
  user?: {
    id: string
    username: string
    avatar?: string | null
  }
  tags?: {
    id: string
    name: string
    slug: string
  }[]
  _count?: {
    favorites: number
  }
}

interface UseGifsOptions {
  initialGifs?: Gif[]
  limit?: number
}

interface UseGifsReturn {
  gifs: Gif[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  searchGifs: (query: string) => Promise<void>
}

export function useGifs(options: UseGifsOptions = {}): UseGifsReturn {
  const { initialGifs = [], limit = 20 } = options
  const [gifs, setGifs] = useState<Gif[]>(initialGifs)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const fetchGifs = useCallback(async (reset = false, search?: string) => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ limit: String(limit) })
      if (!reset && cursor) {
        params.set('cursor', cursor)
      }
      if (search) {
        params.set('q', search)
      }

      const url = search 
        ? `${API_ENDPOINTS.gifs.search}?${params}` 
        : `${API_ENDPOINTS.gifs.list}?${params}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.gifs) {
        setGifs(reset ? data.gifs : prev => [...prev, ...data.gifs])
        setCursor(data.nextCursor || null)
        setHasMore(!!data.nextCursor)
      }
    } catch (err) {
      setError('Failed to load GIFs')
      console.error('Error fetching GIFs:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, cursor, limit])

  const loadMore = useCallback(() => fetchGifs(false), [fetchGifs])
  const refresh = useCallback(() => fetchGifs(true), [fetchGifs])
  const searchGifs = useCallback((query: string) => fetchGifs(true, query), [fetchGifs])

  return {
    gifs,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    searchGifs,
  }
}
