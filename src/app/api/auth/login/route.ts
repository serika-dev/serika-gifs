import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/lib/accounts'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const result = await login(email, password)

    if (!result.success || !result.user || !result.token) {
      return NextResponse.json(
        { success: false, error: result.error || 'Login failed' },
        { status: 401 }
      )
    }

    // Find or create local user
    let user = await prisma.user.findUnique({
      where: { accountId: result.user.id },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          accountId: result.user.id,
          username: result.user.username,
          email: result.user.email,
          avatar: result.user.avatar,
        },
      })
    } else {
      // Update user info if changed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: result.user.username,
          email: result.user.email,
          avatar: result.user.avatar,
        },
      })
    }

    // Set auth cookie
    const cookieStore = await cookies()
    cookieStore.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
