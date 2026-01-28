'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bookmark, Plus, Check, Loader2, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface Collection {
  id: string
  name: string
  gifCount: number
}

interface SaveToCollectionProps {
  gifId: string
  className?: string
  variant?: 'icon' | 'button'
}

export function SaveToCollection({ gifId, className, variant = 'icon' }: SaveToCollectionProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [savedIn, setSavedIn] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [savingTo, setSavingTo] = useState<string | null>(null)
  
  // New collection dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (open && user) {
      fetchCollections()
    }
  }, [open, user])

  const fetchCollections = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/collections?mine=true')
      const data = await response.json()
      setCollections(data.collections || [])
      
      // Check which collections already have this GIF
      const savedSet = new Set<string>()
      for (const col of data.collections || []) {
        const checkRes = await fetch(`/api/collections/${col.id}/gifs/check?gifId=${gifId}`)
        const checkData = await checkRes.json()
        if (checkData.exists) {
          savedSet.add(col.id)
        }
      }
      setSavedIn(savedSet)
    } catch {
      toast.error('Failed to load collections')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSave = async (collectionId: string) => {
    if (!user) {
      toast.error('Please log in to save GIFs')
      return
    }

    setSavingTo(collectionId)
    const isCurrentlySaved = savedIn.has(collectionId)

    try {
      const response = await fetch(`/api/collections/${collectionId}/gifs`, {
        method: isCurrentlySaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gifId }),
      })

      const data = await response.json()

      if (data.success || response.ok) {
        setSavedIn(prev => {
          const newSet = new Set(prev)
          if (isCurrentlySaved) {
            newSet.delete(collectionId)
          } else {
            newSet.add(collectionId)
          }
          return newSet
        })
        toast.success(isCurrentlySaved ? 'Removed from collection' : 'Added to collection')
      } else {
        toast.error(data.error || 'Failed to update collection')
      }
    } catch {
      toast.error('Failed to update collection')
    } finally {
      setSavingTo(null)
    }
  }

  const createAndSave = async () => {
    if (!newName.trim()) {
      toast.error('Collection name is required')
      return
    }

    setIsCreating(true)
    try {
      // Create collection
      const createRes = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, isPublic: false }),
      })
      const createData = await createRes.json()

      if (!createData.success) {
        toast.error(createData.error || 'Failed to create collection')
        return
      }

      // Add GIF to new collection
      const addRes = await fetch(`/api/collections/${createData.collection.id}/gifs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gifId }),
      })

      if (addRes.ok) {
        setCollections(prev => [createData.collection, ...prev])
        setSavedIn(prev => new Set(prev).add(createData.collection.id))
        toast.success('Created collection and saved GIF!')
        setDialogOpen(false)
        setNewName('')
      } else {
        toast.error('Created collection but failed to add GIF')
      }
    } catch {
      toast.error('Failed to create collection')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  if (!user) {
    if (variant === 'button') {
      return (
        <Button
          size="sm"
          variant="outline"
          className={className}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toast.error('Please log in to save GIFs')
          }}
        >
          <Bookmark className="h-4 w-4 sm:mr-2" />
          <span className="ml-2 sm:ml-0 hidden xs:inline">Save</span>
        </Button>
      )
    }
    return (
      <Button
        size="icon"
        variant="secondary"
        className={className || "h-7 w-7 sm:h-7 sm:w-7 min-h-[28px] min-w-[28px] bg-black/50 hover:bg-black/70 active:bg-black/80 border-0 text-white touch-manipulation"}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toast.error('Please log in to save GIFs')
        }}
      >
        <Bookmark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
    )
  }

  const isSavedAnywhere = savedIn.size > 0

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          {variant === 'button' ? (
            <Button
              size="sm"
              variant={isSavedAnywhere ? 'default' : 'outline'}
              className={className}
            >
              <Bookmark className={`h-4 w-4 sm:mr-2 ${isSavedAnywhere ? 'fill-current' : ''}`} />
              <span className="ml-2 sm:ml-0 hidden xs:inline">{isSavedAnywhere ? 'Saved' : 'Save'}</span>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="secondary"
              className={className || "h-7 w-7 sm:h-7 sm:w-7 min-h-[28px] min-w-[28px] bg-black/50 hover:bg-black/70 active:bg-black/80 border-0 text-white touch-manipulation"}
            >
              <Bookmark className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isSavedAnywhere ? 'fill-current' : ''}`} />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={handleClick}>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No collections yet</p>
            </div>
          ) : (
            collections.map((collection) => (
              <DropdownMenuItem
                key={collection.id}
                onClick={(e) => {
                  e.preventDefault()
                  toggleSave(collection.id)
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">{collection.name}</span>
                  {savingTo === collection.id ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : savedIn.has(collection.id) ? (
                    <Check className="h-4 w-4 text-primary ml-2" />
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              setDialogOpen(true)
              setOpen(false)
            }}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClick={handleClick}>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Create a new collection and save this GIF to it
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="collection-name">Collection Name</Label>
            <Input
              id="collection-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My awesome collection"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  createAndSave()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAndSave} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
