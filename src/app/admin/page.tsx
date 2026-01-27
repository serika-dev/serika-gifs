import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Download, 
  Users, 
  Image as ImageIcon, 
  BarChart3,
  Settings,
  Key
} from 'lucide-react'
import prisma from '@/lib/prisma'

async function getStats() {
  const [totalGifs, totalUsers, totalImports] = await Promise.all([
    prisma.gif.count(),
    prisma.user.count(),
    prisma.importJob.count({ where: { status: 'COMPLETED' } }),
  ])

  const importedGifs = await prisma.gif.count({
    where: {
      source: { not: 'UPLOAD' },
    },
  })

  return { totalGifs, totalUsers, totalImports, importedGifs }
}

export default async function AdminPage() {
  const stats = await getStats()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your GIF sharing platform
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Site</Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total GIFs</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGifs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.importedGifs} imported
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Registered users
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Import Jobs</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalImports}</div>
              <p className="text-xs text-muted-foreground">
                Completed imports
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">B2</div>
              <p className="text-xs text-muted-foreground">
                Backblaze connected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin/import">
            <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Download className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Import GIFs</CardTitle>
                <CardDescription>
                  Import GIFs from Tenor, Giphy, and Klipy
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/users">
            <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                  View and manage user accounts
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/api-keys">
            <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Key className="h-8 w-8 text-primary mb-2" />
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for external services
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/admin/settings">
            <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Settings className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure platform settings
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
