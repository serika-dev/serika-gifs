'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronDown,
  Copy,
  Check,
  Lock,
  Unlock,
  Zap,
  Code,
  Key,
  Image as ImageIcon,
  Heart,
  FolderOpen,
  Tag,
  User,
  ExternalLink,
  Search,
  Play,
  Loader2,
  Terminal,
  Shield,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Send,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronUp,
} from 'lucide-react'

// Types
interface ApiKey {
  id: string
  name: string
  key: string
  tier: string
  effectiveTier: string
  createdAt: string
  lastUsedAt: string | null
}

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
  enum?: string[]
  example?: string
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary: string
  description: string
  tags: string[]
  auth: 'none' | 'optional' | 'required'
  rateLimit?: string
  pathParams?: Parameter[]
  queryParams?: Parameter[]
  requestBody?: {
    contentType: string
    fields: Parameter[]
    example?: object
  }
  responses: {
    status: number
    description: string
    example?: object
  }[]
  testable?: boolean
}

interface ApiSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  endpoints: Endpoint[]
}

// API sections data
const API_SECTIONS: ApiSection[] = [
  {
    id: 'gifs',
    title: 'GIFs',
    description: 'Search, retrieve, upload, and manage GIFs',
    icon: <ImageIcon className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/gifs',
        summary: 'List GIFs',
        description: 'Retrieve a paginated list of public GIFs with filtering and sorting.',
        tags: ['GIFs', 'Public'],
        auth: 'optional',
        rateLimit: 'Anon: 30/hr • T1: 1k/hr • T2: 10k/hr • T3: 100k/hr • T4: 1M/hr • T5: ∞',
        testable: true,
        queryParams: [
          { name: 'page', type: 'integer', required: false, description: 'Page number', default: '1', example: '1' },
          { name: 'limit', type: 'integer', required: false, description: 'Results per page (max 100)', default: '20', example: '10' },
          { name: 'search', type: 'string', required: false, description: 'Full-text search over title, description and tags', example: 'funny cat' },
          { name: 'tag', type: 'string', required: false, description: 'Filter by tag slug', example: 'reaction' },
          { name: 'userId', type: 'string', required: false, description: 'Filter by uploader user ID' },
          { name: 'sort', type: 'string', required: false, description: 'Sort order. "trending" uses a time-decayed hotness score (views + favorites + recency).', default: 'trending', enum: ['trending', 'newest', 'popular', 'most-viewed', 'random'] },
          { name: 'timeRange', type: 'string', required: false, description: 'Restrict to GIFs created within a window', default: 'all', enum: ['all', 'day', 'week', 'month'] },
          { name: 'nsfw', type: 'string', required: false, description: 'NSFW visibility: exclude (SFW only, default), include (SFW + NSFW), only (NSFW only)', default: 'exclude', enum: ['exclude', 'include', 'only'] },
        ],
        responses: [
          {
            status: 200,
            description: 'Success',
            example: {
              gifs: [{ id: 'clx123', slug: 'funny-cat', title: 'Funny Cat', url: 'https://...', thumbnailUrl: 'https://...' }],
              pagination: { page: 1, limit: 20, total: 150, totalPages: 8 },
            },
          },
        ],
      },
      {
        method: 'GET',
        path: '/gifs/{slug}',
        summary: 'Get GIF Details',
        description: 'Retrieve detailed information about a single GIF.',
        tags: ['GIFs', 'Public'],
        auth: 'none',
        testable: true,
        pathParams: [{ name: 'slug', type: 'string', required: true, description: 'GIF slug', example: 'funny-cat' }],
        responses: [
          { status: 200, description: 'Success', example: { gif: { id: 'clx123', slug: 'funny-cat', title: 'Funny Cat', url: 'https://...' } } },
          { status: 404, description: 'Not found' },
        ],
      },
      {
        method: 'POST',
        path: '/gifs',
        summary: 'Upload GIF',
        description: 'Upload a new GIF. Supports GIF, WebP, MP4, and WebM up to 50MB.',
        tags: ['GIFs', 'Protected'],
        auth: 'required',
        requestBody: {
          contentType: 'multipart/form-data',
          fields: [
            { name: 'file', type: 'file', required: true, description: 'GIF or video file (max 50MB). Allowed: image/gif, image/webp, video/mp4, video/webm' },
            { name: 'title', type: 'string', required: true, description: 'Title', example: 'Funny Cat' },
            { name: 'description', type: 'string', required: false, description: 'Optional description' },
            { name: 'tags', type: 'string', required: false, description: 'Comma-separated tags (max 10)', example: 'cat,funny' },
            { name: 'isPublic', type: 'boolean', required: false, description: 'Publicly listed (default true)', default: 'true' },
            { name: 'isNsfw', type: 'boolean', required: false, description: 'Mark as NSFW/adult content (default false). NSFW GIFs are hidden from default listings.', default: 'false' },
          ],
        },
        responses: [
          { status: 200, description: 'Success', example: { success: true, gif: { id: 'clx123', slug: 'funny-cat' } } },
          { status: 401, description: 'Unauthorized' },
        ],
      },
      {
        method: 'DELETE',
        path: '/gifs/{slug}',
        summary: 'Delete GIF',
        description: 'Permanently delete a GIF. Only the owner or admin can delete.',
        tags: ['GIFs', 'Protected'],
        auth: 'required',
        pathParams: [{ name: 'slug', type: 'string', required: true, description: 'GIF slug' }],
        responses: [
          { status: 200, description: 'Success', example: { success: true } },
          { status: 403, description: 'Forbidden' },
        ],
      },
    ],
  },
  {
    id: 'collections',
    title: 'Collections',
    description: 'Organize GIFs into collections',
    icon: <FolderOpen className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/collections',
        summary: 'List Collections',
        description: 'Retrieve public collections. Shows private collections when authenticated.',
        tags: ['Collections', 'Public'],
        auth: 'optional',
        testable: true,
        queryParams: [
          { name: 'page', type: 'integer', required: false, description: 'Page number', default: '1', example: '1' },
          { name: 'limit', type: 'integer', required: false, description: 'Results per page', default: '20', example: '10' },
        ],
        responses: [
          { status: 200, description: 'Success', example: { collections: [{ id: 'col123', name: 'Reactions', gifCount: 25 }], pagination: { page: 1, total: 5 } } },
        ],
      },
      {
        method: 'POST',
        path: '/collections',
        summary: 'Create Collection',
        description: 'Create a new collection.',
        tags: ['Collections', 'Protected'],
        auth: 'required',
        requestBody: {
          contentType: 'application/json',
          fields: [
            { name: 'name', type: 'string', required: true, description: 'Collection name', example: 'My Reactions' },
            { name: 'isPublic', type: 'boolean', required: false, description: 'Public visibility', default: 'true' },
          ],
        },
        responses: [
          { status: 200, description: 'Success', example: { success: true, collection: { id: 'col123', name: 'My Reactions' } } },
        ],
      },
      {
        method: 'GET',
        path: '/collections/{id}',
        summary: 'Get Collection',
        description: 'Retrieve a collection with all its GIFs.',
        tags: ['Collections', 'Public'],
        auth: 'optional',
        testable: true,
        pathParams: [{ name: 'id', type: 'string', required: true, description: 'Collection ID', example: 'col123' }],
        responses: [
          { status: 200, description: 'Success', example: { collection: { id: 'col123', name: 'Reactions', gifs: [] } } },
          { status: 404, description: 'Not found' },
        ],
      },
    ],
  },
  {
    id: 'favorites',
    title: 'Favorites',
    description: 'Manage favorites',
    icon: <Heart className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/favorites',
        summary: 'Get Favorites',
        description: 'Retrieve all favorited GIFs for the current user.',
        tags: ['Favorites', 'Protected'],
        auth: 'required',
        testable: true,
        responses: [
          { status: 200, description: 'Success', example: { favorites: [{ id: 'gif123', slug: 'funny-cat', title: 'Funny Cat' }] } },
        ],
      },
      {
        method: 'POST',
        path: '/favorites',
        summary: 'Add Favorite',
        description: 'Add a GIF to the current user\'s favorites.',
        tags: ['Favorites', 'Protected'],
        auth: 'required',
        requestBody: {
          contentType: 'application/json',
          fields: [{ name: 'gifId', type: 'string', required: true, description: 'GIF ID to favorite', example: 'clx123' }],
        },
        responses: [
          { status: 200, description: 'Success', example: { success: true } },
          { status: 400, description: 'Already favorited' },
          { status: 401, description: 'Unauthorized' },
        ],
      },
      {
        method: 'DELETE',
        path: '/favorites',
        summary: 'Remove Favorite',
        description: 'Remove a GIF from the current user\'s favorites.',
        tags: ['Favorites', 'Protected'],
        auth: 'required',
        queryParams: [{ name: 'gifId', type: 'string', required: true, description: 'GIF ID to remove', example: 'clx123' }],
        responses: [
          { status: 200, description: 'Success', example: { success: true } },
          { status: 401, description: 'Unauthorized' },
        ],
      },
    ],
  },
  {
    id: 'tags',
    title: 'Tags',
    description: 'Browse tags',
    icon: <Tag className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/tags',
        summary: 'List Tags',
        description: 'Retrieve tags ordered by popularity.',
        tags: ['Tags', 'Public'],
        auth: 'none',
        testable: true,
        queryParams: [
          { name: 'search', type: 'string', required: false, description: 'Search query', example: 'fun' },
          { name: 'limit', type: 'integer', required: false, description: 'Results (max 100)', default: '50', example: '20' },
        ],
        responses: [
          { status: 200, description: 'Success', example: { tags: [{ name: 'funny', slug: 'funny', count: 1234 }] } },
        ],
      },
    ],
  },
  {
    id: 'keys',
    title: 'API Keys',
    description: 'Manage API keys',
    icon: <Key className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/keys',
        summary: 'List API Keys',
        description: 'Retrieve all API keys for the current user.',
        tags: ['API Keys', 'Protected'],
        auth: 'required',
        testable: true,
        responses: [
          { status: 200, description: 'Success', example: { keys: [{ id: 'key123', name: 'Production', tier: 'TIER_1' }] } },
        ],
      },
      {
        method: 'POST',
        path: '/keys',
        summary: 'Create API Key',
        description: 'Create a new API key. New keys start at Tier 1 (1k/hr).',
        tags: ['API Keys', 'Protected'],
        auth: 'required',
        requestBody: {
          contentType: 'application/json',
          fields: [{ name: 'name', type: 'string', required: true, description: 'Key name', example: 'My App' }],
        },
        responses: [
          { status: 200, description: 'Success', example: { success: true, key: { id: 'key123', key: 'sgif_xxx...' } } },
        ],
      },
    ],
  },
  {
    id: 'auth',
    title: 'Authentication',
    description: 'User authentication',
    icon: <User className="h-4 w-4" />,
    endpoints: [
      {
        method: 'GET',
        path: '/auth/session',
        summary: 'Get Session',
        description: 'Check authentication status.',
        tags: ['Auth', 'Public'],
        auth: 'optional',
        testable: true,
        responses: [
          { status: 200, description: 'Success', example: { user: { id: 'usr123', username: 'john', isAdmin: false } } },
        ],
      },
      {
        method: 'POST',
        path: '/auth/login',
        summary: 'Login',
        description: 'Authenticate with email and password.',
        tags: ['Auth', 'Public'],
        auth: 'none',
        requestBody: {
          contentType: 'application/json',
          fields: [
            { name: 'email', type: 'string', required: true, description: 'Email address' },
            { name: 'password', type: 'string', required: true, description: 'Password' },
          ],
        },
        responses: [
          { status: 200, description: 'Success', example: { success: true, user: { id: 'usr123', username: 'john' } } },
          { status: 401, description: 'Invalid credentials' },
        ],
      },
    ],
  },
]

