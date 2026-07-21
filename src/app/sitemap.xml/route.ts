import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'
  
  // Count total public GIFs
  const totalGifs = await prisma.gif.count({
    where: { isPublic: true }
  })
  
  // 5000 GIFs per sitemap page
  const gifsPageCount = Math.ceil(totalGifs / 5000)
  
  // Build sitemap index XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  
  // Static sitemap
  xml += `  <sitemap>\n`
  xml += `    <loc>${SITE_URL}/api/sitemap/static.xml</loc>\n`
  xml += `  </sitemap>\n`
  
  // Tags sitemap
  xml += `  <sitemap>\n`
  xml += `    <loc>${SITE_URL}/api/sitemap/tags.xml</loc>\n`
  xml += `  </sitemap>\n`
  
  // GIF sitemaps
  for (let i = 1; i <= gifsPageCount; i++) {
    xml += `  <sitemap>\n`
    xml += `    <loc>${SITE_URL}/api/sitemap/gifs/${i}.xml</loc>\n`
    xml += `  </sitemap>\n`
  }
  
  xml += `</sitemapindex>`
  
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    }
  })
}
