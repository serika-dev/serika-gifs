'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Mail,
  Building,
  FileText,
  Link as LinkIcon,
  Tag,
  Trash2,
  Eye,
  RefreshCw,
} from 'lucide-react'

interface DmcaRequest {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'COUNTER_FILED'
  claimantName: string
  claimantEmail: string
  claimantCompany: string | null
  copyrightWork: string
  infringingUrls: string[]
  tagSlug: string | null
  statement: string
  signature: string
  adminNote: string | null
  processedAt: string | null
  removedCount: number
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    icon: Clock,
  },
  PROCESSING: {
    label: 'Processing',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Loader2,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: XCircle,
  },
  COUNTER_FILED: {
    label: 'Counter Filed',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    icon: AlertTriangle,
  },
}

export default function AdminDmcaPage() {
  const [requests, setRequests] = useState<DmcaRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedRequest, setSelectedRequest] = useState<DmcaRequest | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [processDialogOpen, setProcessDialogOpen] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const response = await fetch(`/api/admin/dmca?${params}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setRequests(data.dmcaRequests)
    } catch {
      toast.error('Failed to fetch DMCA requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleViewRequest = (request: DmcaRequest) => {
    setSelectedRequest(request)
    setAdminNote(request.adminNote || '')
    setViewDialogOpen(true)
  }

  const handleProcessClick = (request: DmcaRequest) => {
    setSelectedRequest(request)
    setProcessDialogOpen(true)
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedRequest) return

    try {
      const response = await fetch(`/api/admin/dmca/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote }),
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success(`Request marked as ${status.toLowerCase()}`)
      setViewDialogOpen(false)
      fetchRequests()
    } catch {
      toast.error('Failed to update request')
    }
  }

  const handleProcessTakedown = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/admin/dmca/${selectedRequest.id}/process`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to process')

      const data = await response.json()
      toast.success(`Takedown completed. ${data.removedCount} item(s) removed.`)
      setProcessDialogOpen(false)
      fetchRequests()
    } catch {
      toast.error('Failed to process takedown')
    } finally {
      setProcessing(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-red-500" />
            DMCA Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage copyright takedown requests
          </p>
        </div>
        <Button variant="outline" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pendingCount > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="font-medium">
                {pendingCount} pending request{pendingCount > 1 ? 's' : ''} require
                {pendingCount === 1 ? 's' : ''} attention
              </p>
              <p className="text-sm text-muted-foreground">
                DMCA requests should be processed within 24-48 hours
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="COUNTER_FILED">Counter Filed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No DMCA requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const statusConfig = STATUS_CONFIG[request.status]
            const StatusIcon = statusConfig.icon

            return (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <span>{request.claimantName}</span>
                        {request.claimantCompany && (
                          <span className="text-muted-foreground font-normal">
                            ({request.claimantCompany})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {request.claimantEmail}
                        </span>
                        <span>
                          {new Date(request.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge className={statusConfig.color}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${request.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1 mb-1">
                          <FileText className="h-4 w-4" />
                          Copyrighted Work
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {request.copyrightWork}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1 mb-1">
                          {request.tagSlug ? (
                            <>
                              <Tag className="h-4 w-4" />
                              Tag Takedown
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-4 w-4" />
                              URL Takedown
                            </>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.tagSlug ? (
                            <span className="font-mono">#{request.tagSlug}</span>
                          ) : (
                            <span>{request.infringingUrls.length} URL(s)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {request.status === 'COMPLETED' && (
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          {request.removedCount} item(s) removed on{' '}
                          {request.processedAt &&
                            new Date(request.processedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRequest(request)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {(request.status === 'PENDING' || request.status === 'PROCESSING') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleProcessClick(request)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Process Takedown
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DMCA Request Details</DialogTitle>
            <DialogDescription>
              Review and manage this takedown request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Claimant Name</label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.claimantName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.claimantEmail}</p>
                </div>
                {selectedRequest.claimantCompany && (
                  <div>
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      Company
                    </label>
                    <p className="text-sm text-muted-foreground">{selectedRequest.claimantCompany}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Copyrighted Work</label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedRequest.copyrightWork}
                </p>
              </div>

              {selectedRequest.tagSlug && (
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    Tag Takedown
                  </label>
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                    #{selectedRequest.tagSlug}
                  </p>
                </div>
              )}

              {selectedRequest.infringingUrls.length > 0 && (
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" />
                    Infringing URLs ({selectedRequest.infringingUrls.length})
                  </label>
                  <div className="mt-1 space-y-1 max-h-32 overflow-y-auto bg-muted p-2 rounded">
                    {selectedRequest.infringingUrls.map((url, i) => (
                      <p key={i} className="text-sm font-mono break-all">
                        {url}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Good Faith Statement</label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedRequest.statement}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Electronic Signature</label>
                <p className="text-sm italic">{selectedRequest.signature}</p>
              </div>

              <div>
                <label className="text-sm font-medium">Admin Note</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add internal notes..."
                  rows={3}
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selectedRequest.status === 'PENDING' && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus('REJECTED')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus('COUNTER_FILED')}
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Counter Filed
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Process Takedown Confirmation Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Confirm Takedown
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The following content will be permanently deleted:
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {selectedRequest.tagSlug && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="font-medium text-red-500">Tag Takedown</p>
                  <p className="text-sm text-muted-foreground">
                    All GIFs tagged with <span className="font-mono">#{selectedRequest.tagSlug}</span> will be deleted.
                  </p>
                </div>
              )}

              {selectedRequest.infringingUrls.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="font-medium text-red-500">URL Takedown</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.infringingUrls.length} GIF(s) will be deleted.
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setProcessDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleProcessTakedown}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Execute Takedown
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
