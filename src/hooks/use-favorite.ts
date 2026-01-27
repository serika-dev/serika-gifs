'use client'

import { useState, useCallback } from 'react'
import { API_ENDPOINTS } from '@/lib/constants'
import { useAuth } from '@/contexts/auth-context'

interface UseFavoriteOptions {
  gifId: string
  initialFavorited?: boolean
  initialCount?: number
}

interface UseFavoriteReturn {
  isFavorited: boolean
  favoriteCount: number
  isLoading: boolean
  toggle: () => Promise<void>
}

export function useFavorite(options: UseFavoriteOptions): UseFavoriteReturn {
  const { gifId, initialFavorited = false, initialCount = 0 } = options
  const { isAuthenticated } = useAuth()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [favoriteCount, setFavoriteCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)

  const toggle = useCallback(async () => {
    if (!isAuthenticated || isLoading) return

    setIsLoading(true)
    
    // Optimistic update
    const wasFavorited = isFavorited
    setIsFavorited(!wasFavorited)
    setFavoriteCount(prev => wasFavorited ? prev - 1 : prev + 1)

    try {
      const response = await fetch(`${API_ENDPOINTS.favorites.list}/${gifId}`, {
        method: wasFavorited ? 'DELETE' : 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        // Revert on error
        setIsFavorited(wasFavorited)
        setFavoriteCount(prev => wasFavorited ? prev + 1 : prev - 1)
      }
    } catch {
      // Revert on error
      setIsFavorited(wasFavorited)
      setFavoriteCount(prev => wasFavorited ? prev + 1 : prev - 1)
    } finally {
      setIsLoading(false)
    }
  }, [gifId, isAuthenticated, isFavorited, isLoading])

  return {
    isFavorited,
    favoriteCount,
    isLoading,
    toggle,
  }
}
