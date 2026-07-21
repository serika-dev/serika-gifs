'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Loader2, X } from 'lucide-react'

interface TagResult {
  id: string
  name: string
  slug: string
  count: number
}

const numberFmt = new Intl.NumberFormat('en', { notation: 'compact' })

export function TagSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TagResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      if (!q) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/tags?search=${encodeURIComponent(q)}&limit=30`, { signal: ctrl.signal })
        const data = await res.json()
        setResults(data.tags || [])
      } catch {
        /* aborted */
      } finally {
        setLoading(false)
      }
    }, q ? 250 : 0)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tags…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]) }} aria-label="Clear">
            <X className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tags found for “{query}”</p>
          ) : (
            results.map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <span className="truncate capitalize">{tag.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{numberFmt.format(tag.count)}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
