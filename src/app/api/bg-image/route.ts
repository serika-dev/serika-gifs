import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.SERIKA_ART_API_KEY
    if (!apiKey) {
      throw new Error('SERIKA_ART_API_KEY is not defined in the environment')
    }

    // Query for safe, random landscape background images
    const apiUrl = 'https://serika.art/api/v1/random?count=1&ratings=safe&min_width=1280&min_height=720'

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      // Avoid caching of random image endpoint
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('serika.art API error response:', errorText)
      throw new Error(`Failed to fetch from serika.art API: ${response.statusText}`)
    }

    const json = await response.json()
    
    if (json.success && json.data) {
      // Find the first tag of type 'artist'
      const artistTag = json.data.tags?.find((t: any) => t.type === 'artist')
      const authorName = artistTag 
        ? artistTag.name.replace(/_/g, ' ') 
        : (json.data.user?.username || 'Anonymous')
      
      const profileUrl = artistTag
        ? `https://serika.art/posts?tags=${encodeURIComponent(artistTag.name)}`
        : `https://serika.art/user/${encodeURIComponent(json.data.user?.username || '')}`

      return NextResponse.json({
        success: true,
        bgImage: {
          url: json.data.thumbnail_url || json.data.url,
          author: authorName,
          profile: profileUrl
        }
      })
    }

    throw new Error('Invalid API response format from serika.art')
  } catch (error: any) {
    console.error('Error in bg-image API route:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch background image' },
      { status: 500 }
    )
  }
}
