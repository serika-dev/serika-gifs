'use client'

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { API_ENDPOINTS } from '@/lib/constants'

// Types
export interface User {
  id: string
  username: string
  email: string
  avatar?: string | null
  isAdmin: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch session on mount
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.session, {
        credentials: 'include',
      })
      const data = await response.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  // Login
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        return { success: true }
      }

      return { success: false, error: data.error || 'Login failed' }
    } catch {
      return { success: false, error: 'Something went wrong' }
    }
  }, [])

  // Register
  const register = useCallback(async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.auth.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      })

      const data = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        return { success: true }
      }

      return { success: false, error: data.error || 'Registration failed' }
    } catch {
      return { success: false, error: 'Something went wrong' }
    }
  }, [])

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch(API_ENDPOINTS.auth.logout, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null)
      router.push('/')
      router.refresh()
    }
  }, [router])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for requiring authentication (redirects if not logged in)
export function useRequireAuth(redirectTo = '/login') {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isLoading, isAuthenticated, router, redirectTo])

  return { user, isLoading, isAuthenticated }
}

// Hook for requiring admin access
export function useRequireAdmin(redirectTo = '/') {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user?.isAdmin) {
        router.push(redirectTo)
      }
    }
  }, [isLoading, isAuthenticated, user, router, redirectTo])

  return { user, isLoading, isAdmin: user?.isAdmin ?? false }
}
