import { cookies } from 'next/headers'
import { validateToken, type AccountUser } from './accounts'
import prisma from './prisma'

export interface SessionUser {
  id: string
  accountId: string
  username: string
  email: string
  avatar?: string | null
  isAdmin: boolean
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return null
    }

    const validation = await validateToken(token)
    
    if (!validation.valid || !validation.user) {
      return null
    }

    // Find or create local user
    let user = await prisma.user.findUnique({
      where: { accountId: validation.user.id },
    })

    if (!user) {
      // Create local user record
      user = await prisma.user.create({
        data: {
          accountId: validation.user.id,
          username: validation.user.username,
          email: validation.user.email,
          avatar: validation.user.avatar,
        },
      })
    } else {
      // Update user info if changed
      if (user.username !== validation.user.username || 
          user.email !== validation.user.email || 
          user.avatar !== validation.user.avatar) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username: validation.user.username,
            email: validation.user.email,
            avatar: validation.user.avatar,
          },
        })
      }
    }

    return {
      id: user.id,
      accountId: user.accountId,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
    }
  } catch (error) {
    console.error('Session error:', error)
    return null
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  
  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth()
  
  if (!session.isAdmin) {
    throw new Error('Admin access required')
  }

  return session
}
