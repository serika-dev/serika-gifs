'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  RefreshCw
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

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState('tenor')
  const [searchQuery, setSearchQuery] = useState('')
  const [maxPages, setMaxPages] = useState('5')
  const [isSearching, setIsSearching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingMultiple, setIsImportingMultiple] = useState(false)
  const [previews, setPreviews] = useState<GifPreview[]>([])
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
    
    // Reset on new search
    const pageNum = resetPage ? 1 : pagination.currentPage + 1
    if (resetPage) {
      setPreviews([])
    }

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        limit: '20',
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

      setPreviews(data.results || [])
      setPagination({
        currentPage: pageNum,
        totalCount: data.totalCount || data.results?.length || 0,
        hasNextPage: data.hasNextPage || false,
        nextPos: data.nextPos,
      })
      
      if (data.results?.length === 0) {
        toast.info('No results found')
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, activeTab, pagination.currentPage])

  const handleImport = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsImporting(true)

    try {
      // Import the currently displayed results by re-fetching with the same query
      const response = await fetch(`/api/admin/import/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery, 
          limit: 20,
        }),
      })
      
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(`Imported ${data.imported} GIFs (${data.skipped || 0} skipped, ${data.failed} failed)`)
      loadImportJobs()
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
    if (pagesToImport < 1 || pagesToImport > 20) {
      toast.error('Please enter a number between 1 and 20')
      return
    }

    setIsImportingMultiple(true)
    let totalImported = 0
    let totalFailed = 0
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
        pageCount++

        const skipped = data.skipped || 0
        toast.info(`Page ${pageCount}/${pagesToImport}: Imported ${data.imported} GIFs${skipped > 0 ? ` (${skipped} skipped)` : ''}`)

        // Check if there are more pages
        if (!data.hasNextPage || !data.nextPos) {
          break
        }
        currentPos = data.nextPos
      }

      toast.success(`Total: Imported ${totalImported} GIFs (${totalFailed} failed) from ${pageCount} pages`)
      loadImportJobs()
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImportingMultiple(false)
    }
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
        {/* Header - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Import GIFs</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Import GIFs from external sources
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              Back to Admin
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-3">
          {/* Main content - Full width on mobile */}
          <div className="lg:col-span-2 order-1">
            <Card className="border-border/50">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">Search & Import</CardTitle>
                <CardDescription className="text-sm">
                  Search for GIFs and import them to your library
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Tabs value={activeTab} onValueChange={(tab) => {
                  setActiveTab(tab)
                  setPreviews([])
                  setSearchQuery('')
                  setPagination({ currentPage: 1, totalCount: 0, hasNextPage: false })
                }}>
                  <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 h-auto">
                    <TabsTrigger value="tenor" className="text-xs sm:text-sm py-2 sm:py-1.5">Tenor</TabsTrigger>
                    <TabsTrigger value="giphy" className="text-xs sm:text-sm py-2 sm:py-1.5">Giphy</TabsTrigger>
                    <TabsTrigger value="klipy" className="text-xs sm:text-sm py-2 sm:py-1.5">Klipy</TabsTrigger>
                  </TabsList>

                  <div className="space-y-4">
                    {/* Search controls - Stack on mobile */}
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
                              <Download className="h-4 w-4" />
                            )}
                            <span className="ml-2">Import Page ({previews.length})</span>
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
                              <span className="ml-2">Import Multiple Pages</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Results info */}
                    {previews.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>
                          Showing {previews.length} results
                          {pagination.totalCount > previews.length && ` (more available)`}
                        </span>
                        <span>Page {pagination.currentPage}</span>
                      </div>
                    )}

                    <TabsContent value="tenor" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
                    </TabsContent>
                    <TabsContent value="giphy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
                    </TabsContent>
                    <TabsContent value="klipy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
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
          </div>

          {/* Sidebar - Full width on mobile, below main content */}
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

function GifGrid({ previews, isLoading }: { previews: GifPreview[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {previews.map((gif) => (
          <div
            key={gif.id}
            className={`relative aspect-square rounded-lg overflow-hidden border bg-muted group cursor-pointer ${
              gif.alreadyImported 
                ? 'border-green-500/50 opacity-60' 
                : 'border-border/50'
            }`}
          >
            <Image
              src={gif.preview || gif.url}
              alt={gif.title || 'Animated GIF preview'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              unoptimized
            />
            {gif.alreadyImported && (
              <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
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
