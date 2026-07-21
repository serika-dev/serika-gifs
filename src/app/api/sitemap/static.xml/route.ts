import { NextResponse } from 'next/server'

export async function GET() {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'
  
  const staticPages = [
    '',
    '/trending',
    '/tags',
    '/collections',
    '/guidelines',
    '/terms',
    '/privacy',
    '/dmca',
    '/developer/docs/getting-started',
    '/developer/docs/authentication',
    '/developer/docs/rate-limits',
    '/developer/docs/api-reference',
    '/developer/docs/playground',
  ]
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  
  const now = new Date().toISOString()
  
  for (const page of staticPages) {
    xml += `  <url>\n`
    xml += `    <loc>${SITE_URL}${page}</loc>\n`
    xml += `    <lastmod>${now}</lastmod>\n`
    xml += `    <changefreq>daily</changefreq>\n`
    xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`
    xml += `  </url>\n`
  }
  
  xml += `</urlset>`
  
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
    }
  })
}
