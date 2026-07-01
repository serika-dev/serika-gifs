'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  User,
  Key,
  ArrowUpRight,
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

interface QuotaRequest {
  id: string
  requestedTier: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
  user: {
    id: string
    username: string
    email: string
    avatar: string | null
  }
  apiKey: {
    id: string
    name: string
    tier: string
    key: string
  }
}

interface Stats {
  pending: number
  approved: number
  denied: number
  total: number
}

const TIER_INFO: Record<string, { name: string; limit: string; color: string }> = {
  TIER_1: { name: 'Tier 1', limit: '1,000/hour', color: 'bg-zinc-500' },
  TIER_2: { name: 'Tier 2', limit: '10,000/hour', color: 'bg-blue-500' },
  TIER_3: { name: 'Tier 3', limit: '100,000/hour', color: 'bg-purple-500' },
  TIER_4: { name: 'Tier 4', limit: '1,000,000/hour', color: 'bg-amber-500' },
  TIER_5: { name: 'Tier 5', limit: 'Unlimited', color: 'bg-emerald-500' },
}

export default function AdminQuotasPage() {
  const [requests, setRequests] = useState<QuotaRequest[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<QuotaRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [dialogAction, setDialogAction] = useState<'approve' | 'deny' | null>(null)

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/admin/quotas?status=${filter}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setRequests(data.requests)
      setStats(data.stats)
    } catch {
      toast.error('Failed to load quota requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [filter])

  const handleAction = async (action: 'approve' | 'deny') => {
    if (!selectedRequest) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/admin/quotas/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote: adminNote || undefined }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to process request')
      }

      toast.success(
        action === 'approve'
          ? `Approved! API key upgraded to ${TIER_INFO[selectedRequest.requestedTier]?.name}`
          : 'Request denied'
      )
      
      setSelectedRequest(null)
      setAdminNote('')
      setDialogAction(null)
      fetchRequests()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process request')
    } finally {
      setActionLoading(false)
    }
  }

  const openActionDialog = (request: QuotaRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request)
    setDialogAction(action)
    setAdminNote('')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="border-amber-500/50 text-amber-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      case 'APPROVED':
        return <Badge variant="outline" className="border-emerald-500/50 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>
      case 'DENIED':
        return <Badge variant="outline" className="border-red-500/50 text-red-500"><XCircle className="w-3 h-3 mr-1" /> Denied</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Quota Requests</h1>
              <p className="text-muted-foreground text-sm">
                Manage API key tier upgrade requests
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card 
              className={`cursor-pointer transition-colors ${filter === 'PENDING' ? 'ring-2 ring-amber-500/50' : 'hover:border-amber-500/30'}`}
              onClick={() => setFilter('PENDING')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
                    <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-colors ${filter === 'APPROVED' ? 'ring-2 ring-emerald-500/50' : 'hover:border-emerald-500/30'}`}
              onClick={() => setFilter('APPROVED')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Approved</p>
                    <p className="text-2xl font-bold text-emerald-500">{stats.approved}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-colors ${filter === 'DENIED' ? 'ring-2 ring-red-500/50' : 'hover:border-red-500/30'}`}
              onClick={() => setFilter('DENIED')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Denied</p>
                    <p className="text-2xl font-bold text-red-500">{stats.denied}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-colors ${filter === 'all' ? 'ring-2 ring-primary/50' : 'hover:border-primary/30'}`}
              onClick={() => setFilter('all')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Filter className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Requests List */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {filter === 'all' ? 'All Requests' : `${filter.charAt(0) + filter.slice(1).toLowerCase()} Requests`}
            </CardTitle>
            <CardDescription>
              {filter === 'PENDING' 
                ? 'Review and process pending quota upgrade requests'
                : `Showing ${filter.toLowerCase()} quota requests`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No {filter === 'all' ? '' : filter.toLowerCase()} quota requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="border border-border rounded-md p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left side - User & Request info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{request.user.username}</span>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>

                        <div className="flex items-center gap-2 text-sm mb-3">
                          <Key className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{request.apiKey.name}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {TIER_INFO[request.apiKey.tier]?.name || request.apiKey.tier}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className={`text-xs text-white ${TIER_INFO[request.requestedTier]?.color || 'bg-primary'}`}>
                              {TIER_INFO[request.requestedTier]?.name || request.requestedTier}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-muted rounded-md p-3 mb-3">
                          <p className="text-sm text-muted-foreground mb-1 font-medium">Reason:</p>
                          <p className="text-sm">{request.reason}</p>
                        </div>

                        {request.adminNote && (
                          <div className="bg-muted rounded-md p-3 border-l-2 border-primary">
                            <p className="text-sm text-muted-foreground mb-1 font-medium">Admin Note:</p>
                            <p className="text-sm">{request.adminNote}</p>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-3">
                          Submitted {formatDate(request.createdAt)}
                          {request.resolvedAt && ` • Reviewed ${formatDate(request.resolvedAt)}`}
                        </p>
                      </div>

                      {/* Right side - Actions */}
                      {request.status === 'PENDING' && (
                        <div className="flex md:flex-col gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => openActionDialog(request, 'approve')}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => openActionDialog(request, 'deny')}
                          >
                            <X className="h-4 w-4" />
                            Deny
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={dialogAction !== null} onOpenChange={() => { setDialogAction(null); setSelectedRequest(null); setAdminNote(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogAction === 'approve' ? 'Approve Quota Request' : 'Deny Quota Request'}
              </DialogTitle>
              <DialogDescription>
                {dialogAction === 'approve'
                  ? `This will upgrade ${selectedRequest?.user.username}'s API key "${selectedRequest?.apiKey.name}" to ${TIER_INFO[selectedRequest?.requestedTier || '']?.name} (${TIER_INFO[selectedRequest?.requestedTier || '']?.limit}).`
                  : `This will deny ${selectedRequest?.user.username}'s request to upgrade their API key.`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                Admin Note (optional)
              </label>
              <Textarea
                placeholder={dialogAction === 'approve' 
                  ? "e.g., Approved based on project requirements..."
                  : "e.g., Please provide more details about your use case..."}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setDialogAction(null); setSelectedRequest(null); setAdminNote(''); }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleAction(dialogAction!)}
                disabled={actionLoading}
                className={dialogAction === 'approve' 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : 'bg-destructive hover:bg-destructive/90'}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {dialogAction === 'approve' ? 'Approve & Upgrade' : 'Deny Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
