'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

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
      // Remove last tag when backspace is pressed on empty input
      setTags(tags.slice(0, -1))
    } else if (e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const allowedTypes = ['image/gif', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Allowed: GIF, WebP, MP4, WebM')
      return
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (selectedFile.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB')
      return
    }

    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    
    // Auto-fill title from filename
    if (!title) {
      const name = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setTitle(name)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Please select a file')
      return
    }

    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      formData.append('description', description)
      formData.append('tags', tags.join(','))

      const response = await fetch('/api/gifs', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success('GIF uploaded successfully!')
      router.push(`/gif/${data.gif.slug}`)
    } catch {
      toast.error('Failed to upload GIF')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload GIF
            </CardTitle>
            <CardDescription>
              Share your favorite GIFs with the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">
              {/* File Upload Area */}
              <div>
                <Label>File</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/gif,image/webp,video/mp4,video/webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {preview ? (
                  <div className="relative mt-2">
                    <div className="relative rounded-lg overflow-hidden bg-muted border border-border/50">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-h-[400px] w-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={clearFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {file?.name} ({(file?.size || 0 / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 border-2 border-dashed border-border/50 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Click to select a file or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      GIF, WebP, MP4, WebM up to 50MB
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your GIF a title"
                  required
                  className="bg-background/50"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="bg-background/50"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background/50 border border-input rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
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

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isUploading || !file}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload GIF
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
