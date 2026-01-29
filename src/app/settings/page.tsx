'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Header } from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  User, 
  Key, 
  Bell, 
  Palette, 
  Loader2, 
  Copy, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2,
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react'
import { useRequireAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { useLocalStorage } from '@/hooks/use-local-storage'

interface ApiKey {
  id: string
  name: string
  key: string
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3'
  effectiveTier: 'TIER_1' | 'TIER_2' | 'TIER_3'
  createdAt: string
  lastUsedAt?: string
}

const TIER_INFO = {
  TIER_1: { name: 'Tier 1', limit: '100k/hour', color: 'bg-zinc-500' },
  TIER_2: { name: 'Tier 2', limit: '1M/hour', color: 'bg-blue-500' },
  TIER_3: { name: 'Tier 3', limit: 'Unlimited', color: 'bg-amber-500' },
}

interface NotificationSettings {
  emailNotifications: boolean
  newFollowers: boolean
  gifFavorites: boolean
}

interface AppearanceSettings {
  autoplayGifs: boolean
  reduceMotion: boolean
  showNsfw: boolean
}

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useRequireAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingKeys, setIsLoadingKeys] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showKey, setShowKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  
  // Settings stored in localStorage
  const { value: notifications, setValue: setNotifications } = useLocalStorage<NotificationSettings>('serika-notifications', {
    emailNotifications: true,
    newFollowers: true,
    gifFavorites: true,
  })
  
  const { value: appearance, setValue: setAppearance } = useLocalStorage<AppearanceSettings>('serika-appearance', {
    autoplayGifs: true,
    reduceMotion: false,
    showNsfw: false,
  })

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load API keys on mount
  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const response = await fetch('/api/keys')
      const data = await response.json()
      if (data.keys) {
        setApiKeys(data.keys)
        setIsAdmin(data.isAdmin || false)
      }
    } catch {
      console.error('Failed to load API keys')
    } finally {
      setIsLoadingKeys(false)
    }
  }

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
        setShowKey(data.key.id) // Show the new key immediately
        toast.success('API key generated! Make sure to copy it now.')
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
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' })
      if (response.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== keyId))
        toast.success('API key deleted')
      } else {
        toast.error('Failed to delete API key')
      }
    } catch {
      toast.error('Failed to delete API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const updateNotification = (key: keyof NotificationSettings, value: boolean) => {
    setNotifications({ ...notifications, [key]: value })
    toast.success('Setting saved')
  }

  const updateAppearance = (key: keyof AppearanceSettings, value: boolean) => {
    setAppearance({ ...appearance, [key]: value })
    toast.success('Setting saved')
  }

  if (authLoading || !mounted) {
    return null
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

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
            <TabsTrigger value="profile" className="text-xs sm:text-sm">
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs sm:text-sm">
              <Key className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm">
              <Bell className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs sm:text-sm">
              <Palette className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Appearance</span>
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
                    onKeyDown={(e) => e.key === 'Enter' && generateApiKey()}
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

                {isLoadingKeys ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No API keys yet. Generate one to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => {
                      const tierInfo = TIER_INFO[key.effectiveTier]
                      return (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{key.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full text-white ${tierInfo.color}`}>
                                {tierInfo.name} ({tierInfo.limit})
                              </span>
                              {isAdmin && key.tier !== key.effectiveTier && (
                                <span className="text-xs text-muted-foreground">(Admin)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background px-2 py-1 rounded truncate max-w-[200px]">
                                {showKey === key.id ? key.key : '••••••••••••••••••••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
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
                                className="h-6 w-6 shrink-0"
                                onClick={() => copyToClipboard(key.key)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            {key.lastUsedAt && (
                              <p className="text-xs text-muted-foreground">
                                Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive shrink-0"
                            onClick={() => deleteApiKey(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="pt-4 border-t space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Rate Limits</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><span className="inline-block w-3 h-3 rounded-full bg-zinc-500 mr-2"></span><strong>Tier 1:</strong> 100,000 requests/hour (default)</p>
                      <p><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span><strong>Tier 2:</strong> 1,000,000 requests/hour (request quota increase)</p>
                      <p><span className="inline-block w-3 h-3 rounded-full bg-amber-500 mr-2"></span><strong>Tier 3:</strong> Unlimited (request quota increase)</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">API Usage</h4>
                    <p className="text-sm text-muted-foreground">
                      Use your API key with the <code className="bg-muted px-1 rounded">X-API-Key</code> header
                      or as a query parameter <code className="bg-muted px-1 rounded">?api_key=YOUR_KEY</code>
                    </p>
                  </div>
                </div>
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
                  <Switch 
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) => updateNotification('emailNotifications', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">New Followers</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone follows you
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.newFollowers}
                    onCheckedChange={(checked) => updateNotification('newFollowers', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">GIF Favorites</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone favorites your GIF
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.gifFavorites}
                    onCheckedChange={(checked) => updateNotification('gifFavorites', checked)}
                  />
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
              <CardContent className="space-y-6">
                {/* Theme Selection */}
                <div className="space-y-3">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {themes.map(({ value, label, icon: Icon }) => (
                      <Button
                        key={value}
                        variant={theme === value ? 'default' : 'outline'}
                        className="justify-start gap-2"
                        onClick={() => setTheme(value)}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                        {theme === value && <Check className="h-4 w-4 ml-auto" />}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Autoplay GIFs</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play GIFs when scrolling
                    </p>
                  </div>
                  <Switch 
                    checked={appearance.autoplayGifs}
                    onCheckedChange={(checked) => updateAppearance('autoplayGifs', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Reduce Motion</p>
                    <p className="text-sm text-muted-foreground">
                      Show static thumbnails instead of animated previews
                    </p>
                  </div>
                  <Switch 
                    checked={appearance.reduceMotion}
                    onCheckedChange={(checked) => updateAppearance('reduceMotion', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show NSFW Content</p>
                    <p className="text-sm text-muted-foreground">
                      Display content marked as not safe for work
                    </p>
                  </div>
                  <Switch 
                    checked={appearance.showNsfw}
                    onCheckedChange={(checked) => updateAppearance('showNsfw', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
