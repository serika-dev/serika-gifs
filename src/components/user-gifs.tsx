'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { GifGrid } from '@/components/gif-grid'

interface UserGifsProps {
  userId: string
  username: string
}

export function UserGifs({ userId, username }: UserGifsProps) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(input.trim())
  }

  const clear = () => {
    setInput('')
    setQuery('')
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Search ${username}'s GIFs...`}
          className="w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-background text-sm transition-all focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        {input && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <GifGrid
        userId={userId}
        search={query || undefined}
        sort="newest"
        emptyMessage={
          query
            ? `No GIFs from ${username} match "${query}"`
            : `${username} hasn't uploaded any GIFs yet`
        }
        emptySubMessage={query ? 'Try a different search term.' : 'Check back later!'}
      />
    </div>
  )
}
