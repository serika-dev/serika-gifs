'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Search, 
  Download, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Image as ImageIcon,
  History,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Link as LinkIcon,
  TrendingUp,
  Zap,
  Trash2,
  Flame,
  Clock,
  Play,
  Hash,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

interface GifPreview {
  id: string
  title: string
  url: string
  preview: string
  mp4Preview?: string
  sourceUrl?: string
  alreadyImported?: boolean
  tags?: string[]
}

interface ImportJob {
  id: string
  source: string
  status: string
  query: string
  totalItems: number
  importedItems: number
  failedItems: number
  createdAt: string
  completedAt?: string
}

interface PaginationInfo {
  currentPage: number
  totalCount: number
  hasNextPage: boolean
  nextPos?: string
}

interface ImportStats {
  totalImported: number
  totalFailed: number
  totalSkipped: number
}

// Popular search categories for quick access
const QUICK_CATEGORIES = [
  { label: 'Reactions', queries: ['reaction', 'mood', 'feeling', 'emotion'] },
  { label: 'Memes', queries: ['meme', 'funny', 'lol', 'humor'] },
  { label: 'Anime', queries: ['anime', 'manga', 'kawaii', 'otaku'] },
  { label: 'Movies', queries: ['movie', 'cinema', 'film', 'scene'] },
  { label: 'Celebs', queries: ['celebrity', 'famous', 'star', 'actor'] },
  { label: 'Animals', queries: ['cat', 'dog', 'cute animals', 'pet'] },
  { label: 'Sports', queries: ['sports', 'football', 'basketball', 'soccer'] },
  { label: 'Gaming', queries: ['gaming', 'video game', 'gamer', 'esports'] },
]

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState('tenor')
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [maxPages, setMaxPages] = useState('5')
  const [isSearching, setIsSearching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingMultiple, setIsImportingMultiple] = useState(false)
  const [isImportingUrl, setIsImportingUrl] = useState(false)
  const [isLoadingTrending, setIsLoadingTrending] = useState(false)
  const [previews, setPreviews] = useState<GifPreview[]>([])
  const [trendingTerms, setTrendingTerms] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [autoImport, setAutoImport] = useState(false)
  const [importStats, setImportStats] = useState<ImportStats>({ totalImported: 0, totalFailed: 0, totalSkipped: 0 })
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [showUrlImport, setShowUrlImport] = useState(false)
  const [hoveredGif, setHoveredGif] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalCount: 0,
    hasNextPage: false,
  })
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load trending terms on mount and tab change
  useEffect(() => {
    loadTrendingTerms()
  }, [activeTab])

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('importRecentSearches')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch {
        // ignore
      }
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Cmd/Ctrl + T to load trending
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        handleLoadTrending()
      }
      // Cmd/Ctrl + Enter to import
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && previews.length > 0) {
        e.preventDefault()
        handleImport()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previews])

  const loadTrendingTerms = async () => {
    try {
      const response = await fetch(`/api/admin/import/${activeTab}?trending_terms=true`)
      const data = await response.json()
      if (data.terms) {
        setTrendingTerms(data.terms.slice(0, 12))
      }
    } catch {
      // Silently fail - trending terms are optional
    }
  }

  const saveRecentSearch = (query: string) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 8)
    setRecentSearches(updated)
    localStorage.setItem('importRecentSearches', JSON.stringify(updated))
  }

  const handleSearch = useCallback(async (query?: string, resetPage: boolean = true, pos?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) {
      toast.error('Please enter a search query')
      return
    }

    if (query) {
      setSearchQuery(query)
    }
    saveRecentSearch(searchTerm)
    
    setIsSearching(true)
    
    const pageNum = resetPage ? 1 : pagination.currentPage + 1
    if (resetPage) {
      setPreviews([])
    }

    try {
      const params = new URLSearchParams({
        query: searchTerm,
        limit: '36',
      })
      if (pos) {
        params.set('pos', pos)
      }

      const response = await fetch(`/api/admin/import/${activeTab}?${params}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      const results = data.results || []
      setPreviews(results)
      setPagination({
        currentPage: pageNum,
        totalCount: data.totalCount || results.length || 0,
        hasNextPage: data.hasNextPage || false,
        nextPos: data.nextPos,
      })
      
      if (results.length === 0) {
        toast.info('No results found')
      } else if (autoImport && results.some((r: GifPreview) => !r.alreadyImported)) {
        handleImport(searchTerm)
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, activeTab, pagination.currentPage, autoImport])

  const handleLoadTrending = async () => {
    setIsLoadingTrending(true)
    
    try {
      const params = new URLSearchParams({ 
        trending: 'true',
        limit: '36',
      })
      
      const response = await fetch(`/api/admin/import/${activeTab}?${params}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setSearchQuery('')
      setPreviews(data.results || [])
      setPagination({
        currentPage: 1,
        totalCount: data.totalCount || data.results?.length || 0,
        hasNextPage: data.hasNextPage || false,
        nextPos: data.nextPos,
      })
      
      toast.success(`🔥 Loaded ${data.results?.length || 0} trending GIFs`)
    } catch {
      toast.error('Failed to load trending')
    } finally {
      setIsLoadingTrending(false)
    }
  }

  const handleQuickCategory = (category: typeof QUICK_CATEGORIES[0]) => {
    const randomQuery = category.queries[Math.floor(Math.random() * category.queries.length)]
    handleSearch(randomQuery)
  }

  const handleImportUrl = async () => {
    const urls = urlInput.trim().split('\n').filter(u => u.trim())
    if (urls.length === 0) {
      toast.error('Please enter at least one URL')
      return
    }

    setIsImportingUrl(true)
    let imported = 0
    let failed = 0
    
    for (let i = 0; i < urls.length; i++) {
      setImportProgress({ current: i + 1, total: urls.length })
      try {
        const response = await fetch('/api/gifs', {
          method: 'POST',
          body: JSON.stringify({ 
            url: urls[i].trim(),
            title: `Imported from URL`,
            isPublic: true,
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        
        if (response.ok) {
          imported++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }
    
    setImportProgress(null)
    setImportStats(prev => ({
      totalImported: prev.totalImported + imported,
      totalFailed: prev.totalFailed + failed,
      totalSkipped: prev.totalSkipped,
    }))
    
    toast.success(`✅ Imported ${imported} URLs (${failed} failed)`)
    setUrlInput('')
    setShowUrlImport(false)
    loadImportJobs()
    setIsImportingUrl(false)
  }

  const handleImport = async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim() && previews.length === 0) {
      toast.error('Please search for GIFs first')
      return
    }

    setIsImporting(true)

    try {
      const response = await fetch(`/api/admin/import/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchTerm || 'trending', 
          limit: 36,
        }),
      })
      
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setImportStats(prev => ({
        totalImported: prev.totalImported + (data.imported || 0),
        totalFailed: prev.totalFailed + (data.failed || 0),
        totalSkipped: prev.totalSkipped + (data.skipped || 0),
      }))

      toast.success(`⚡ Imported ${data.imported} GIFs (${data.skipped || 0} skipped)`)
      loadImportJobs()
      
      // Refresh previews
      if (searchTerm.trim()) {
        handleSearch(searchTerm, true)
      } else {
        handleLoadTrending()
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportMultiplePages = async () => {
    const searchTerm = searchQuery
    if (!searchTerm.trim()) {
      toast.error('Please enter a search query')
      return
    }

    const pagesToImport = parseInt(maxPages) || 5
    setIsImportingMultiple(true)
    let totalImported = 0
    let totalFailed = 0
    let totalSkipped = 0
    let currentPos: string | undefined
    let pageCount = 0

    try {
      while (pageCount < pagesToImport) {
        setImportProgress({ current: pageCount + 1, total: pagesToImport })
        
        const response = await fetch(`/api/admin/import/${activeTab}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchTerm, 
            limit: 50,
            pos: currentPos 
          }),
        })
        
        const data = await response.json()

        if (data.error) {
          toast.error(data.error)
          break
        }

        totalImported += data.imported || 0
        totalFailed += data.failed || 0
        totalSkipped += data.skipped || 0
        pageCount++

        if (!data.hasNextPage || !data.nextPos) {
          break
        }
        currentPos = data.nextPos
        
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      setImportProgress(null)
      setImportStats(prev => ({
        totalImported: prev.totalImported + totalImported,
        totalFailed: prev.totalFailed + totalFailed,
        totalSkipped: prev.totalSkipped + totalSkipped,
      }))

      toast.success(`🚀 ${totalImported} imported from ${pageCount} pages!`)
      loadImportJobs()
      handleSearch(searchTerm, true)
    } catch {
      toast.error('Import failed')
    } finally {
      setImportProgress(null)
      setIsImportingMultiple(false)
    }
  }

  const clearStats = () => {
    setImportStats({ totalImported: 0, totalFailed: 0, totalSkipped: 0 })
  }

  const loadImportJobs = async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch('/api/admin/import/jobs?limit=10')
      const data = await response.json()
      setImportJobs(data.jobs || [])
    } catch {
      console.error('Failed to load import jobs')
    } finally {
      setIsLoadingJobs(false)
    }
  }

  useEffect(() => {
    loadImportJobs()
  }, [])

  const loadNextPage = () => {
    if (pagination.hasNextPage && pagination.nextPos) {
      handleSearch(searchQuery, false, pagination.nextPos)
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'tenor': return '🎬'
      case 'giphy': return '✨'
      case 'klipy': return '🎯'
      default: return '📦'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'PROCESSING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'FAILED': return 'bg-destructive/10 text-destructive border-destructive/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const newCount = previews.filter(p => !p.alreadyImported).length

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Import GIFs
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd> search
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘T</kbd> trending
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">⌘↵</kbd> import
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">← Admin</Button>
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        {(importStats.totalImported > 0 || importProgress) && (
          <div className="mb-6 p-3 rounded-md bg-muted border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {importProgress ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">
                    Importing page {importProgress.current} of {importProgress.total}...
                  </span>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {importStats.totalImported} imported
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    {importStats.totalSkipped} skipped
                  </span>
                  {importStats.totalFailed > 0 && (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <XCircle className="h-4 w-4" />
                      {importStats.totalFailed} failed
                    </span>
                  )}
                </div>
              )}
              {!importProgress && (
                <Button variant="ghost" size="sm" onClick={clearStats} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Source Tabs + Search */}
            <Card className="overflow-hidden">
              <div className="p-4 space-y-4">
                {/* Source Tabs */}
                <Tabs value={activeTab} onValueChange={(tab) => {
                  setActiveTab(tab)
                  setPreviews([])
                  setSearchQuery('')
                  setPagination({ currentPage: 1, totalCount: 0, hasNextPage: false })
                }}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <TabsList className="h-9">
                      <TabsTrigger value="tenor" className="text-sm px-4">🎬 Tenor</TabsTrigger>
                      <TabsTrigger value="giphy" className="text-sm px-4">✨ Giphy</TabsTrigger>
                      <TabsTrigger value="klipy" className="text-sm px-4">🎯 Klipy</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="auto-import"
                          checked={autoImport}
                          onCheckedChange={setAutoImport}
                        />
                        <Label htmlFor="auto-import" className="text-xs text-muted-foreground cursor-pointer">
                          Auto-import
                        </Label>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUrlImport(!showUrlImport)}
                        className="h-8"
                      >
                        <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                        URL
                      </Button>
                    </div>
                  </div>
                </Tabs>

                {/* URL Import Dropdown */}
                {showUrlImport && (
                  <div className="p-4 bg-muted rounded-md border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Import from URLs</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowUrlImport(false)} className="h-7 w-7 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Paste GIF/MP4 URLs (one per line)..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {urlInput.trim().split('\n').filter(u => u.trim()).length} URLs
                      </span>
                      <Button onClick={handleImportUrl} disabled={isImportingUrl || !urlInput.trim()} size="sm">
                        {isImportingUrl ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        Import URLs
                      </Button>
                    </div>
                  </div>
                )}

                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search GIFs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10 h-11 text-base"
                    />
                  </div>
                  <Button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="h-11 px-6"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                  </Button>
                  <Button
                    onClick={handleLoadTrending}
                    disabled={isLoadingTrending}
                    variant="outline"
                    className="h-11"
                    title="Load Trending"
                  >
                    {isLoadingTrending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4 text-orange-500" />}
                  </Button>
                </div>

                {/* Quick Categories */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickCategory(cat)}
                      className="h-7 text-xs"
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>

                {/* Trending Terms */}
                {trendingTerms.length > 0 && !previews.length && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Trending searches</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {trendingTerms.map((term) => (
                        <Badge
                          key={term}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => handleSearch(term)}
                        >
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && !previews.length && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Recent searches</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((term) => (
                        <Badge
                          key={term}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleSearch(term)}
                        >
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Results */}
              {(previews.length > 0 || isSearching) && (
                <div className="border-t border-border">
                  {/* Import Actions Bar */}
                  {previews.length > 0 && (
                    <div className="p-3 bg-muted/50 border-b border-border flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {previews.length} results
                        </span>
                        {newCount > 0 && (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-500">
                            {newCount} new
                          </Badge>
                        )}
                        {previews.length - newCount > 0 && (
                          <Badge variant="secondary">
                            {previews.length - newCount} imported
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleImport()}
                          disabled={isImporting || newCount === 0}
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isImporting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          Import {newCount}
                        </Button>
                        
                        <div className="flex items-center gap-1.5">
                          <Select value={maxPages} onValueChange={setMaxPages}>
                            <SelectTrigger className="h-8 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 5, 10, 20, 30, 50].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n} pg</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleImportMultiplePages}
                            disabled={isImportingMultiple || !searchQuery.trim()}
                            variant="secondary"
                            size="sm"
                          >
                            {isImportingMultiple ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <ChevronsRight className="h-4 w-4 mr-1" />
                            )}
                            Bulk
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grid */}
                  <div className="p-3">
                    <GifGrid 
                      previews={previews} 
                      isLoading={isSearching} 
                      hoveredGif={hoveredGif}
                      setHoveredGif={setHoveredGif}
                    />
                  </div>

                  {/* Pagination */}
                  {pagination.hasNextPage && (
                    <div className="p-3 border-t border-border flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSearch(searchQuery, true)}
                        disabled={isSearching}
                        size="sm"
                      >
                        <ChevronsLeft className="h-4 w-4 mr-1" />
                        First
                      </Button>
                      <span className="px-3 text-sm text-muted-foreground">
                        Page {pagination.currentPage}
                      </span>
                      <Button
                        variant="outline"
                        onClick={loadNextPage}
                        disabled={!pagination.hasNextPage || isSearching}
                        size="sm"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!previews.length && !isSearching && (
                <div className="p-12 text-center border-t border-border">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-muted mb-3">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium mb-1">Search or load trending</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Find GIFs from {activeTab === 'tenor' ? 'Tenor' : activeTab === 'giphy' ? 'Giphy' : 'Klipy'} to import
                  </p>
                  <Button onClick={handleLoadTrending} disabled={isLoadingTrending}>
                    {isLoadingTrending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Flame className="h-4 w-4 mr-2" />}
                    Load Trending
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Recent Imports */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Imports
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadImportJobs}
                    disabled={isLoadingJobs}
                    className="h-7 w-7 p-0"
                  >
                    {isLoadingJobs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-2">
                  {isLoadingJobs ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))
                  ) : importJobs.length === 0 ? (
                    <p className="text-muted-foreground text-xs text-center py-4">
                      No imports yet
                    </p>
                  ) : (
                    importJobs.slice(0, 6).map((job) => (
                      <div
                        key={job.id}
                        className="p-2.5 rounded-md border border-border bg-card space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs">{getSourceIcon(job.source)}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(job.status)}`}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium truncate">{job.query}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="text-emerald-500">+{job.importedItems}</span>
                          <span className="text-destructive">-{job.failedItems}</span>
                          <span>/{job.totalItems}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

interface GifGridProps {
  previews: GifPreview[]
  isLoading: boolean
  hoveredGif: string | null
  setHoveredGif: (id: string | null) => void
}

function GifGrid({ previews, isLoading, hoveredGif, setHoveredGif }: GifGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {previews.map((gif) => (
        <div
          key={gif.id}
          className={`relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer transition-all duration-200 ${
            gif.alreadyImported 
              ? 'border-green-500/50 opacity-50 grayscale hover:opacity-70 hover:grayscale-0' 
              : 'border-border/50 hover:border-primary/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10'
          }`}
          onMouseEnter={() => setHoveredGif(gif.id)}
          onMouseLeave={() => setHoveredGif(null)}
        >
          {/* Show MP4 on hover if available */}
          {hoveredGif === gif.id && gif.mp4Preview ? (
            <video
              src={gif.mp4Preview}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Image
              src={gif.preview || gif.url}
              alt={gif.title || 'GIF preview'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
              unoptimized
            />
          )}
          
          {/* Imported Badge */}
          {gif.alreadyImported && (
            <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-md p-0.5">
              <CheckCircle className="h-3 w-3 text-white" />
            </div>
          )}
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
            <p className="text-[10px] text-white line-clamp-2 leading-tight">{gif.title}</p>
            {gif.tags && gif.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-1 overflow-hidden">
                <Hash className="h-2.5 w-2.5 text-white/60 shrink-0" />
                <span className="text-[9px] text-white/60 truncate">{gif.tags.slice(0, 2).join(', ')}</span>
              </div>
            )}
          </div>
          
          {/* Play indicator for videos */}
          {gif.mp4Preview && hoveredGif !== gif.id && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/60 rounded-md p-1">
              <Play className="h-2.5 w-2.5 text-white fill-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
