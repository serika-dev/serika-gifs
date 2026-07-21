'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface CategoryCardProps {
  name: string
  slug: string
  count: number
  thumbnailUrl?: string | null
  previewUrl?: string | null
}

const numberFmt = new Intl.NumberFormat('en', { notation: 'compact' })

export function CategoryCard({ name, slug, count, thumbnailUrl, previewUrl }: CategoryCardProps) {
  const [hovered, setHovered] = useState(false)
  const still = thumbnailUrl || previewUrl
  const animated = previewUrl || thumbnailUrl

  return (
    <Link
      href={`/tag/${slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:ring-2 hover:ring-primary/25 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {still ? (
          <Image
            src={hovered && animated ? animated : still}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-background">
            <span className="text-3xl font-bold text-primary/40 uppercase">{name.slice(0, 2)}</span>
          </div>
        )}
        {/* Gradient scrim for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm">
          {numberFmt.format(count)}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-center text-sm font-semibold capitalize text-foreground group-hover:text-primary transition-colors">
          {name}
        </p>
      </div>
    </Link>
  )
}
