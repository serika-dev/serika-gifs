// Client-side API service for making requests to the backend
import { API_ENDPOINTS } from './constants'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface RequestOptions {
  method?: RequestMethod
  body?: unknown
  headers?: Record<string, string>
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(url, config)
  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.error || 'Request failed',
      response.status,
      data
    )
  }

  return data
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    request<{ success: boolean; user?: any; error?: string }>(
      API_ENDPOINTS.auth.login,
      { method: 'POST', body: { email, password } }
    ),

  register: (username: string, email: string, password: string) =>
    request<{ success: boolean; user?: any; error?: string }>(
      API_ENDPOINTS.auth.register,
      { method: 'POST', body: { username, email, password } }
    ),

  logout: () =>
    request<{ success: boolean }>(
      API_ENDPOINTS.auth.logout,
      { method: 'POST' }
    ),

  getSession: () =>
    request<{ user: any | null }>(API_ENDPOINTS.auth.session),
}

// GIFs API
export const gifsApi = {
  list: (params?: { cursor?: string; limit?: number; tag?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.cursor) searchParams.set('cursor', params.cursor)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.tag) searchParams.set('tag', params.tag)
    
    return request<{ gifs: any[]; nextCursor?: string }>(
      `${API_ENDPOINTS.gifs.list}?${searchParams}`
    )
  },

  get: (slugOrId: string) =>
    request<{ gif: any }>(`${API_ENDPOINTS.gifs.list}/${slugOrId}`),

  search: (query: string, params?: { cursor?: string; limit?: number }) => {
    const searchParams = new URLSearchParams({ q: query })
    if (params?.cursor) searchParams.set('cursor', params.cursor)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    
    return request<{ gifs: any[]; nextCursor?: string }>(
      `${API_ENDPOINTS.gifs.search}?${searchParams}`
    )
  },

  trending: (params?: { cursor?: string; limit?: number }) => {
    const searchParams = new URLSearchParams({ sort: 'trending' })
    if (params?.cursor) searchParams.set('cursor', params.cursor)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    
    return request<{ gifs: any[]; nextCursor?: string }>(
      `${API_ENDPOINTS.gifs.list}?${searchParams}`
    )
  },

  upload: (formData: FormData) =>
    fetch(API_ENDPOINTS.gifs.upload, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(r => r.json()),

  delete: (id: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.gifs.list}/${id}`,
      { method: 'DELETE' }
    ),

  update: (id: string, data: { title?: string; description?: string; tags?: string[] }) =>
    request<{ gif: any }>(
      `${API_ENDPOINTS.gifs.list}/${id}`,
      { method: 'PATCH', body: data }
    ),
}

// Tags API
export const tagsApi = {
  list: () =>
    request<{ tags: any[] }>(API_ENDPOINTS.tags.list),

  popular: (limit = 20) =>
    request<{ tags: any[] }>(`${API_ENDPOINTS.tags.popular}?limit=${limit}`),

  get: (slug: string) =>
    request<{ tag: any }>(`${API_ENDPOINTS.tags.list}/${slug}`),
}

// Collections API
export const collectionsApi = {
  list: () =>
    request<{ collections: any[] }>(API_ENDPOINTS.collections.list),

  get: (id: string) =>
    request<{ collection: any }>(`${API_ENDPOINTS.collections.list}/${id}`),

  create: (data: { name: string; description?: string; isPublic?: boolean }) =>
    request<{ collection: any }>(
      API_ENDPOINTS.collections.list,
      { method: 'POST', body: data }
    ),

  update: (id: string, data: { name?: string; description?: string; isPublic?: boolean }) =>
    request<{ collection: any }>(
      `${API_ENDPOINTS.collections.list}/${id}`,
      { method: 'PATCH', body: data }
    ),

  delete: (id: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.collections.list}/${id}`,
      { method: 'DELETE' }
    ),

  addGif: (collectionId: string, gifId: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.collections.list}/${collectionId}/gifs`,
      { method: 'POST', body: { gifId } }
    ),

  removeGif: (collectionId: string, gifId: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.collections.list}/${collectionId}/gifs/${gifId}`,
      { method: 'DELETE' }
    ),
}

// Favorites API
export const favoritesApi = {
  list: () =>
    request<{ favorites: any[] }>(API_ENDPOINTS.favorites.list),

  add: (gifId: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.favorites.list}/${gifId}`,
      { method: 'POST' }
    ),

  remove: (gifId: string) =>
    request<{ success: boolean }>(
      `${API_ENDPOINTS.favorites.list}/${gifId}`,
      { method: 'DELETE' }
    ),

  check: (gifId: string) =>
    request<{ isFavorited: boolean }>(
      `${API_ENDPOINTS.favorites.list}/${gifId}`
    ),
}

// Admin API
export const adminApi = {
  import: (source: string, data: any) =>
    request<{ success: boolean; importJob?: any }>(
      API_ENDPOINTS.admin.import,
      { method: 'POST', body: { source, ...data } }
    ),

  getStats: () =>
    request<{ stats: any }>('/api/admin/stats'),

  getImportJobs: () =>
    request<{ jobs: any[] }>('/api/admin/import'),
}

export { ApiError }
