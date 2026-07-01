'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Lock, Globe, Loader2, Pin } from 'lucide-react'
import Link from 'next/link'
import { useRequireAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

interface Collection {
  id: string
  name: string
  description?: string | null
  isPublic: boolean
  isGlobal?: boolean
  _count: {
    gifs: number
  }
}

export default function MyCollectionsPage() {
  const { user, isLoading: authLoading } = useRequireAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    isPublic: false,
  })

  useEffect(() => {
    if (!user) return

    const fetchCollections = async () => {
      try {
        const response = await fetch('/api/collections?mine=true')
        const data = await response.json()
        setCollections(data.collections || [])
      } catch {
        toast.error('Failed to load collections')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCollections()
  }, [user])

  const createCollection = async () => {
    if (!newCollection.name.trim()) {
      toast.error('Collection name is required')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection),
      })

      const data = await response.json()

      if (data.success) {
        setCollections([data.collection, ...collections])
        setDialogOpen(false)
        setNewCollection({ name: '', description: '', isPublic: false })
        toast.success('Collection created!')
      } else {
        toast.error(data.error || 'Failed to create collection')
      }
    } catch {
      toast.error('Failed to create collection')
    } finally {
      setIsCreating(false)
    }
  }

  const toggleGlobal = async (collectionId: string, isGlobal: boolean) => {
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isGlobal }),
      })

      const data = await response.json()

      if (data.success) {
        setCollections(prev => 
          prev.map(col => 
            col.id === collectionId ? { ...col, isGlobal } : col
          )
        )
        toast.success(isGlobal ? 'Collection pinned as global category' : 'Removed from global categories')
      } else {
        toast.error(data.error || 'Failed to update collection')
      }
    } catch {
      toast.error('Failed to update collection')
    }
  }

  if (authLoading) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">My Collections</h1>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
                <DialogDescription>
                  Create a new collection to organize your favorite GIFs
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newCollection.name}
                    onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                    placeholder="My awesome collection"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newCollection.description}
                    onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                    placeholder="What's this collection about?"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="public">Make public</Label>
                  <Switch
                    id="public"
                    checked={newCollection.isPublic}
                    onCheckedChange={(checked) => setNewCollection({ ...newCollection, isPublic: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createCollection} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-5 w-32 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full bg-muted rounded mb-3" />
                  <div className="h-5 w-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-base">No collections yet</p>
            <p className="text-sm mt-1 mb-4">Create your first collection to get started!</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((collection) => (
              <div key={collection.id} className="relative">
                <Link href={`/collection/${collection.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {collection.name}
                        {collection.isGlobal && (
                          <Pin className="h-3.5 w-3.5 text-primary" />
                        )}
                        {collection.isPublic ? (
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {collection._count.gifs} GIFs
                        </Badge>
                        {collection.isGlobal && (
                          <Badge variant="outline">
                            Global
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {user?.isAdmin && (
                  <Button
                    size="sm"
                    variant={collection.isGlobal ? "default" : "outline"}
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={(e) => {
                      e.preventDefault()
                      toggleGlobal(collection.id, !collection.isGlobal)
                    }}
                    title={collection.isGlobal ? "Remove from global" : "Make global category"}
                  >
                    <Pin className={`h-3.5 w-3.5 ${collection.isGlobal ? 'fill-current' : ''}`} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
