import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Badge } from '@/components/ui/badge'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'

async function getTag(slug: string) {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { gifs: true },
      },
    },
  })

  return tag
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tag = await getTag(slug)

  if (!tag) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="secondary" className="text-lg px-4 py-1">
              #{tag.name}
            </Badge>
            <span className="text-muted-foreground">
              {tag._count.gifs.toLocaleString()} GIFs
            </span>
          </div>
          <p className="text-muted-foreground">
            Explore all GIFs tagged with #{tag.name}
          </p>
        </div>

        <GifGrid tag={slug} />
      </main>
    </div>
  )
}
