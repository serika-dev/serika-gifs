import { NextRequest, NextResponse } from 'next/server'
import prisma from './prisma'

// In-memory rate limit store (resets on server restart)
// For production, use Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per minute for anonymous users

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  isAuthenticated: boolean
}

/**
 * Get the client identifier (IP address or forwarded IP)
 */
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

/**
 * Validate an API key and return the user ID if valid
 */
async function validateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('sgif_')) {
    return null
  }

  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      select: { id: true, userId: true },
    })

    if (key) {
      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      return key.userId
    }
  } catch (error) {
    console.error('Error validating API key:', error)
  }

  return null
}

/**
 * Check rate limit for a request
 * Returns whether the request is allowed and remaining quota
 */
export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  // Check for API key in header
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
  
  if (apiKey) {
    const userId = await validateApiKey(apiKey)
    if (userId) {
      // Authenticated users have no rate limit
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
        isAuthenticated: true,
      }
    }
  }

  // Anonymous users get rate limited
  const clientId = getClientId(request)
  const now = Date.now()
  
  let record = rateLimitStore.get(clientId)
  
  // Clean up old records and reset if window has passed
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
    }
  }
  
  record.count++
  rateLimitStore.set(clientId, record)
  
  const allowed = record.count <= RATE_LIMIT_MAX_REQUESTS
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count)
  
  return {
    allowed,
    remaining,
    resetTime: record.resetTime,
    isAuthenticated: false,
  }
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later or use an API key for unlimited access.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
      },
    }
  )
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  if (!result.isAuthenticated) {
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))
  }
  return response
}

// Cleanup old rate limit records periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)
