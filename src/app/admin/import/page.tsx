'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Settings2,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

interface GifPreview {
  id: string
  title: string
  url: string
  preview: string
  sourceUrl?: string
  alreadyImported?: boolean
  selected?: boolean
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [autoImport, setAutoImport] = useState(false)
  const [importStats, setImportStats] = useState<ImportStats>({ totalImported: 0, totalFailed: 0, totalSkipped: 0 })
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalCount: 0,
    hasNextPage: false,
  })

  const handleSearch = useCallback(async (resetPage: boolean = true, pos?: string) => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    setSelectedIds(new Set())
    
    // Reset on new search
    const pageNum = resetPage ? 1 : pagination.currentPage + 1
    if (resetPage) {
      setPreviews([])
    }

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '30',
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
      } else if (autoImport) {
        // Auto-import if enabled
        handleImportWithResults(results)
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, activeTab, pagination.currentPage, autoImport])

  const handleLoadTrending = async () => {
    setIsLoadingTrending(true)
    setSelectedIds(new Set())
    
    try {
      // Tenor has a featured/trending endpoint
      const params = new URLSearchParams({ limit: '30' })
      
      // For Tenor we can use a trending search
      const trendingQueries = ['trending', 'popular', 'viral', 'reaction', 'meme']
      const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)]
      params.set('query', randomQuery)
      
      const response = await fetch(`/api/admin/import/${activeTab}?${params}`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setSearchQuery(randomQuery)
      setPreviews(data.results || [])
      setPagination({
        currentPage: 1,
        totalCount: data.totalCount || data.results?.length || 0,
        hasNextPage: data.hasNextPage || false,
        nextPos: data.nextPos,
      })
      
      toast.success(`Loaded ${data.results?.length || 0} trending GIFs`)
    } catch {
      toast.error('Failed to load trending')
    } finally {
      setIsLoadingTrending(false)
    }
  }

  const handleImportUrl = async () => {
    const urls = urlInput.trim().split('\n').filter(u => u.trim())
    if (urls.length === 0) {
      toast.error('Please enter at least one URL')
      return
    }

    setIsImportingUrl(true)

    try {
      // Import each URL as a direct GIF
      let imported = 0
      let failed = 0
      
      for (const url of urls) {
        try {
          // Simple direct URL import via our upload API
          const response = await fetch('/api/gifs', {
            method: 'POST',
            body: JSON.stringify({ 
              url: url.trim(),
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
      
      setImportStats(prev => ({
        totalImported: prev.totalImported + imported,
        totalFailed: prev.totalFailed + failed,
        totalSkipped: prev.totalSkipped,
      }))
      
      toast.success(`Imported ${imported} URLs (${failed} failed)`)
      setUrlInput('')
      loadImportJobs()
    } catch {
      toast.error('URL import failed')
    } finally {
      setIsImportingUrl(false)
    }
  }

  const handleImportWithResults = async (results: GifPreview[]) => {
    // Filter out already imported
    const toImport = results.filter(r => !r.alreadyImported)
    if (toImport.length === 0) {
      toast.info('All GIFs already imported')
      return
    }
    
    // This triggers the normal import flow
    handleImport()
  }

  const handleImport = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsImporting(true)

    try {
      const response = await fetch(`/api/admin/import/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery, 
          limit: 30,
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

      toast.success(`Imported ${data.imported} GIFs (${data.skipped || 0} skipped, ${data.failed} failed)`)
      loadImportJobs()
      
      // Refresh previews to show updated import status
      if (searchQuery.trim()) {
        handleSearch(true)
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportMultiplePages = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    const pagesToImport = parseInt(maxPages) || 5
    if (pagesToImport < 1 || pagesToImport > 50) {
      toast.error('Please enter a number between 1 and 50')
      return
    }

    setIsImportingMultiple(true)
    let totalImported = 0
    let totalFailed = 0
    let totalSkipped = 0
    let currentPos: string | undefined
    let pageCount = 0

    try {
      while (pageCount < pagesToImport) {
        const response = await fetch(`/api/admin/import/${activeTab}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchQuery, 
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

        toast.info(`Page ${pageCount}/${pagesToImport}: +${data.imported} imported${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}`)

        // Check if there are more pages
        if (!data.hasNextPage || !data.nextPos) {
          toast.info('No more pages available')
          break
        }
        currentPos = data.nextPos
        
        // Small delay between pages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      setImportStats(prev => ({
        totalImported: prev.totalImported + totalImported,
        totalFailed: prev.totalFailed + totalFailed,
        totalSkipped: prev.totalSkipped + totalSkipped,
      }))

      toast.success(`Total: ${totalImported} imported, ${totalSkipped} skipped, ${totalFailed} failed from ${pageCount} pages`)
      loadImportJobs()
      
      // Refresh previews
      if (searchQuery.trim()) {
        handleSearch(true)
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImportingMultiple(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === previews.filter(p => !p.alreadyImported).length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(previews.filter(p => !p.alreadyImported).map(p => p.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
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

  // Load jobs on mount
  useEffect(() => {
    loadImportJobs()
  }, [])

  const loadNextPage = () => {
    if (pagination.hasNextPage && pagination.nextPos) {
      handleSearch(false, pagination.nextPos)
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'tenor': return 'Tenor'
      case 'giphy': return 'Giphy'
      case 'klipy': return 'Klipy'
      default: return source
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/10 text-green-500'
      case 'PROCESSING': return 'bg-yellow-500/10 text-yellow-500'
      case 'FAILED': return 'bg-red-500/10 text-red-500'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
        {/* Header with Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Import GIFs</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Import GIFs from Tenor, Giphy, Klipy, or URLs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Back to Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Session Stats Bar */}
        {(importStats.totalImported > 0 || importStats.totalFailed > 0 || importStats.totalSkipped > 0) && (
          <Card className="mb-6 border-border/50 bg-card/50">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{importStats.totalImported}</span> imported
                  </span>
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{importStats.totalSkipped}</span> skipped
                  </span>
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{importStats.totalFailed}</span> failed
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearStats} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear Stats
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 order-1 space-y-6">
            {/* Search Import Card */}
            <Card className="border-border/50">
              <CardHeader className="px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Search & Import
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Search GIF providers and bulk import
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-import" className="text-xs text-muted-foreground cursor-pointer">
                      Auto-import
                    </Label>
                    <Switch
                      id="auto-import"
                      checked={autoImport}
                      onCheckedChange={setAutoImport}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Tabs value={activeTab} onValueChange={(tab) => {
                  setActiveTab(tab)
                  setPreviews([])
                  setSearchQuery('')
                  setSelectedIds(new Set())
                  setPagination({ currentPage: 1, totalCount: 0, hasNextPage: false })
                }}>
                  <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 h-auto">
                    <TabsTrigger value="tenor" className="text-xs sm:text-sm py-2 sm:py-1.5">Tenor</TabsTrigger>
                    <TabsTrigger value="giphy" className="text-xs sm:text-sm py-2 sm:py-1.5">Giphy</TabsTrigger>
                    <TabsTrigger value="klipy" className="text-xs sm:text-sm py-2 sm:py-1.5">Klipy</TabsTrigger>
                  </TabsList>

                  <div className="space-y-4">
                    {/* Search controls */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <Label htmlFor="search" className="sr-only">Search</Label>
                        <Input
                          id="search"
                          placeholder={`Search ${getSourceLabel(activeTab)} for GIFs...`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch(true)}
                          className="bg-background/50 h-10 sm:h-9"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSearch(true)}
                          disabled={isSearching}
                          className="flex-1 sm:flex-none h-10 sm:h-9"
                        >
                          {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          <span className="ml-2">Search</span>
                        </Button>
                        <Button
                          onClick={handleLoadTrending}
                          disabled={isLoadingTrending || isSearching}
                          variant="outline"
                          className="h-10 sm:h-9"
                          title="Load trending GIFs"
                        >
                          {isLoadingTrending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Import controls */}
                    {previews.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={handleImport}
                            disabled={isImporting || isImportingMultiple || !searchQuery.trim()}
                            variant="default"
                            className="flex-1 sm:flex-none h-10 sm:h-9 bg-primary"
                          >
                            {isImporting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                            <span className="ml-2">Import Page ({previews.filter(p => !p.alreadyImported).length})</span>
                          </Button>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                          <div className="flex-1 flex gap-2 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-none sm:w-28">
                              <Label htmlFor="maxPages" className="sr-only">Max Pages</Label>
                              <Select value={maxPages} onValueChange={setMaxPages}>
                                <SelectTrigger className="h-10 sm:h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 page</SelectItem>
                                  <SelectItem value="2">2 pages</SelectItem>
                                  <SelectItem value="3">3 pages</SelectItem>
                                  <SelectItem value="5">5 pages</SelectItem>
                                  <SelectItem value="10">10 pages</SelectItem>
                                  <SelectItem value="20">20 pages</SelectItem>
                                  <SelectItem value="30">30 pages</SelectItem>
                                  <SelectItem value="50">50 pages</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              onClick={handleImportMultiplePages}
                              disabled={isImporting || isImportingMultiple || !searchQuery.trim()}
                              variant="secondary"
                              className="flex-1 sm:flex-none h-10 sm:h-9"
                            >
                              {isImportingMultiple ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ChevronsRight className="h-4 w-4" />
                              )}
                              <span className="ml-2">Bulk Import</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Results info */}
                    {previews.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>
                          Showing {previews.length} results ({previews.filter(p => p.alreadyImported).length} already imported)
                        </span>
                        <span>Page {pagination.currentPage}</span>
                      </div>
                    )}

                    <TabsContent value="tenor" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                    </TabsContent>
                    <TabsContent value="giphy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                    </TabsContent>
                    <TabsContent value="klipy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                    </TabsContent>

                    {/* Pagination controls */}
                    {pagination.hasNextPage && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => handleSearch(true)}
                          disabled={isSearching}
                          className="h-9"
                        >
                          <ChevronsLeft className="h-4 w-4 mr-2" />
                          Back to First
                        </Button>
                        <span className="px-3 py-2 text-sm font-medium">
                          Page {pagination.currentPage}
                        </span>
                        <Button
                          variant="outline"
                          onClick={loadNextPage}
                          disabled={!pagination.hasNextPage || isSearching}
                          className="h-9"
                        >
                          Next Page
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* URL Import Card */}
            <Card className="border-border/50">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Import from URLs
                </CardTitle>
                <CardDescription className="text-sm">
                  Paste direct GIF/MP4 URLs to import (one per line)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3">
                  <Textarea
                    placeholder="https://example.com/image.gif&#10;https://example.com/video.mp4&#10;..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    rows={4}
                    className="bg-background/50 font-mono text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {urlInput.trim().split('\n').filter(u => u.trim()).length} URL(s)
                    </span>
                    <Button
                      onClick={handleImportUrl}
                      disabled={isImportingUrl || !urlInput.trim()}
                      size="sm"
                    >
                      {isImportingUrl ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Import URLs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Recent Imports */}
          <div className="order-2">
            <Card className="border-border/50">
              <CardHeader className="px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <History className="h-4 w-4 sm:h-5 sm:w-5" />
                    Recent Imports
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadImportJobs}
                    disabled={isLoadingJobs}
                    className="h-8 px-2 sm:px-3"
                  >
                    {isLoadingJobs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Refresh</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-3">
                  {isLoadingJobs ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))
                  ) : importJobs.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No import jobs yet
                    </p>
                  ) : (
                    importJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-lg border border-border/50 bg-card/50"
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <Badge variant="outline" className="text-xs">{job.source}</Badge>
                          <Badge className={`text-xs ${getStatusColor(job.status)}`}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{job.query}</p>
                        <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {job.importedItems}
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-500" />
                            {job.failedItems}
                          </span>
                          <span>/ {job.totalItems}</span>
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
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

function GifGrid({ previews, isLoading, selectMode, selectedIds, onToggleSelect }: GifGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  if (previews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-muted-foreground">
        <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 mb-4 opacity-50" />
        <p className="text-sm sm:text-base text-center px-4">Search for GIFs to preview them here</p>
      </div>
    )
  }

  const alreadyImportedCount = previews.filter(p => p.alreadyImported).length

  return (
    <div className="space-y-3">
      {alreadyImportedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>{alreadyImportedCount} of {previews.length} already imported</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {previews.map((gif) => (
          <div
            key={gif.id}
            onClick={() => selectMode && onToggleSelect?.(gif.id)}
            className={`relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer transition-all ${
              gif.alreadyImported 
                ? 'border-green-500/50 opacity-60' 
                : selectMode && selectedIds?.has(gif.id)
                  ? 'border-primary ring-2 ring-primary/50'
                  : 'border-border/50 hover:border-border'
            }`}
          >
            <Image
              src={gif.preview || gif.url}
              alt={gif.title || 'Animated GIF preview'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
              unoptimized
            />
            {gif.alreadyImported && (
              <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
            )}
            {selectMode && selectedIds?.has(gif.id) && !gif.alreadyImported && (
              <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 sm:transition-opacity flex items-end p-2">
              <p className="text-xs text-white truncate">{gif.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
