'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  Flame, 
  Clock, 
  Heart, 
  Eye,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'

type SortOption = 'trending' | 'newest' | 'popular' | 'most-viewed'
type TimeRange = 'day' | 'week' | 'month' | 'all'

export default function TrendingPage() {
  const [sort, setSort] = useState<SortOption>('trending')
  const [timeRange, setTimeRange] = useState<TimeRange>('week')

  const sortOptions = [
    { value: 'trending', label: 'Trending', icon: TrendingUp },
    { value: 'newest', label: 'Newest', icon: Clock },
    { value: 'popular', label: 'Most Favorited', icon: Heart },
    { value: 'most-viewed', label: 'Most Viewed', icon: Eye },
  ]

  const timeRangeOptions = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ]

  const currentSort = sortOptions.find(s => s.value === sort)
  const SortIcon = currentSort?.icon || TrendingUp

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <SortIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {currentSort?.label || 'Trending'} GIFs
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {sort === 'trending' && 'The most popular GIFs right now'}
                {sort === 'newest' && 'Fresh GIFs just uploaded'}
                {sort === 'popular' && 'GIFs with the most favorites'}
                {sort === 'most-viewed' && 'The most watched GIFs'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
          {/* Sort Tabs - Desktop */}
          <div className="hidden sm:block">
            <Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <TabsList className="h-10">
                {sortOptions.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Sort Select - Mobile */}
          <div className="sm:hidden">
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <SortIcon className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range Filter */}
          <div className="sm:ml-auto">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <Link href="/tags">
            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 whitespace-nowrap">
              🏷️ Browse Tags
            </Badge>
          </Link>
          <Link href="/collections">
            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 whitespace-nowrap">
              📁 Collections
            </Badge>
          </Link>
          <Link href="/favorites">
            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 whitespace-nowrap">
              ❤️ Favorites
            </Badge>
          </Link>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-primary/10 whitespace-nowrap"
          >
            🔥 Hot Today
          </Badge>
        </div>

        {/* GIF Grid */}
        <GifGrid 
          emptyMessage="No GIFs found"
          emptySubMessage="Check back later for new content!"
        />

        {/* Stats Section */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold">1.2K</p>
            <p className="text-sm text-muted-foreground">Trending Today</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <Eye className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">50K</p>
            <p className="text-sm text-muted-foreground">Views Today</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <Heart className="h-6 w-6 mx-auto mb-2 text-pink-500" />
            <p className="text-2xl font-bold">3.5K</p>
            <p className="text-sm text-muted-foreground">Favorites Today</p>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">+24%</p>
            <p className="text-sm text-muted-foreground">Growth This Week</p>
          </div>
        </div>
      </main>
    </div>
  )
}
