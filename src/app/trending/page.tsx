import { Header } from '@/components/header'
import { GifGrid } from '@/components/gif-grid'
import { TrendingUp } from 'lucide-react'

export default function TrendingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Trending GIFs</h1>
          </div>
          <p className="text-muted-foreground">
            The most popular GIFs right now
          </p>
        </div>

        <GifGrid />
      </main>
    </div>
  )
}
