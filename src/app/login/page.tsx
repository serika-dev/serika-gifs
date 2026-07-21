'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface BgImageState {
  url: string
  author: string
  profile: string
}

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bgImage, setBgImage] = useState<BgImageState | null>(null)

  useEffect(() => {
    fetch('/api/bg-image')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.bgImage) {
          setBgImage(data.bgImage)
        } else {
          throw new Error('Failed to load background image')
        }
      })
      .catch(() => {
        // Fallback default
        setBgImage({
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
          author: 'Milad Fakurian',
          profile: 'https://unsplash.com/@fakurian'
        })
      })
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const result = await login(email, password)

    if (result.success) {
      toast.success('Logged in successfully!')
      router.push('/')
    } else {
      toast.error(result.error || 'Login failed')
    }

    setIsLoading(false)
  }

  // Show nothing while checking auth
  if (authLoading) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#030014]">
      {/* Background Image with blur & overlay */}
      {bgImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105"
          style={{ 
            backgroundImage: `url(${bgImage.url})`,
            filter: 'blur(8px) brightness(0.35)'
          }}
        />
      )}
      {/* Dark overlay grid / radial gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-transparent to-black/80 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.7)_100%)] z-0 pointer-events-none" />

      <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8),_0_0_80px_rgba(139,92,246,0.06)] relative z-10 text-white">
        <CardHeader className="space-y-1.5 text-center pb-6">
          <div className="flex items-center justify-center mb-5">
            <Logo width={180} height={27} showLink={false} center={true} className="filter drop-shadow-[0_0_10px_rgba(139,92,246,0.25)]" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome back</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-white/5 border-white/10 focus:border-violet-500 focus:ring-violet-500/20 text-white placeholder-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-white/5 border-white/10 focus:border-violet-500 focus:ring-violet-500/20 text-white placeholder-slate-500"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-4">
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white transition-colors duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
            <p className="text-sm text-slate-400 text-center">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-violet-400 hover:underline hover:text-violet-300 transition-colors font-medium">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>

      {/* Attribution */}
      {bgImage && (
        <div className="absolute bottom-4 right-4 text-[10px] sm:text-xs text-white/40 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5 z-20">
          Art by{' '}
          <a href={bgImage.profile} target="_blank" rel="noopener noreferrer" className="hover:text-violet-400 underline transition-colors font-medium">
            {bgImage.author}
          </a>
        </div>
      )}
    </div>
  )
}

