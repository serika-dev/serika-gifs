'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Search, 
  Download, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Image as ImageIcon,
  History
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface GifPreview {
  id: string
  title: string
  url: string
  preview: string
  sourceUrl?: string
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

export default function AdminImportPage() {
  const [activeTab, setActiveTab] = useState('tenor')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [previews, setPreviews] = useState<GifPreview[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    setPreviews([])
    setSelectedIds(new Set())

    try {
      const response = await fetch(`/api/admin/import/${activeTab}?query=${encodeURIComponent(searchQuery)}&limit=20`)
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      setPreviews(data.results || [])
      
      if (data.results?.length === 0) {
        toast.info('No results found')
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
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
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      })
      
      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(`Imported ${data.imported} GIFs (${data.failed} failed)`)
      setPreviews([])
      setSelectedIds(new Set())
      loadImportJobs()
    } catch {
      toast.error('Import failed')
    } finally {
      setIsImporting(false)
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

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
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
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Import GIFs</h1>
            <p className="text-muted-foreground mt-1">
              Import GIFs from external sources
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline">Back to Admin</Button>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Search & Import</CardTitle>
                <CardDescription>
                  Search for GIFs and import them to your library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="tenor">Tenor</TabsTrigger>
                    <TabsTrigger value="giphy">Giphy</TabsTrigger>
                    <TabsTrigger value="klipy">Klipy</TabsTrigger>
                  </TabsList>

                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="search" className="sr-only">Search</Label>
                        <Input
                          id="search"
                          placeholder={`Search ${getSourceLabel(activeTab)} for GIFs...`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className="bg-background/50"
                        />
                      </div>
                      <Button
                        onClick={handleSearch}
                        disabled={isSearching}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        <span className="ml-2">Search</span>
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={isImporting || !searchQuery.trim()}
                        variant="default"
                        className="bg-primary"
                      >
                        {isImporting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="ml-2">Import All</span>
                      </Button>
                    </div>

                    <TabsContent value="tenor" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
                    </TabsContent>
                    <TabsContent value="giphy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
                    </TabsContent>
                    <TabsContent value="klipy" className="mt-0">
                      <GifGrid previews={previews} isLoading={isSearching} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Imports
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadImportJobs}
                    disabled={isLoadingJobs}
                  >
                    {isLoadingJobs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
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
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{job.source}</Badge>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{job.query}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    )
  }

  if (previews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
        <p>Search for GIFs to preview them here</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {previews.map((gif) => (
        <div
          key={gif.id}
          className="relative aspect-square rounded-lg overflow-hidden border border-border/50 bg-muted group cursor-pointer"
        >
          <img
            src={gif.preview || gif.url}
            alt={gif.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
            <p className="text-xs text-white truncate">{gif.title}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
