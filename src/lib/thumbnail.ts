import sharp from 'sharp'
import { uploadToB2 } from './storage'

export interface ThumbnailOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  maxWidth: 320,
  maxHeight: 320,
  quality: 80,
}

/**
 * Extract the first frame from a GIF and create a static WebP thumbnail
 * This results in much smaller file sizes and faster loading
 */
export async function generateStaticThumbnail(
  gifBuffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Use sharp to get the first frame and convert to WebP
  // WebP is smaller and better supported than JPEG for transparency
  const thumbnail = await sharp(gifBuffer, { 
    animated: false, // Only get first frame
    pages: 1, // Limit to first page/frame
  })
    .resize(opts.maxWidth, opts.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ 
      quality: opts.quality,
      effort: 4, // Balance between speed and compression
    })
    .toBuffer()
  
  return thumbnail
}

/**
 * Generate and upload a static thumbnail for a GIF
 * Returns the public URL of the uploaded thumbnail
 */
export async function generateAndUploadThumbnail(
  gifBuffer: Buffer,
  userId: string,
  slug: string,
  options: ThumbnailOptions = {}
): Promise<string> {
  const thumbnailBuffer = await generateStaticThumbnail(gifBuffer, options)
  
  const key = `thumbnails/${userId}/${slug}.webp`
  const url = await uploadToB2(thumbnailBuffer, key, 'image/webp')
  
  return url
}

/**
 * Generate a static thumbnail from a URL
 */
export async function generateThumbnailFromUrl(
  gifUrl: string,
  userId: string,
  slug: string,
  timeout = 30000,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(gifUrl, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`)
    }
    
    const buffer = Buffer.from(await response.arrayBuffer())
    return await generateAndUploadThumbnail(buffer, userId, slug, options)
  } catch (error) {
    console.error('Failed to generate thumbnail:', error)
    return null
  }
}
