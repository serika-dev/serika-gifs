import { NextRequest, NextResponse } from 'next/server'
import { register } from '@/lib/accounts'

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json()

    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Username, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const result = await register(username, email, password)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Registration failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please login.',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
