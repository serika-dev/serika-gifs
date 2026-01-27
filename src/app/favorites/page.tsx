'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/header'
import { GifCard, GifCardSkeleton } from '@/components/gif-card'
import { useRequireAuth } from '@/contexts/auth-context'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import type { Gif } from '@/hooks/use-gifs'

export default function FavoritesPage() {
  const { user, isLoading: authLoading } = useRequireAuth()
  const [favorites, setFavorites] = useState<Gif[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchFavorites = async () => {
      try {
        const response = await fetch('/api/favorites')
        const data = await response.json()
        setFavorites(data.favorites || [])
      } catch {
        toast.error('Failed to load favorites')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFavorites()
  }, [user])

  if (authLoading) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Heart className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">My Favorites</h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <GifCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Heart className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No favorites yet</p>
            <p className="text-sm">Start exploring and save your favorite GIFs!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {favorites.map((gif) => (
              <GifCard key={gif.id} gif={gif} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
