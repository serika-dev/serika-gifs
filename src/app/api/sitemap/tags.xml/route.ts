import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'
  
  // Fetch tags that have at least 1 public GIF
  const tags = await prisma.tag.findMany({
    where: {
      slug: { not: 'import' },
      gifs: {
        some: {
          gif: { isPublic: true }
        }
      }
    },
    orderBy: {
      gifs: {
        _count: 'desc'
      }
    },
    take: 50000
  })
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  
  const now = new Date().toISOString()
  
  for (const tag of tags) {
    xml += `  <url>\n`
    xml += `    <loc>${SITE_URL}/tag/${tag.slug}</loc>\n`
    xml += `    <lastmod>${now}</lastmod>\n`
    xml += `    <changefreq>weekly</changefreq>\n`
    xml += `    <priority>0.6</priority>\n`
    xml += `  </url>\n`
  }
  
  xml += `</urlset>`
  
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=1800'
    }
  })
}
