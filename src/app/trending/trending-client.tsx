'use client'

import { useState, useEffect } from 'react'
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
  Clock,
  Heart,
  Eye,
  Calendar,
  Shuffle,
} from 'lucide-react'
import Link from 'next/link'

type SortOption = 'trending' | 'newest' | 'popular' | 'most-viewed' | 'random'
type TimeRange = 'day' | 'week' | 'month' | 'all'

export default function TrendingPageClient() {
  const [sort, setSort] = useState<SortOption>('trending')
  const [timeRange, setTimeRange] = useState<TimeRange>('week')

  const [stats, setStats] = useState({
    trendingToday: 0,
    totalViews: 0,
    favoritesToday: 0,
    growth: '0%',
  })

  useEffect(() => {
    fetch('/api/stats/trending')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setStats(data)
        }
      })
      .catch(console.error)
  }, [])

  const formatNumber = (num: number) => {
    return Intl.NumberFormat('en-US', { notation: 'compact' }).format(num)
  }

  const sortOptions = [
    { value: 'trending', label: 'Trending', icon: TrendingUp },
    { value: 'newest', label: 'Newest', icon: Clock },
    { value: 'popular', label: 'Most Favorited', icon: Heart },
    { value: 'most-viewed', label: 'Most Viewed', icon: Eye },
    { value: 'random', label: 'Shuffle', icon: Shuffle },
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
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">
          {currentSort?.label || 'Trending'} GIFs
        </h1>
        <p className="text-sm text-muted-foreground">
          {sort === 'trending' && 'The most popular GIFs right now'}
          {sort === 'newest' && 'Fresh GIFs just uploaded'}
          {sort === 'popular' && 'GIFs with the most favorites'}
          {sort === 'most-viewed' && 'The most watched GIFs'}
          {sort === 'random' && 'Random selection of GIFs'}
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Sort Tabs - Desktop */}
        <div className="hidden sm:block">
          <Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <TabsList>
              {sortOptions.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
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
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
        <Link href="/tags">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent whitespace-nowrap">
            Browse Tags
          </Badge>
        </Link>
        <Link href="/collections">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent whitespace-nowrap">
            Collections
          </Badge>
        </Link>
        <Link href="/favorites">
          <Badge variant="outline" className="cursor-pointer hover:bg-accent whitespace-nowrap">
            Favorites
          </Badge>
        </Link>
      </div>

      {/* GIF Grid */}
      <GifGrid
        sort={sort}
        timeRange={timeRange}
        emptyMessage="No GIFs found"
        emptySubMessage="Check back later for new content!"
      />

      {/* Stats Section */}
      <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="text-2xl font-semibold">{formatNumber(stats.trendingToday)}</p>
          <p className="text-sm text-muted-foreground mt-1">Trending Today</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="text-2xl font-semibold">{formatNumber(stats.totalViews)}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Views</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="text-2xl font-semibold">{formatNumber(stats.favoritesToday)}</p>
          <p className="text-sm text-muted-foreground mt-1">Favorites Today</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border text-center">
          <p className="text-2xl font-semibold">{stats.growth}</p>
          <p className="text-sm text-muted-foreground mt-1">Growth This Week</p>
        </div>
      </div>
    </>
  )
}
