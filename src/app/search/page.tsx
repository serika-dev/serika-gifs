import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  const query = q || ''

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {query ? `Search results for "${query}"` : 'Search GIFs'}
          </h1>
          <p className="text-muted-foreground">
            {query
              ? 'Showing GIFs matching your search'
              : 'Enter a search term to find GIFs'}
          </p>
        </div>

        {query && <GifGrid search={query} />}
      </main>
    </div>
  )
}
