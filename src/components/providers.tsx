'use client'

import { type ReactNode } from 'react'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      {children}
      <Toaster position="bottom-right" />
    </AuthProvider>
  )
}
