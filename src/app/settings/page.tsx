'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Settings, User, Key, Bell, Palette, Loader2, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useRequireAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useRequireAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; key: string; createdAt: string }[]>([])
  const [showKey, setShowKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for your API key')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })

      const data = await response.json()

      if (data.success) {
        setApiKeys([...apiKeys, data.key])
        setNewKeyName('')
        toast.success('API key generated!')
      } else {
        toast.error(data.error || 'Failed to generate API key')
      }
    } catch {
      toast.error('Failed to generate API key')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteApiKey = async (keyId: string) => {
    try {
      await fetch(`/api/keys/${keyId}`, { method: 'DELETE' })
      setApiKeys(apiKeys.filter(k => k.id !== keyId))
      toast.success('API key deleted')
    } catch {
      toast.error('Failed to delete API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  if (authLoading) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={user?.username || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Username changes are managed through your Serika account
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email changes are managed through your Serika account
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Generate API keys to access SerikaGifs programmatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="API key name (e.g., My App)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <Button onClick={generateApiKey} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>

                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No API keys yet. Generate one to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{key.name}</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded">
                              {showKey === key.id ? key.key : '••••••••••••••••'}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                            >
                              {showKey === key.id ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(key.key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteApiKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Control how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive email updates about your account
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">New Followers</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone follows you
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">GIF Favorites</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone favorites your GIF
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how SerikaGifs looks for you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Use dark theme (always on for AMOLED black)
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Autoplay GIFs</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play GIFs when scrolling
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Reduce Motion</p>
                    <p className="text-sm text-muted-foreground">
                      Reduce animations and motion effects
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
