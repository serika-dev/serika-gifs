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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
      setMobileMenuOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Logo width={110} height={18} />
          
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xs mx-4 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search GIFs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <>
              <Link href="/upload" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-md p-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || undefined} alt={user.username} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
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
              <Link href="/register" className="hidden sm:block">
                <Button size="sm">
                  Sign up
                </Button>
              </Link>
            </>
          )}
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-[320px] p-0">
              <SheetHeader className="px-4 pt-4 pb-2 text-left">
                <SheetTitle className="text-base font-medium">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-full px-4 pb-6">
                {/* Mobile search */}
                <form onSubmit={handleSearch} className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search GIFs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                </form>

                {/* Navigation links */}
                <nav className="flex flex-col gap-0.5 mb-4">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="py-2.5 px-3 rounded-md text-foreground hover:bg-accent transition-colors text-sm font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {/* User section */}
                {user ? (
                  <div className="flex flex-col gap-0.5 pt-4 border-t">
                    {/* User info */}
                    <div className="flex items-center gap-3 py-2.5 px-3 mb-1">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar || undefined} alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    {/* User actions */}
                    <Link 
                      href="/upload" 
                      className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span>Upload</span>
                    </Link>
                    <Link 
                      href={`/user/${user.username}`} 
                      className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Profile</span>
                    </Link>
                    <Link 
                      href="/favorites" 
                      className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span>Favorites</span>
                    </Link>
                    <Link 
                      href="/my-collections" 
                      className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span>My Collections</span>
                    </Link>
                    <Link 
                      href="/settings" 
                      className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span>Settings</span>
                    </Link>
                    
                    {user.isAdmin && (
                      <>
                        <div className="border-t my-2" />
                        <Link 
                          href="/admin" 
                          className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>Admin</span>
                        </Link>
                        <Link 
                          href="/admin/import" 
                          className="py-2 px-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3 text-sm"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                          <span>Import GIFs</span>
                        </Link>
                      </>
                    )}
                    
                    <div className="border-t my-2" />
                    <button 
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="py-2 px-3 rounded-md hover:bg-destructive/10 transition-colors flex items-center gap-3 text-left text-sm text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-4 border-t mt-auto">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full h-10">Sign in</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full h-10">Sign up</Button>
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
