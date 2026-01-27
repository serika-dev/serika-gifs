import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logout } from '@/lib/accounts'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (token) {
      await logout(token)
    }

    cookieStore.delete('auth_token')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
