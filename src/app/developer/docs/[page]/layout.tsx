import type { Metadata } from 'next'

interface Props {
  params: Promise<{ page: string }>
  children: React.ReactNode
}

const PAGE_TITLES: Record<string, string> = {
  'getting-started': 'Getting Started | Developer Docs',
  'authentication': 'Authentication | Developer Docs',
  'rate-limits': 'Rate Limits | Developer Docs',
  'api-reference': 'API Reference | Developer Docs',
  'playground': 'API Playground | Developer Docs',
}

const PAGE_DESCRIPTIONS: Record<string, string> = {
  'getting-started': 'Get started with the SerikaGIFs API in minutes. Learn the basics and make your first API request.',
  'authentication': 'Authenticate your API requests with API keys. Learn how to generate and use API keys.',
  'rate-limits': 'Understand API rate limits, headers, and tier requirements for SerikaGIFs API.',
  'api-reference': 'Full API reference for SerikaGIFs. Endpoints for GIFs, tags, collections, and favorites.',
  'playground': 'Test SerikaGIFs API endpoints in real-time with the interactive API playground.',
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params
  const title = PAGE_TITLES[page] || 'Developer Docs'
  const description = PAGE_DESCRIPTIONS[page] || 'SerikaGIFs Developer API documentation.'
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'
  
  return {
    title: `${title} - SerikaGIFs`,
    description,
    keywords: ['developer api', 'docs', page, 'serikagifs', 'integration'],
    alternates: {
      canonical: `${SITE_URL}/developer/docs/${page}`
    }
  }
}

export default function DocsLayout({ children }: Props) {
  return <>{children}</>
}
