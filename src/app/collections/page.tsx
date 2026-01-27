import { Header } from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, Lock } from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/prisma'

async function getPublicCollections() {
  const collections = await prisma.collection.findMany({
    where: { isPublic: true },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      _count: {
        select: { gifs: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return collections
}

export default async function CollectionsPage() {
  const collections = await getPublicCollections()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <FolderOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Collections</h1>
        </div>

        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No public collections yet</p>
            <p className="text-sm">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/collection/${collection.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      {collection.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {collection.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {collection.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {collection._count.gifs} GIFs
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        by {collection.user.username}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
