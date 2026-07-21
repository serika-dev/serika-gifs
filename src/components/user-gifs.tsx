'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { GifGrid } from '@/components/gif-grid'

interface UserGifsProps {
  userId: string
  username: string
  search?: string
  sort?: 'newest' | 'oldest'
}

export function UserGifs({ userId, username, search, sort = 'newest' }: UserGifsProps) {
  return (
    <div className="space-y-6">
      <GifGrid
        userId={userId}
        search={search || undefined}
        sort={sort}
        emptyMessage={
          search
            ? `No GIFs from ${username} match "${search}"`
            : `${username} hasn't uploaded any GIFs yet`
        }
        emptySubMessage={search ? 'Try a different search term.' : 'Check back later!'}
      />
    </div>
  )
}
