'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/ui/logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { 
  Search, 
  Upload,
  User, 
  Settings, 
  LogOut,
  Shield,
  Heart,
  FolderOpen,
  Menu,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { NAV_LINKS } from '@/lib/constants'

export function Header() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Logo width={130} height={20} />
          
          <nav className="hidden md:flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search GIFs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent focus:border-primary"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <>
              <Link href="/upload">
                <Button variant="ghost" size="sm" className="hidden sm:flex">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar || undefined} alt={user.username} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/user/${user.username}`} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favorites" className="cursor-pointer">
                      <Heart className="mr-2 h-4 w-4" />
                      Favorites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/my-collections" className="cursor-pointer">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      My Collections
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/import" className="cursor-pointer">
                          <Download className="mr-2 h-4 w-4" />
                          Import GIFs
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="hidden sm:flex">
                  Sign up
                </Button>
              </Link>
            </>
          )}
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="flex flex-col gap-6 mt-6">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search GIFs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </form>

                <nav className="flex flex-col gap-2">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="py-2 text-foreground hover:text-primary transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {user ? (
                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <div className="flex items-center gap-3 py-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar || undefined} alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    
                    <Link href="/upload" className="py-2" onClick={() => setMobileMenuOpen(false)}>
                      <Upload className="inline mr-2 h-4 w-4" />
                      Upload
                    </Link>
                    <Link href={`/user/${user.username}`} className="py-2" onClick={() => setMobileMenuOpen(false)}>
                      <User className="inline mr-2 h-4 w-4" />
                      Profile
                    </Link>
                    
                    {user.isAdmin && (
                      <Link href="/admin" className="py-2" onClick={() => setMobileMenuOpen(false)}>
                        <Shield className="inline mr-2 h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    
                    <button 
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="py-2 text-left text-destructive"
                    >
                      <LogOut className="inline mr-2 h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Sign in</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full">Sign up</Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