const DOC_PAGES = [
  { slug: 'getting-started', title: 'Getting Started', icon: <ArrowRight className="h-4 w-4" /> },
  { slug: 'authentication', title: 'Authentication', icon: <Shield className="h-4 w-4" /> },
  { slug: 'rate-limits', title: 'Rate Limits', icon: <Clock className="h-4 w-4" /> },
  { slug: 'api-reference', title: 'API Reference', icon: <Code className="h-4 w-4" /> },
  { slug: 'playground', title: 'Playground', icon: <Terminal className="h-4 w-4" /> },
]

// Helper Components
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-500',
    POST: 'bg-blue-500/10 text-blue-500',
    PUT: 'bg-amber-500/10 text-amber-500',
    PATCH: 'bg-orange-500/10 text-orange-500',
    DELETE: 'bg-red-500/10 text-red-500',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${colors[method]}`}>{method}</span>
}

function AuthBadge({ auth }: { auth: 'none' | 'optional' | 'required' }) {
  if (auth === 'none') return <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30"><Unlock className="h-2.5 w-2.5 mr-1" />Public</Badge>
  if (auth === 'optional') return <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30"><Key className="h-2.5 w-2.5 mr-1" />Optional</Badge>
  return <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30"><Lock className="h-2.5 w-2.5 mr-1" />Required</Badge>
}

function StatusBadge({ status }: { status: number }) {
  const color = status >= 200 && status < 300 ? 'text-emerald-500' : status >= 400 ? 'text-red-500' : 'text-zinc-500'
  const Icon = status >= 200 && status < 300 ? CheckCircle2 : XCircle
  return <span className={`inline-flex items-center gap-1 text-xs font-mono ${color}`}><Icon className="h-3 w-3" />{status}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-xs">
        <code className="text-zinc-300 font-mono">{code}</code>
      </pre>
    </div>
  )
}

// API Tester Component
function ApiTester({ endpoint, apiKey, baseUrl }: { endpoint: Endpoint; apiKey: string; baseUrl: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; data: unknown; time: number } | null>(null)
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryValues, setQueryValues] = useState<Record<string, string>>({})
  const [bodyValue, setBodyValue] = useState('')

  useEffect(() => {
    const pathDefaults: Record<string, string> = {}
    endpoint.pathParams?.forEach((p) => { if (p.example) pathDefaults[p.name] = p.example })
    setPathValues(pathDefaults)

    const queryDefaults: Record<string, string> = {}
    endpoint.queryParams?.forEach((p) => { if (p.example) queryDefaults[p.name] = p.example })
    setQueryValues(queryDefaults)

    if (endpoint.requestBody?.fields) {
      const body: Record<string, unknown> = {}
      endpoint.requestBody.fields.forEach((f) => { if (f.example) body[f.name] = f.example })
      if (Object.keys(body).length > 0) setBodyValue(JSON.stringify(body, null, 2))
    }
  }, [endpoint])

  const buildUrl = useCallback(() => {
    let path = endpoint.path
    endpoint.pathParams?.forEach((p) => { path = path.replace(`{${p.name}}`, pathValues[p.name] || `{${p.name}}`) })
    const queryString = Object.entries(queryValues).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`
  }, [endpoint, pathValues, queryValues, baseUrl])

  const executeRequest = async () => {
    setIsLoading(true)
    const startTime = performance.now()
    try {
      const headers: Record<string, string> = {}
      if (apiKey) headers['X-API-Key'] = apiKey
      if (endpoint.requestBody?.contentType === 'application/json' && bodyValue) headers['Content-Type'] = 'application/json'

      const options: RequestInit = { method: endpoint.method, headers, credentials: 'include' }
      if (endpoint.requestBody?.contentType === 'application/json' && bodyValue) options.body = bodyValue

      const res = await fetch(buildUrl(), options)
      const data = await res.json()
      setResponse({ status: res.status, data, time: Math.round(performance.now() - startTime) })
    } catch (error) {
      setResponse({ status: 0, data: { error: error instanceof Error ? error.message : 'Request failed' }, time: Math.round(performance.now() - startTime) })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">Try it out</span>
        {!apiKey && <Badge variant="outline" className="text-[10px] text-amber-500"><AlertCircle className="h-2.5 w-2.5 mr-1" />No API key</Badge>}
      </div>

      {endpoint.pathParams && endpoint.pathParams.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500">Path Parameters</Label>
          {endpoint.pathParams.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <code className="text-xs text-zinc-400 w-20">{p.name}</code>
              <Input placeholder={p.example || p.name} value={pathValues[p.name] || ''} onChange={(e) => setPathValues({ ...pathValues, [p.name]: e.target.value })} className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {endpoint.queryParams && endpoint.queryParams.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500">Query Parameters</Label>
          {endpoint.queryParams.slice(0, 4).map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <code className="text-xs text-zinc-400 w-20">{p.name}</code>
              {p.enum ? (
                <select value={queryValues[p.name] || ''} onChange={(e) => setQueryValues({ ...queryValues, [p.name]: e.target.value })} className="h-8 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2 flex-1">
                  <option value="">--</option>
                  {p.enum.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              ) : (
                <Input placeholder={p.example || p.default || ''} value={queryValues[p.name] || ''} onChange={(e) => setQueryValues({ ...queryValues, [p.name]: e.target.value })} className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800" />
              )}
            </div>
          ))}
        </div>
      )}

      {endpoint.requestBody?.contentType === 'application/json' && (
        <div className="space-y-2">
          <Label className="text-xs text-zinc-500">Request Body</Label>
          <Textarea value={bodyValue} onChange={(e) => setBodyValue(e.target.value)} className="font-mono text-xs bg-zinc-950 border-zinc-800 min-h-[80px]" />
        </div>
      )}

      <div className="flex items-center gap-2 p-2 bg-zinc-950 rounded border border-zinc-800">
        <MethodBadge method={endpoint.method} />
        <code className="flex-1 text-xs text-zinc-400 truncate">{buildUrl()}</code>
        <CopyButton text={buildUrl()} />
      </div>

      <div className="flex gap-2">
        <Button onClick={executeRequest} disabled={isLoading} size="sm" className="flex-1">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
          Send
        </Button>
        <Button variant="outline" size="sm" onClick={() => setResponse(null)}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {response && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <StatusBadge status={response.status} />
            <span className="text-zinc-500">{response.time}ms</span>
          </div>
          <CodeBlock code={JSON.stringify(response.data, null, 2)} />
        </div>
      )}
    </div>
  )
}

