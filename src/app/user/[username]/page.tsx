import { Header } from '@/components/header'
import { UserGifs } from '@/components/user-gifs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Image as ImageIcon, Heart, Folder } from 'lucide-react'
import NextImage from 'next/image'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getUser as getAccountUser } from '@/lib/accounts'
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

  // Pull the banner (and freshest avatar) from the accounts service. Fails
  // gracefully to null so the profile still renders if accounts is unreachable.
  const account = await getAccountUser(user.id).catch(() => null)
  const bannerUrl = account?.banner || null
  const avatarUrl = account?.avatar || user.avatar || undefined

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-background sm:h-56">
        {bannerUrl && (
          <NextImage
            src={bannerUrl}
            alt={`${user.username}'s banner`}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
            priority
          />
        )}
      </div>

      <main className="container mx-auto px-4 pb-8">
        {/* Profile Header */}
        <div className="-mt-12 flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8">
          <Avatar className="h-24 w-24 border-4 border-background sm:h-28 sm:w-28">
            <AvatarImage src={avatarUrl} alt={user.username} />
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
                <ImageIcon className="h-4 w-4" />
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
              <ImageIcon className="h-4 w-4 mr-2" />
              GIFs
            </TabsTrigger>
            <TabsTrigger value="collections">
              <Folder className="h-4 w-4 mr-2" />
              Collections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gifs">
            <UserGifs userId={user.id} username={user.username} />
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
