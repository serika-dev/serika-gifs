import { Header } from '@/components/header'
import { ProfileContent } from '@/components/profile-content'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar, Image as ImageIcon, Heart, Folder } from 'lucide-react'
import NextImage from 'next/image'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getUser as getAccountUser } from '@/lib/accounts'
import { formatDistanceToNow } from 'date-fns'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const user = await getUser(username)

  if (!user) {
    return {
      title: 'User Not Found | SerikaGIFs',
    }
  }

  const title = `${user.username} (@${user.username})`
  const description = `Check out ${user.username}'s profile on SerikaGIFs. View their ${user._count.gifs} uploaded GIFs, favorite GIFs, and collections.`

  return {
    title: `${title} - GIF Profile | SerikaGIFs`,
    description,
    keywords: [user.username.toLowerCase(), 'user profile', 'gifs', 'uploads', 'serikagifs'],
    alternates: {
      canonical: `${SITE_URL}/user/${user.username}`,
    },
    openGraph: {
      title: `${title} | SerikaGIFs`,
      description,
      siteName: 'SerikaGIFs',
      url: `${SITE_URL}/user/${user.username}`,
      type: 'profile',
      images: user.avatar ? [user.avatar] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${title} | SerikaGIFs`,
      description,
      images: user.avatar ? [user.avatar] : undefined,
    },
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params
  const user = await getUser(username)

  if (!user) {
    notFound()
  }

  // Pull the banner (and freshest avatar) from the accounts service. Fails
  // gracefully to null so the profile still renders if accounts is unreachable.
  const account = await getAccountUser(user.accountId).catch(() => null)
  const bannerUrl = account?.banner || null
  const avatarUrl = account?.avatar || user.avatar || undefined

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "name": `${user.username}'s Profile`,
    "url": `${SITE_URL}/user/${user.username}`,
    "mainEntity": {
      "@type": "Person",
      "name": user.username,
      "image": avatarUrl,
      "interactionStatistic": [
        {
          "@type": "InteractionCounter",
          "interactionType": { "@type": "WriteAction" },
          "userInteractionCount": user._count.gifs
        }
      ]
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-background sm:h-80">
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
        {/* Banner bottom fade overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <main className="container mx-auto px-4 pb-8">
        {/* Profile Header */}
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 mb-8 mt-6">
          {/* Avatar container with 50% height of avatar to prevent empty space below */}
          <div className="h-14 w-28 sm:h-16 sm:w-32 relative flex-shrink-0">
            {/* The avatar itself absolute positioned to overlap the banner */}
            <Avatar className="absolute -top-14 sm:-top-16 left-0 h-28 w-28 sm:h-32 sm:w-32 border-4 border-background shadow-xl">
              <AvatarImage src={avatarUrl} alt={user.username} />
              <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="text-center sm:text-left space-y-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{user.username}</h1>
              {user.isAdmin && (
                <Badge variant="secondary" className="mt-1 bg-violet-500/10 text-violet-400 border-violet-500/20">Admin</Badge>
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

        {/* Content Section (handles search, sort, and tabs on same line) */}
        <ProfileContent userId={user.id} username={user.username} />
      </main>
    </div>
  )
}
