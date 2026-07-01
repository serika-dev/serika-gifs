'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Pencil, X, Loader2, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

interface Gif {
  id: string
  slug: string
  title: string
  description: string | null
  url: string
  tags: { name: string; slug: string }[]
  user: { id: string; username: string }
}

export default function EditGifPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [gif, setGif] = useState<Gif | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    const fetchGif = async () => {
      const { slug } = await params
      try {
        const response = await fetch(`/api/gifs/${slug}`)
        const data = await response.json()
        
        if (data.error) {
          toast.error('GIF not found')
          router.push('/')
          return
        }

        setGif(data.gif)
        setTitle(data.gif.title)
        setDescription(data.gif.description || '')
        // API returns tags as string array
        setTags(Array.isArray(data.gif.tags) ? data.gif.tags : [])
      } catch {
        toast.error('Failed to load GIF')
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGif()
  }, [params, router])

  // Check if user can edit this GIF
  useEffect(() => {
    if (!authLoading && !isLoading && gif && user) {
      if (gif.user.id !== user.id && !user.isAdmin) {
        toast.error('You do not have permission to edit this GIF')
        router.push(`/gif/${gif.slug}`)
      }
    }
  }, [authLoading, isLoading, gif, user, router])

  const addTag = useCallback((tag: string) => {
    const normalizedTag = tag.trim().toLowerCase()
    if (normalizedTag && !tags.includes(normalizedTag) && tags.length < 10) {
      setTags([...tags, normalizedTag])
      setTagInput('')
    }
  }, [tags])

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    } else if (e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!gif) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/gifs/${gif.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          tags,
        }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('GIF updated successfully!')
      router.push(`/gif/${data.gif.slug}`)
    } catch {
      toast.error('Failed to update GIF')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!gif) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/gifs/${gif.slug}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('GIF deleted successfully')
      router.push('/')
    } catch {
      toast.error('Failed to delete GIF')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!gif) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link 
          href={`/gif/${gif.slug}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to GIF
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit GIF
            </CardTitle>
            <CardDescription>
              Update your GIF&apos;s details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Preview */}
            <div className="mb-6 rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={gif.url}
                alt={gif.title}
                className="max-h-[300px] w-full object-contain"
              />
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="GIF title"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="min-h-[100px]"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] border border-input rounded-md focus-within:ring-2 focus-within:ring-ring">
                  {tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    id="tags"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => tagInput && addTag(tagInput)}
                    placeholder={tags.length === 0 ? "Type a tag and press Enter..." : ""}
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or comma to add tags (max 10)
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isDeleting}>
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete GIF
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete GIF?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your GIF
                        and remove it from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
