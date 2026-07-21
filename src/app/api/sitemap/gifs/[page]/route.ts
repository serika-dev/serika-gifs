import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface Props {
  params: Promise<{ page: string }>
}

export async function GET(request: Request, { params }: Props) {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'
  const { page } = await params
  
  // Extract number from "[number].xml"
  const pageStr = page.replace('.xml', '')
  const pageNum = parseInt(pageStr, 10)
  
  if (isNaN(pageNum) || pageNum < 1) {
    return new NextResponse('Invalid page parameter', { status: 400 })
  }
  
  const PAGE_SIZE = 5000
  const skip = (pageNum - 1) * PAGE_SIZE
  
  // Fetch GIFs for this page
  const gifs = await prisma.gif.findMany({
    where: { isPublic: true },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: PAGE_SIZE,
  })
  
  if (gifs.length === 0 && pageNum > 1) {
    return new NextResponse('Page not found', { status: 404 })
  }
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  
  for (const gif of gifs) {
    xml += `  <url>\n`
    xml += `    <loc>${SITE_URL}/gif/${gif.slug}</loc>\n`
    xml += `    <lastmod>${gif.updatedAt.toISOString()}</lastmod>\n`
    xml += `    <changefreq>monthly</changefreq>\n`
    xml += `    <priority>0.5</priority>\n`
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
