import { NextRequest, NextResponse } from 'next/server'
import prisma from './prisma'
import { ApiKeyTier } from '@prisma/client'

// In-memory rate limit store (resets on server restart)
// For production, use Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per hour for anonymous users

// Tier-based rate limits (per hour)
const TIER_LIMITS: Record<ApiKeyTier, number> = {
  TIER_1: 1_000,       // 1k/hour (default)
  TIER_2: 10_000,      // 10k/hour (quota request required)
  TIER_3: 100_000,     // 100k/hour (quota request required)
  TIER_4: 1_000_000,   // 1M/hour (quota request required)
  TIER_5: Infinity,    // Unlimited (quota request required, admin keys auto-upgrade)
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  isAuthenticated: boolean
  tier?: ApiKeyTier
  limit?: number
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
 * Validate an API key and return key info if valid
 */
async function validateApiKey(apiKey: string): Promise<{ userId: string; tier: ApiKeyTier; isAdmin: boolean } | null> {
  if (!apiKey || !apiKey.startsWith('sgif_')) {
    return null
  }

  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      select: { 
        id: true, 
        userId: true, 
        tier: true,
        user: {
          select: { isAdmin: true }
        }
      },
    })

    if (key) {
      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
      // Admin keys are always TIER_5
      const effectiveTier = key.user.isAdmin ? ApiKeyTier.TIER_5 : key.tier
      return { userId: key.userId, tier: effectiveTier, isAdmin: key.user.isAdmin }
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
    const keyInfo = await validateApiKey(apiKey)
    if (keyInfo) {
      const limit = TIER_LIMITS[keyInfo.tier]
      
      // Tier 5 (unlimited) - no rate limiting
      if (keyInfo.tier === ApiKeyTier.TIER_5) {
        return {
          allowed: true,
          remaining: Infinity,
          resetTime: 0,
          isAuthenticated: true,
          tier: keyInfo.tier,
          limit,
        }
      }
      
      // Tier 1-4 - apply hourly rate limits
      const rateLimitKey = `api:${keyInfo.userId}`
      const now = Date.now()
      
      let record = rateLimitStore.get(rateLimitKey)
      
      if (!record || now > record.resetTime) {
        record = {
          count: 0,
          resetTime: now + RATE_LIMIT_WINDOW,
        }
      }
      
      record.count++
      rateLimitStore.set(rateLimitKey, record)
      
      const allowed = record.count <= limit
      const remaining = Math.max(0, limit - record.count)
      
      return {
        allowed,
        remaining,
        resetTime: record.resetTime,
        isAuthenticated: true,
        tier: keyInfo.tier,
        limit,
      }
    }
  }

  // Anonymous users get rate limited (per minute, more restrictive)
  const clientId = getClientId(request)
  const now = Date.now()
  const anonWindow = 60 * 1000 // 1 minute for anonymous
  
  let record = rateLimitStore.get(clientId)
  
  // Clean up old records and reset if window has passed
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + anonWindow,
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
export function rateLimitResponse(resetTime: number, result?: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
  const limit = result?.limit || RATE_LIMIT_MAX_REQUESTS
  const tier = result?.tier
  
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: tier 
        ? `Rate limit exceeded for ${tier.replace('_', ' ')}. ${tier === 'TIER_1' ? 'Request a quota increase for higher limits.' : 'Please try again later.'}`
        : 'Too many requests. Please try again later or use an API key for higher limits.',
      retryAfter,
      tier,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
        ...(tier && { 'X-RateLimit-Tier': tier }),
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
  const limit = result.limit || RATE_LIMIT_MAX_REQUESTS
  
  if (result.tier !== ApiKeyTier.TIER_5) {
    response.headers.set('X-RateLimit-Limit', String(limit))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))
    if (result.tier) {
      response.headers.set('X-RateLimit-Tier', result.tier)
    }
  }
  return response
}

// Export tier limits for use in other files
export { TIER_LIMITS, ApiKeyTier }

// Cleanup old rate limit records periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)
