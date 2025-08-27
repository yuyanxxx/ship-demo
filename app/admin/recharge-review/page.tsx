"use client"

import { useEffect, useState, useMemo } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign,
  Eye,
  Loader2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsTablet } from "@/hooks/use-tablet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

interface TopUpRequest {
  id: string
  transaction_id?: string
  amount: number
  currency: string
  payment_reference: string
  payment_screenshot?: string
  customer_notes?: string
  admin_notes?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at?: string
  customer: {
    id: string
    email: string
    full_name: string
    company_name?: string
  }
  payment_config: {
    country: string
    payment_method: string
    account_name: string
    account_number: string
    bank_name?: string
  }
  reviewer?: {
    email: string
    full_name: string
  }
}

const PAYMENT_METHODS: Record<string, string> = {
  'bank_transfer': 'Bank Transfer',
  'wire_transfer': 'Wire Transfer',
  'ach': 'ACH',
  'alipay': 'Alipay',
  'wechat': 'WeChat Pay',
  'paypal': 'PayPal',
  'zelle': 'Zelle'
}

export default function RechargeReviewPage() {
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()
  const [requests, setRequests] = useState<TopUpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [selectedRequest, setSelectedRequest] = useState<TopUpRequest | null>(null)
  const [confirmAmount, setConfirmAmount] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/admin/top-up/review', {
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
      setError('Failed to load top-up requests')
    } finally {
      setLoading(false)
    }
  }

  // Filter requests based on search term
  const searchFilteredRequests = useMemo(() => {
    if (!searchTerm) return requests
    
    const searchLower = searchTerm.toLowerCase()
    return requests.filter(request => 
      request.payment_reference.toLowerCase().includes(searchLower) ||
      request.customer.email.toLowerCase().includes(searchLower) ||
      request.customer.full_name?.toLowerCase().includes(searchLower) ||
      request.customer.company_name?.toLowerCase().includes(searchLower) ||
      request.payment_config.account_name.toLowerCase().includes(searchLower)
    )
  }, [requests, searchTerm])

  // Filter by tab status
  const tabFilteredRequests = useMemo(() => {
    if (activeTab === 'all') return searchFilteredRequests
    return searchFilteredRequests.filter(r => r.status === activeTab)
  }, [searchFilteredRequests, activeTab])

  // Sort requests (newest first)
  const sortedRequests = useMemo(() => {
    return [...tabFilteredRequests].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA
    })
  }, [tabFilteredRequests])

  // Count requests by status
  const statusCounts = useMemo(() => {
    return {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      all: requests.length
    }
  }, [requests])

  const handleRowClick = (request: TopUpRequest) => {
    setSelectedRequest(request)
    setConfirmAmount(request.amount.toString())
    setReviewNotes('')
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    
    if (selectedRequest.status === 'pending' && !confirmAmount) {
      setError('Please confirm the amount')
      return
    }

    setProcessing(true)
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/admin/top-up/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.id}`
        },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: 'approve',
          notes: reviewNotes,
          amount: parseFloat(confirmAmount)
        })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setSelectedRequest(null)
        fetchRequests()
      } else {
        setError(result.error || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      setError('Failed to process approval')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    
    if (!reviewNotes.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    setProcessing(true)
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/admin/top-up/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.id}`
        },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: 'reject',
          notes: reviewNotes
        })
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setSelectedRequest(null)
        fetchRequests()
      } else {
        setError(result.error || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Error processing rejection:', error)
      setError('Failed to process rejection')
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getTransactionId = (request: TopUpRequest) => {
    // If transaction_id exists, use it; otherwise generate from UUID
    if (request.transaction_id) {
      return request.transaction_id
    }
    // Generate standardized format from UUID
    const shortId = request.id.replace(/-/g, '').substring(0, 12).toUpperCase()
    return `TUR_${shortId}`
  }

  const getPaymentTypeDisplay = (request: TopUpRequest) => {
    const paymentMethod = PAYMENT_METHODS[request.payment_config.payment_method] || request.payment_config.payment_method
    const country = request.payment_config.country.toUpperCase()
    return `${paymentMethod} - ${country}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }) + ' EST'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader 
          searchPlaceholder="Search top-up requests..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
        />
        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Recharge Review</h1>
              <p className="text-sm md:text-base text-gray-600">Review and approve customer top-up requests</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Status Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'approved' | 'rejected' | 'all')} className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="pending">
                Pending ({statusCounts.pending})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({statusCounts.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({statusCounts.rejected})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({statusCounts.all})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Requests List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No requests found</h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? `No requests match your search "${searchTerm}"` 
                  : 'No top-up requests to display'}
              </p>
            </div>
          ) : isMobile ? (
            // Mobile Card Layout
            <div className="space-y-3">
              {sortedRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleRowClick(request)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-sm">{getTransactionId(request)}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(request.created_at)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer</span>
                      <span className="font-medium">{request.customer.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Type</span>
                      <span className="font-medium">{getPaymentTypeDisplay(request)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="text-sm text-gray-600">Amount</span>
                    <span className="text-lg font-bold text-green-600">
                      +{formatCurrency(request.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Desktop/Tablet Table Layout
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">#</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Customer</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Payment Type</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Amount</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Status</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Submitted</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Reviewed</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedRequests.map((request) => (
                      <tr 
                        key={request.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(request)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{getTransactionId(request)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">{request.customer.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">{getPaymentTypeDisplay(request)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-green-600">
                            +{formatCurrency(request.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {getStatusIcon(request.status)}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(request.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {request.reviewed_at ? formatDate(request.reviewed_at) : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Detail Modal */}
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Top-Up Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">

                {/* Customer Payment Details */}
                {selectedRequest.customer_notes && (() => {
                  // Parse payment details from customer_notes inline
                  const parseDetails = (customerNotes?: string) => {
                    if (!customerNotes) return null
                    
                    try {
                      // Look for "Payment Details: {" pattern in customer notes
                      const paymentDetailsStart = customerNotes.indexOf('Payment Details: {')
                      if (paymentDetailsStart === -1) return null
                      
                      const jsonStart = customerNotes.indexOf('{', paymentDetailsStart)
                      const jsonString = customerNotes.substring(jsonStart)
                      
                      return JSON.parse(jsonString)
                    } catch (error) {
                      console.error('Error parsing payment details:', error)
                      return null
                    }
                  }
                  
                  const paymentDetails = parseDetails(selectedRequest.customer_notes)
                  const paymentMethod = selectedRequest.payment_config.payment_method
                  
                  return (
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Customer Submitted Details</h3>
                      
                      {paymentDetails ? (
                        <>
                          {/* Wire/Zelle Payment Details */}
                          {(paymentMethod === 'wire' || paymentMethod === 'zelle') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {paymentDetails.remitter_sender && (
                                <div>
                                  <Label className="text-sm text-gray-600">Remitter / Sender</Label>
                                  <p className="font-medium">{paymentDetails.remitter_sender}</p>
                                </div>
                              )}
                              {paymentDetails.remitting_bank && (
                                <div>
                                  <Label className="text-sm text-gray-600">Remitting Bank</Label>
                                  <p className="font-medium">{paymentDetails.remitting_bank}</p>
                                </div>
                              )}
                              {paymentDetails.remittance_account && (
                                <div>
                                  <Label className="text-sm text-gray-600">Remittance Account</Label>
                                  <p className="font-medium">{paymentDetails.remittance_account}</p>
                                </div>
                              )}
                              {paymentDetails.confirmation_number && (
                                <div>
                                  <Label className="text-sm text-gray-600">Wire Transfer Confirmation Number</Label>
                                  <p className="font-medium">{paymentDetails.confirmation_number}</p>
                                </div>
                              )}
                              {paymentDetails.remittance_date && (
                                <div>
                                  <Label className="text-sm text-gray-600">Remittance Date</Label>
                                  <p className="font-medium">{new Date(paymentDetails.remittance_date).toLocaleDateString()}</p>
                                </div>
                              )}
                              {paymentDetails.remarks_note && (
                                <div className="md:col-span-2">
                                  <Label className="text-sm text-gray-600">Remarks / Note</Label>
                                  <p className="font-medium">{paymentDetails.remarks_note}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Check Payment Details */}
                          {paymentMethod === 'check' && (
                            <div className="space-y-4">
                              <p className="text-sm text-gray-600">Check payment method selected</p>
                            </div>
                          )}
                          
                          {/* File Attachments */}
                          {paymentDetails.files && Object.keys(paymentDetails.files).length > 0 && (
                            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                              {Object.entries(paymentDetails.files).map(([fieldName, fileInfo]: [string, unknown]) => {
                                const file = fileInfo as Record<string, unknown>
                                const fileName = file.name as string
                                const fileType = file.type as string
                                const isImage = fileType?.startsWith('image/')
                                
                                // Get the actual image content if available
                                const getImageUrl = () => {
                                  if (file.content && isImage) {
                                    // Use the actual uploaded image content
                                    return `data:${fileType};base64,${file.content}`
                                  } else {
                                    // Fallback to placeholder for non-images or missing content
                                    const svgContent = `
                                      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                                        <rect width="100%" height="100%" fill="#f3f4f6"/>
                                        <rect x="10%" y="10%" width="80%" height="80%" fill="#e5e7eb" rx="8"/>
                                        <circle cx="50%" cy="35%" r="12" fill="#9ca3af"/>
                                        <rect x="45%" y="45%" width="10%" height="8%" fill="#9ca3af" rx="1"/>
                                        <text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#6b7280">${fileName.split('.')[0] || 'File'}</text>
                                      </svg>
                                    `.trim()
                                    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
                                  }
                                }
                                
                                const imageUrl = getImageUrl()
                                
                                return (
                                  <div key={fieldName} className="space-y-2">
                                    <div className="text-sm font-medium">
                                      {fieldName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </div>
                                    {isImage ? (
                                      <div 
                                        className="aspect-square bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-all overflow-hidden group"
                                        onClick={() => setEnlargedImage(imageUrl)}
                                      >
                                        <img 
                                          src={imageUrl}
                                          alt={fileName}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                      </div>
                                    ) : (
                                      <div className="aspect-square bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                                        <div className="text-center">
                                          <div className="text-3xl mb-2">📄</div>
                                          <div className="text-xs text-gray-600 px-2 font-medium">{fileName}</div>
                                          <div className="text-xs text-gray-500 mt-1">{((file.size as number) / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <Label className="text-sm text-gray-600">Customer Notes</Label>
                          <p className="mt-1 p-2 bg-gray-50 rounded">{selectedRequest.customer_notes}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {selectedRequest.admin_notes && (
                  <div>
                    <Label className="text-sm text-gray-600">Admin Notes</Label>
                    <p className="mt-1 p-2 bg-gray-50 rounded">{selectedRequest.admin_notes}</p>
                  </div>
                )}

                {/* Payment Screenshot */}
                {selectedRequest.payment_screenshot && (
                  <div>
                    <Label className="text-sm text-gray-600">Payment Proof</Label>
                    <img 
                      src={selectedRequest.payment_screenshot} 
                      alt="Payment proof" 
                      className="mt-2 w-full h-auto rounded-lg border cursor-pointer hover:opacity-90"
                      onClick={() => window.open(selectedRequest.payment_screenshot, '_blank')}
                    />
                  </div>
                )}

                {/* Approval Section for Pending Requests */}
                {selectedRequest.status === 'pending' && (
                  <div className="pt-4 border-t space-y-4">
                    <h3 className="font-semibold">Review Request</h3>
                    
                    <div>
                      <Label htmlFor="confirmAmount">Confirm Amount</Label>
                      <Input
                        id="confirmAmount"
                        type="number"
                        step="0.01"
                        value={confirmAmount}
                        onChange={(e) => setConfirmAmount(e.target.value)}
                        placeholder="Enter amount to approve"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="reviewNotes">Admin Notes</Label>
                      <Textarea
                        id="reviewNotes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes about this review..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleApprove}
                        disabled={processing || !confirmAmount}
                        className="flex-1"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Top-Up
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleReject}
                        disabled={processing || !reviewNotes.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Request
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Enlarged Image Modal */}
        <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Document Preview</DialogTitle>
            </DialogHeader>
            {enlargedImage && (
              <div className="flex items-center justify-center">
                <img 
                  src={enlargedImage} 
                  alt="Enlarged document" 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}