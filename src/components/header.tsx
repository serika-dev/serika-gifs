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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Logo width={110} height={18} className="sm:w-[130px] sm:h-[20px]" />
          
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

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search GIFs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent focus:border-primary h-9"
            />
          </div>
        </form>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isLoading ? (
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <>
              <Link href="/upload" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="h-9">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
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
                <Button variant="ghost" size="sm" className="h-8 sm:h-9 px-2 sm:px-3 text-sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register" className="hidden sm:block">
                <Button size="sm" className="h-9">
                  Sign up
                </Button>
              </Link>
            </>
          )}
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 sm:h-9 sm:w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-[320px] p-0">
              <SheetHeader className="px-4 pt-4 pb-2 text-left">
                <SheetTitle className="text-lg">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-full px-4 pb-6">
                {/* Mobile search */}
                <form onSubmit={handleSearch} className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search GIFs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </form>

                {/* Navigation links */}
                <nav className="flex flex-col gap-1 mb-4">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="py-3 px-3 rounded-lg text-foreground hover:bg-muted active:bg-muted/80 transition-colors text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                {/* User section */}
                {user ? (
                  <div className="flex flex-col gap-1 pt-4 border-t">
                    {/* User info */}
                    <div className="flex items-center gap-3 py-3 px-3 mb-2">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={user.avatar || undefined} alt={user.username} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    
                    {/* User actions */}
                    <Link 
                      href="/upload" 
                      className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Upload</span>
                    </Link>
                    <Link 
                      href={`/user/${user.username}`} 
                      className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Profile</span>
                    </Link>
                    <Link 
                      href="/favorites" 
                      className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Heart className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Favorites</span>
                    </Link>
                    <Link 
                      href="/my-collections" 
                      className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">My Collections</span>
                    </Link>
                    <Link 
                      href="/settings" 
                      className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Settings</span>
                    </Link>
                    
                    {user.isAdmin && (
                      <>
                        <div className="border-t my-2" />
                        <Link 
                          href="/admin" 
                          className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">Admin</span>
                        </Link>
                        <Link 
                          href="/admin/import" 
                          className="py-3 px-3 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Download className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">Import GIFs</span>
                        </Link>
                      </>
                    )}
                    
                    <div className="border-t my-2" />
                    <button 
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="py-3 px-3 rounded-lg hover:bg-destructive/10 active:bg-destructive/20 transition-colors flex items-center gap-3 text-left text-destructive"
                    >
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">Log out</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-4 border-t mt-auto">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full h-11 text-base">Sign in</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full h-11 text-base">Sign up</Button>
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