function EndpointCard({ endpoint, expanded, onToggle, apiKey, baseUrl }: { endpoint: Endpoint; expanded: boolean; onToggle: () => void; apiKey: string; baseUrl: string }) {
  const generateCurl = () => {
    const url = `${baseUrl}${endpoint.path.replace('{slug}', 'example').replace('{id}', 'example')}`
    let cmd = `curl -X ${endpoint.method} "${url}"`
    if (endpoint.auth !== 'none' && apiKey) cmd += ` \\\n  -H "X-API-Key: ${apiKey}"`
    if (endpoint.requestBody?.contentType === 'application/json') {
      cmd += ` \\\n  -H "Content-Type: application/json"`
      const body: Record<string, unknown> = {}
      endpoint.requestBody.fields.forEach((f) => { body[f.name] = f.example || `example_${f.name}` })
      cmd += ` \\\n  -d '${JSON.stringify(body)}'`
    }
    return cmd
  }

  const generateJs = () => {
    const url = `${baseUrl}${endpoint.path.replace('{slug}', 'example').replace('{id}', 'example')}`
    let code = `const response = await fetch("${url}", {\n  method: "${endpoint.method}",\n  headers: {`
    if (endpoint.auth !== 'none' && apiKey) code += `\n    "X-API-Key": "${apiKey}",`
    if (endpoint.requestBody?.contentType === 'application/json') code += `\n    "Content-Type": "application/json",`
    code += `\n  },`
    if (endpoint.requestBody?.contentType === 'application/json') {
      const body: Record<string, unknown> = {}
      endpoint.requestBody.fields.forEach((f) => { body[f.name] = f.example || `example_${f.name}` })
      code += `\n  body: JSON.stringify(${JSON.stringify(body)}),`
    }
    code += `\n});\nconst data = await response.json();`
    return code
  }

  return (
    <div className={`border rounded-lg transition-colors ${expanded ? 'border-zinc-700 bg-zinc-900/30' : 'border-zinc-800 hover:border-zinc-700'}`}>
      <button className="w-full text-left px-4 py-3" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono text-zinc-300 flex-1 truncate">{endpoint.path}</code>
          <AuthBadge auth={endpoint.auth} />
          <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
        <p className="text-xs text-zinc-500 mt-1">{endpoint.summary}</p>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-400">{endpoint.description}</p>

          {endpoint.rateLimit && (
            <div className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/5 px-3 py-2 rounded">
              <Zap className="h-3 w-3" />
              {endpoint.rateLimit}
            </div>
          )}

          {endpoint.pathParams && endpoint.pathParams.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-zinc-400">Path Parameters</h4>
              <div className="space-y-1">
                {endpoint.pathParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs">
                    <code className="text-primary">{p.name}</code>
                    <span className="text-zinc-600">({p.type})</span>
                    {p.required && <Badge variant="outline" className="text-[9px] h-4">required</Badge>}
                    <span className="text-zinc-500">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-zinc-400">Query Parameters</h4>
              <div className="space-y-1">
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-xs flex-wrap">
                    <code className="text-primary">{p.name}</code>
                    <span className="text-zinc-600">({p.type})</span>
                    {p.default && <span className="text-zinc-600">default: {p.default}</span>}
                    <span className="text-zinc-500">{p.description}</span>
                    {p.enum && <span className="text-zinc-600">enum: [{p.enum.join(', ')}]</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.requestBody && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-zinc-400">Request Body <code className="text-zinc-600">{endpoint.requestBody.contentType}</code></h4>
              <div className="space-y-1">
                {endpoint.requestBody.fields.map((f) => (
                  <div key={f.name} className="flex items-start gap-2 text-xs">
                    <code className="text-primary">{f.name}</code>
                    <span className="text-zinc-600">({f.type})</span>
                    {f.required && <Badge variant="outline" className="text-[9px] h-4">required</Badge>}
                    <span className="text-zinc-500">{f.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">Responses</h4>
            {endpoint.responses.map((r) => (
              <div key={r.status} className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-zinc-500">{r.description}</span>
                </div>
                {r.example && <CodeBlock code={JSON.stringify(r.example, null, 2)} />}
              </div>
            ))}
          </div>

          {endpoint.testable && <ApiTester endpoint={endpoint} apiKey={apiKey} baseUrl={baseUrl} />}

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-zinc-400">Examples</h4>
            <Tabs defaultValue="curl">
              <TabsList className="h-8 bg-zinc-900">
                <TabsTrigger value="curl" className="text-xs h-6">cURL</TabsTrigger>
                <TabsTrigger value="js" className="text-xs h-6">JavaScript</TabsTrigger>
              </TabsList>
              <TabsContent value="curl"><CodeBlock code={generateCurl()} language="bash" /></TabsContent>
              <TabsContent value="js"><CodeBlock code={generateJs()} language="javascript" /></TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}

// Page Components
function GettingStartedPage({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Getting Started</h1>
        <p className="text-zinc-400">Get started with the SerikaGifs API in minutes.</p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4 flex items-start gap-3">
          <Terminal className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="text-sm text-zinc-300">
            <span className="font-medium">Building with an LLM or agent?</span> A compact,
            machine-readable reference of the entire API lives at{' '}
            <a href="/llms.txt" className="text-primary hover:underline font-mono">/llms.txt</a>.
            Paste it into your model&apos;s context for accurate, up-to-date endpoint definitions.
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Base URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-zinc-950 rounded border border-zinc-800">
            <code className="text-sm text-zinc-300 flex-1">{baseUrl}</code>
            <CopyButton text={baseUrl} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Start</h2>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-xs">1</span>
              Get an API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            Create an account and generate an API key from your <Link href="/settings" className="text-primary hover:underline">settings page</Link>.
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-xs">2</span>
              Make a Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`curl -X GET "${baseUrl}/gifs?q=funny&limit=10" \\
  -H "X-API-Key: ${apiKey || 'YOUR_API_KEY'}"`} language="bash" />
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-xs">3</span>
              Parse the Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={JSON.stringify({ gifs: [{ id: 'clx123', slug: 'funny-cat', title: 'Funny Cat', url: 'https://cdn.serika.dev/gifs/funny-cat.gif' }], pagination: { page: 1, limit: 10, total: 1234 } }, null, 2)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AuthenticationPage({ baseUrl, apiKey, userKeys, keysLoading }: { baseUrl: string; apiKey: string; userKeys: ApiKey[]; keysLoading: boolean }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Authentication</h1>
        <p className="text-zinc-400">Authenticate your API requests with API keys.</p>
      </div>

      {/* User's Keys */}
      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Your API Keys
          </CardTitle>
          <CardDescription>Select a key to use in examples</CardDescription>
        </CardHeader>
        <CardContent>
          {keysLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading keys...
            </div>
          ) : userKeys.length > 0 ? (
            <div className="space-y-2">
              {userKeys.map((key) => (
                <div key={key.id} className="flex items-center gap-3 p-3 bg-zinc-950 rounded border border-zinc-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{key.name}</span>
                      <Badge variant="outline" className="text-[10px]">{key.effectiveTier.replace('TIER_', 'Tier ')}</Badge>
                    </div>
                    <code className="text-xs text-zinc-500">{key.key}</code>
                  </div>
                  <CopyButton text={key.key} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              No API keys found. <Link href="/settings" className="text-primary hover:underline">Create one</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Authentication Methods</h2>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              X-API-Key Header
              <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px]">Recommended</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`curl -X GET "${baseUrl}/gifs" \\
  -H "X-API-Key: ${apiKey || 'YOUR_API_KEY'}"`} language="bash" />
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Authorization Bearer</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`curl -X GET "${baseUrl}/gifs" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}"`} language="bash" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">API Key Tiers</h2>
        <div className="grid gap-2">
          {[
            { tier: 'Tier 1', limit: '1,000/hr', desc: 'Default for new keys' },
            { tier: 'Tier 2', limit: '10,000/hr', desc: 'Request upgrade' },
            { tier: 'Tier 3', limit: '100,000/hr', desc: 'Request upgrade' },
            { tier: 'Tier 4', limit: '1,000,000/hr', desc: 'Request upgrade' },
            { tier: 'Tier 5', limit: 'Unlimited', desc: 'Strict guidelines apply' },
          ].map((t) => (
            <div key={t.tier} className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded border border-zinc-800">
              <Badge variant="outline">{t.tier}</Badge>
              <code className="text-sm">{t.limit}</code>
              <span className="text-xs text-zinc-500">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RateLimitsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Rate Limits</h1>
        <p className="text-zinc-400">Understand rate limits and quotas.</p>
      </div>

      <div className="grid gap-2">
        {[
          { label: 'Anonymous', limit: '30 requests', window: 'per hour', icon: <Globe className="h-4 w-4" />, color: 'text-zinc-400' },
          { label: 'Tier 1', limit: '1,000 requests', window: 'per hour', icon: <Key className="h-4 w-4" />, color: 'text-zinc-400' },
          { label: 'Tier 2', limit: '10,000 requests', window: 'per hour', icon: <Key className="h-4 w-4" />, color: 'text-blue-400' },
          { label: 'Tier 3', limit: '100,000 requests', window: 'per hour', icon: <Zap className="h-4 w-4" />, color: 'text-purple-400' },
          { label: 'Tier 4', limit: '1,000,000 requests', window: 'per hour', icon: <Zap className="h-4 w-4" />, color: 'text-amber-400' },
          { label: 'Tier 5', limit: 'Unlimited', window: '(strict guidelines)', icon: <Shield className="h-4 w-4" />, color: 'text-emerald-400' },
        ].map((t) => (
          <Card key={t.label} className="border-zinc-800 bg-zinc-900/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className={`h-8 w-8 rounded bg-zinc-800 flex items-center justify-center ${t.color}`}>{t.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-zinc-500">{t.limit} {t.window}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="text-base">Response Headers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { header: 'X-RateLimit-Limit', desc: 'Max requests in window' },
            { header: 'X-RateLimit-Remaining', desc: 'Requests remaining' },
            { header: 'X-RateLimit-Reset', desc: 'Unix timestamp of reset' },
            { header: 'Retry-After', desc: 'Seconds to wait (429 only)' },
          ].map((h) => (
            <div key={h.header} className="flex items-center gap-3 text-sm">
              <code className="text-primary">{h.header}</code>
              <span className="text-zinc-500">{h.desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="text-base">Handling 429 Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={`if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60;
  await sleep(retryAfter * 1000);
  // Retry request
}`} language="javascript" />
        </CardContent>
      </Card>
    </div>
  )
}

function ApiReferencePage({ apiKey, baseUrl }: { apiKey: string; baseUrl: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<string | null>(null)

  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  const filtered = API_SECTIONS.filter((s) => {
    if (section && s.id !== section) return false
    if (!search) return true
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || s.endpoints.some((e) => e.path.includes(q) || e.summary.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">API Reference</h1>
        <p className="text-zinc-400">Complete endpoint documentation.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search endpoints..." className="pl-9 bg-zinc-950 border-zinc-800" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(API_SECTIONS.flatMap((s) => s.endpoints.map((e) => `${s.id}-${e.method}-${e.path}`))))}><ChevronDown className="h-4 w-4 mr-1" />Expand</Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}><ChevronUp className="h-4 w-4 mr-1" />Collapse</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={section === null ? 'default' : 'outline'} size="sm" onClick={() => setSection(null)}>All</Button>
        {API_SECTIONS.map((s) => (
          <Button key={s.id} variant={section === s.id ? 'default' : 'outline'} size="sm" onClick={() => setSection(section === s.id ? null : s.id)} className="gap-1">
            {s.icon}{s.title}
          </Button>
        ))}
      </div>

      {filtered.map((s) => (
        <div key={s.id} className="space-y-3">
          <div className="flex items-center gap-2">
            {s.icon}
            <h2 className="font-semibold">{s.title}</h2>
            <span className="text-xs text-zinc-500">{s.description}</span>
          </div>
          <div className="space-y-2">
            {s.endpoints.filter((e) => !search || e.path.includes(search.toLowerCase()) || e.summary.toLowerCase().includes(search.toLowerCase())).map((e) => {
              const id = `${s.id}-${e.method}-${e.path}`
              return <EndpointCard key={id} endpoint={e} expanded={expanded.has(id)} onToggle={() => toggle(id)} apiKey={apiKey} baseUrl={baseUrl} />
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlaygroundPage({ apiKey, setApiKey, userKeys, keysLoading, baseUrl }: { apiKey: string; setApiKey: (k: string) => void; userKeys: ApiKey[]; keysLoading: boolean; baseUrl: string }) {
  const [selected, setSelected] = useState<Endpoint | null>(null)
  const [showKey, setShowKey] = useState(false)

  const testable = API_SECTIONS.flatMap((s) => s.endpoints.filter((e) => e.testable).map((e) => ({ ...e, section: s.title })))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Playground</h1>
        <p className="text-zinc-400">Test API endpoints live.</p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {userKeys.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Select from your keys</Label>
              <select value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded px-3 text-sm">
                <option value="">Select a key...</option>
                {userKeys.map((k) => <option key={k.id} value={k.key}>{k.name} ({k.effectiveTier.replace('TIER_', 'Tier ')})</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Or enter manually</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input type={showKey ? 'text' : 'password'} placeholder="sgif_..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="pr-8 font-mono text-sm bg-zinc-950 border-zinc-800" />
                <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-8" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
          {apiKey ? (
            <div className="flex items-center gap-2 text-xs text-emerald-500"><CheckCircle2 className="h-3 w-3" />Ready</div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-500"><AlertCircle className="h-3 w-3" />No key set</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Select Endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {testable.map((e) => (
              <button key={`${e.method}-${e.path}`} onClick={() => setSelected(e)} className={`text-left p-3 rounded border transition-colors ${selected?.path === e.path && selected?.method === e.method ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-zinc-700'}`}>
                <div className="flex items-center gap-2">
                  <MethodBadge method={e.method} />
                  <code className="text-xs text-zinc-400 truncate">{e.path}</code>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{e.summary}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <MethodBadge method={selected.method} />
              <code className="text-sm">{selected.path}</code>
              <AuthBadge auth={selected.auth} />
            </div>
          </CardHeader>
          <CardContent>
            <ApiTester endpoint={selected} apiKey={apiKey} baseUrl={baseUrl} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Main Component
export default function DocsPage() {
  const params = useParams()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [userKeys, setUserKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)

  const page = params.page as string
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api'

  // Fetch user's API keys
  useEffect(() => {
    setMounted(true)
    const fetchKeys = async () => {
      try {
        const res = await fetch('/api/keys', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUserKeys(data.keys || [])
          // Auto-select first key if available
          if (data.keys?.length > 0 && !apiKey) {
            setApiKey(data.keys[0].key)
          }
        }
      } catch {
        // User not logged in or error
      } finally {
        setKeysLoading(false)
      }
    }
    fetchKeys()
  }, [])

  if (!mounted) return null

  const validPages = ['getting-started', 'authentication', 'rate-limits', 'api-reference', 'playground']
  if (!validPages.includes(page)) {
    router.replace('/developer/docs/getting-started')
    return null
  }

  const renderContent = () => {
    switch (page) {
      case 'getting-started': return <GettingStartedPage baseUrl={baseUrl} apiKey={apiKey} />
      case 'authentication': return <AuthenticationPage baseUrl={baseUrl} apiKey={apiKey} userKeys={userKeys} keysLoading={keysLoading} />
      case 'rate-limits': return <RateLimitsPage />
      case 'api-reference': return <ApiReferencePage apiKey={apiKey} baseUrl={baseUrl} />
      case 'playground': return <PlaygroundPage apiKey={apiKey} setApiKey={setApiKey} userKeys={userKeys} keysLoading={keysLoading} baseUrl={baseUrl} />
      default: return <GettingStartedPage baseUrl={baseUrl} apiKey={apiKey} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <div className="sticky top-24 space-y-4">
              <div>
                <h2 className="font-semibold">API Documentation</h2>
                <p className="text-xs text-zinc-500">v1.0</p>
              </div>
              <nav className="space-y-1">
                {DOC_PAGES.map((p) => (
                  <Link key={p.slug} href={`/developer/docs/${p.slug}`} className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${page === p.slug ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                    {p.icon}
                    {p.title}
                  </Link>
                ))}
              </nav>
              <div className="pt-4 border-t border-zinc-800">
                <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50">
                  <Key className="h-4 w-4" />
                  Manage Keys
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 max-w-3xl">{renderContent()}</main>
        </div>
      </div>
    </div>
  )
}
