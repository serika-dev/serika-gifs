'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserGifs } from '@/components/user-gifs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, X, SlidersHorizontal, Image as ImageIcon, Folder } from 'lucide-react'

interface ProfileContentProps {
  userId: string
  username: string
}

export function ProfileContent({ userId, username }: ProfileContentProps) {
  const [searchVal, setSearchVal] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'popular' | 'most-viewed' | 'trending'>('newest')
  const [activeTab, setActiveTab] = useState('gifs')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchVal.trim())
  }

  const clearSearch = () => {
    setSearchVal('')
    setSearchQuery('')
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        {/* Left side: Search bar & Sort icon */}
        <div className="flex items-center gap-2 w-full md:max-w-md">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              inputMode="search"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder={`Search ${username}'s GIFs...`}
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-background text-sm transition-all focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            {searchVal && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Sort Button next to search bar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" title="Sort GIFs">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem 
                onClick={() => setSortOrder('newest')}
                className={sortOrder === 'newest' ? 'bg-accent font-medium' : ''}
              >
                Newest
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortOrder('popular')}
                className={sortOrder === 'popular' ? 'bg-accent font-medium' : ''}
              >
                Popular
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortOrder('most-viewed')}
                className={sortOrder === 'most-viewed' ? 'bg-accent font-medium' : ''}
              >
                Most Viewed
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortOrder('trending')}
                className={sortOrder === 'trending' ? 'bg-accent font-medium' : ''}
              >
                Trending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side: Tabs list */}
        <TabsList className="grid grid-cols-2 w-full md:w-auto">
          <TabsTrigger value="gifs">
            <ImageIcon className="h-4 w-4 mr-2" />
            GIFs
          </TabsTrigger>
          <TabsTrigger value="collections">
            <Folder className="h-4 w-4 mr-2" />
            Collections
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="gifs" className="mt-0">
        <UserGifs userId={userId} username={username} search={searchQuery} sort={sortOrder} />
      </TabsContent>

      <TabsContent value="collections" className="mt-0">
        <div className="text-center py-16 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border/50">
          <Folder className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Collections coming soon</p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
