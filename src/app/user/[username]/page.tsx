import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Image, Heart, Folder } from 'lucide-react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  params: Promise<{ username: string }>
}

async function getUser(username: string) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    include: {
      _count: {
        select: {
          gifs: true,
          favorites: true,
          collections: true,
        },
      },
    },
  })

  return user
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  const user = await getUser(username)

  if (!user) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
            <AvatarImage src={user.avatar || undefined} alt={user.username} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="text-center sm:text-left space-y-2">
            <div>
              <h1 className="text-2xl font-semibold">{user.username}</h1>
              {user.isAdmin && (
                <Badge variant="secondary" className="mt-1">Admin</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Image className="h-4 w-4" />
                <span>{user._count.gifs} GIFs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Heart className="h-4 w-4" />
                <span>{user._count.favorites} favorites</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Folder className="h-4 w-4" />
                <span>{user._count.collections} collections</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="gifs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="gifs">
              <Image className="h-4 w-4 mr-2" />
              GIFs
            </TabsTrigger>
            <TabsTrigger value="collections">
              <Folder className="h-4 w-4 mr-2" />
              Collections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gifs">
            <GifGrid 
              userId={user.id} 
              emptyMessage={`${user.username} hasn't uploaded any GIFs yet`}
              emptySubMessage="Check back later!"
            />
          </TabsContent>

          <TabsContent value="collections">
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">Collections coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
