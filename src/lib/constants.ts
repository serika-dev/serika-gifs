// Site-wide constants and configuration
export const SITE_CONFIG = {
  name: 'SerikaGifs',
  description: 'Share and discover amazing GIFs',
  tagline: 'The ultimate GIF sharing platform',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
} as const

// Brand colors - defined here for reference, also in globals.css
export const BRAND_COLORS = {
  primary: '#8b5cf6', // Purple
  primaryDark: '#7c3aed',
  primaryLight: '#a78bfa',
  accent: '#a855f7',
  background: '#000000', // AMOLED black
  foreground: '#ffffff',
  muted: '#a1a1aa',
  border: '#27272a',
} as const

// Navigation links
export const NAV_LINKS = [
  { href: '/trending', label: 'Trending' },
  { href: '/tags', label: 'Tags' },
  { href: '/collections', label: 'Collections' },
  { href: '/docs', label: 'Docs' },
] as const

// User dropdown menu items (for logged in users)
export const USER_MENU_ITEMS = [
  { href: '/profile', label: 'Profile', icon: 'User' },
  { href: '/favorites', label: 'Favorites', icon: 'Heart' },
  { href: '/my-collections', label: 'My Collections', icon: 'FolderOpen' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
] as const

// Admin menu items
export const ADMIN_MENU_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'Shield' },
  { href: '/admin/import', label: 'Import GIFs', icon: 'Download' },
  { href: '/admin/users', label: 'Users', icon: 'Users' },
] as const

// API endpoints
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    session: '/api/auth/session',
  },
  gifs: {
    list: '/api/gifs',
    upload: '/api/gifs/upload',
    trending: '/api/gifs/trending',
    search: '/api/gifs/search',
  },
  tags: {
    list: '/api/tags',
    popular: '/api/tags/popular',
  },
  collections: {
    list: '/api/collections',
  },
  favorites: {
    list: '/api/favorites',
  },
  admin: {
    import: '/api/admin/import',
  },
} as const

// GIF sources for import
export const GIF_SOURCES = {
  UPLOAD: 'UPLOAD',
  TENOR: 'TENOR',
  GIPHY: 'GIPHY',
  KLIPY: 'KLIPY',
} as const

// Pagination defaults
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const

// Upload limits
export const UPLOAD_LIMITS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/gif', 'image/webp'],
  maxFilesPerUpload: 10,
} as const

// Cookie names
export const COOKIES = {
  authToken: 'auth_token',
} as const
