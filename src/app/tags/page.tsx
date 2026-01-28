import { Header } from '@/components/header'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getAllTags() {
  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' }, // Hide internal import tag from users
    },
    include: {
      _count: {
        select: { gifs: true },
      },
    },
    orderBy: {
      gifs: {
        _count: 'desc',
      },
    },
  })

  return tags.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    count: tag._count.gifs,
  }))
}

export default async function TagsPage() {
  const tags = await getAllTags()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tags</h1>
          <p className="text-muted-foreground">
            Browse GIFs by tag
          </p>
        </div>

        {tags.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            No tags yet. Upload some GIFs with tags to get started!
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <Link key={tag.slug} href={`/tag/${tag.slug}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 transition-colors text-base px-4 py-2"
                >
                  #{tag.name}
                  <span className="ml-2 text-muted-foreground">({tag.count})</span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
