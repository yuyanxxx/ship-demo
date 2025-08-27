"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { CommonHeader } from "@/components/common-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, DollarSign, Calendar, Eye, Loader2, Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsTablet } from "@/hooks/use-tablet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CustomDatePicker } from "@/components/ui/custom-date-picker"

interface PaymentConfig {
  id: string
  country: string
  payment_method: string
  account_name: string
  account_number: string
  bank_name?: string
  routing_number?: string
  swift_code?: string
  additional_info?: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

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
  payment_config: PaymentConfig
  users?: {
    email: string
    full_name?: string
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

export default function TopUpHistoryPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<TopUpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<TopUpRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()

  // Top-Up modal state
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, string | File | Date>>({})
  const [submittingTopUp, setSubmittingTopUp] = useState(false)
  const [availablePaymentConfigs, setAvailablePaymentConfigs] = useState<PaymentConfig[]>([])
  const [loadingPaymentConfigs, setLoadingPaymentConfigs] = useState(false)
  const [selectedPaymentConfig, setSelectedPaymentConfig] = useState<PaymentConfig | null>(null)
  const [activePaymentTab, setActivePaymentTab] = useState('')
  const [userType, setUserType] = useState<string>('customer')

  useEffect(() => {
    fetchTopUpHistory()
    // Get user type from localStorage
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      setUserType(userData.user_type || 'customer')
    }
  }, [])

  const fetchTopUpHistory = async () => {
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/top-up/submit', {
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Error fetching top-up history:', error)
    } finally {
      setLoading(false)
    }
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
        return <Clock className="h-3 w-3" />
      case 'approved':
        return <CheckCircle className="h-3 w-3" />
      case 'rejected':
        return <XCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount))
  }

  const getPaymentMethodName = (method: string) => {
    return PAYMENT_METHODS[method] || method
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
    const paymentMethod = getPaymentMethodName(request.payment_config.payment_method)
    const country = request.payment_config.country.toUpperCase()
    return `${paymentMethod} - ${country}`
  }

  const filteredRequests = requests.filter(request => {
    if (statusFilter === 'all') return true
    return request.status === statusFilter
  })

  // Top-Up related functions
  const loadAllPaymentConfigs = async () => {
    setLoadingPaymentConfigs(true)
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/top-up/payment-configs', {
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        const configs = await response.json()
        setAvailablePaymentConfigs(configs)
        
        if (configs.length > 0) {
          const firstTab = `${configs[0].payment_method}-${configs[0].country}`
          setActivePaymentTab(firstTab)
          setSelectedPaymentConfig(configs[0])
        }
      }
    } catch (error) {
      console.error('Error loading payment configs:', error)
    } finally {
      setLoadingPaymentConfigs(false)
    }
  }

  const handleFileUpload = (fieldName: string, file: File | null) => {
    if (file) {
      setDynamicFormData({...dynamicFormData, [fieldName]: file})
    }
  }

  const submitTopUpRequest = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    
    if (!selectedPaymentConfig) {
      alert('No payment configuration selected')
      return
    }

    // Validate required fields based on payment method
    if (selectedPaymentConfig.payment_method === 'wire' || selectedPaymentConfig.payment_method === 'zelle') {
      const requiredFields = ['remitter_sender', 'remitting_bank', 'remittance_account', 'confirmation_number', 'remittance_date', 'remarks_note', 'upload_document']
      const missingFields = requiredFields.filter(field => !dynamicFormData[field])
      if (missingFields.length > 0) {
        alert(`Please fill in all required fields: ${missingFields.join(', ')}`)
        return
      }
    } else if (selectedPaymentConfig.payment_method === 'check') {
      if (!dynamicFormData.check_front) {
        alert('Please upload the front of the check')
        return
      }
    }

    setSubmittingTopUp(true)
    
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const formData = new FormData()
      
      formData.append('payment_config_id', selectedPaymentConfig.id)
      formData.append('amount', topUpAmount)
      
      // Generate payment reference from confirmation number or a default value
      const paymentReference = (dynamicFormData.confirmation_number as string) || 
                               `TOP-UP-${Date.now()}` || 
                               'Manual Top-Up Request'
      formData.append('payment_reference', paymentReference)
      
      // Append all form fields (except files) to the FormData
      Object.entries(dynamicFormData).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(`files[${key}]`, value)
        } else if (value && typeof value === 'string') {
          formData.append(key, value)
        }
      })

      // Submit top-up request
      const response = await fetch('/api/top-up/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userData.id}`
        },
        body: formData
      })

      if (response.ok) {
        // Close the modal
        setShowTopUpModal(false)
        // Reset form
        resetTopUpForm()
        // Refresh the current page to show the new request
        fetchTopUpHistory()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit top-up request')
      }
    } catch (error) {
      console.error('Error submitting top-up:', error)
      alert('Failed to submit top-up request')
    } finally {
      setSubmittingTopUp(false)
    }
  }

  // Reset top-up form
  const resetTopUpForm = () => {
    setTopUpAmount('')
    setDynamicFormData({})
  }

  const capitalizePaymentMethod = (method: string) => {
    return PAYMENT_METHODS[method] || method.charAt(0).toUpperCase() + method.slice(1)
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader searchPlaceholder="Search top-up history..." />
        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Top-up History</h1>
              <p className="text-muted-foreground">View your account top-up requests and their status</p>
            </div>
            {/* Show Top Up button for customers only */}
            {userType === 'customer' && (
              <Button
                onClick={() => {
                  setShowTopUpModal(true)
                  loadAllPaymentConfigs()
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Top Up
              </Button>
            )}
          </div>

          {/* Status Tabs */}
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'pending' | 'approved' | 'rejected')} className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="all">
                All ({requests.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({requests.filter(r => r.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({requests.filter(r => r.status === 'approved').length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({requests.filter(r => r.status === 'rejected').length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Requests List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No top-up requests found</h3>
              <p className="text-gray-500">
                {statusFilter !== 'all' 
                  ? `No ${statusFilter} requests to display` 
                  : 'No top-up requests yet'}
              </p>
            </div>
          ) : isMobile ? (
            // Mobile Card Layout
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        ID: {getTransactionId(request)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Customer: {request.users?.email || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Type</span>
                      <span className="font-medium">{getPaymentTypeDisplay(request)}</span>
                    </div>
                    {request.customer_notes && (
                      <div className="pt-2 border-t">
                        <span className="text-gray-600">Notes: </span>
                        <span className="text-gray-900">{request.customer_notes}</span>
                      </div>
                    )}
                    {request.admin_notes && (
                      <div className={request.customer_notes ? '' : 'pt-2 border-t'}>
                        <span className="text-gray-600">Admin: </span>
                        <span className="text-gray-900">{request.admin_notes}</span>
                      </div>
                    )}
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
                    {filteredRequests.map((request) => (
                      <tr 
                        key={request.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{getTransactionId(request)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">{request.users?.email || 'N/A'}</span>
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

          {/* Detail Modal */}
          <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Top-Up Request Details</DialogTitle>
              </DialogHeader>
              {selectedRequest && (() => {
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
                  <div className="space-y-4">

                    {/* Payment Details Section */}
                    {paymentDetails && (
                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold mb-4">Customer Submitted Details</h3>
                        
                        {/* Wire/Zelle Payment Details */}
                        {(paymentMethod === 'wire' || paymentMethod === 'zelle') && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {paymentDetails.remitter_sender && (
                              <div>
                                <label className="text-sm text-gray-600">Remitter / Sender</label>
                                <p className="font-medium">{paymentDetails.remitter_sender}</p>
                              </div>
                            )}
                            {paymentDetails.remitting_bank && (
                              <div>
                                <label className="text-sm text-gray-600">Remitting Bank</label>
                                <p className="font-medium">{paymentDetails.remitting_bank}</p>
                              </div>
                            )}
                            {paymentDetails.remittance_account && (
                              <div>
                                <label className="text-sm text-gray-600">Remittance Account</label>
                                <p className="font-medium">{paymentDetails.remittance_account}</p>
                              </div>
                            )}
                            {paymentDetails.confirmation_number && (
                              <div>
                                <label className="text-sm text-gray-600">Wire Transfer Confirmation Number</label>
                                <p className="font-medium">{paymentDetails.confirmation_number}</p>
                              </div>
                            )}
                            {paymentDetails.remittance_date && (
                              <div>
                                <label className="text-sm text-gray-600">Remittance Date</label>
                                <p className="font-medium">{new Date(paymentDetails.remittance_date).toLocaleDateString()}</p>
                              </div>
                            )}
                            {paymentDetails.remarks_note && (
                              <div className="md:col-span-2">
                                <label className="text-sm text-gray-600">Remarks / Note</label>
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
                      </div>
                    )}

                    {/* Admin Notes */}
                    {selectedRequest.admin_notes && (
                      <div className="border-t pt-6">
                        <label className="text-sm text-gray-600">Admin Notes</label>
                        <p className="mt-1 p-2 bg-gray-50 rounded">{selectedRequest.admin_notes}</p>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex justify-end pt-4 border-t">
                      <Button onClick={() => setSelectedRequest(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )
              })()}
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

          {/* Top-up Modal */}
          <Dialog open={showTopUpModal} onOpenChange={(open) => {
            setShowTopUpModal(open)
            if (!open) {
              // Reset only form fields when closing modal, keep payment configs
              setTopUpAmount('')
              setDynamicFormData({})
            }
          }}>
            <DialogContent className="max-w-6xl">
              <DialogHeader>
                <DialogTitle>Top Up Account</DialogTitle>
                <DialogDescription>
                  Add funds to your account by submitting a top-up request
                </DialogDescription>
              </DialogHeader>
              
              {loadingPaymentConfigs ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading payment methods...</span>
                </div>
              ) : availablePaymentConfigs.length === 0 ? (
                <div className="text-center py-20">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No payment methods available</h3>
                  <p className="text-gray-500">
                    No active payment configurations are currently available for top-up
                  </p>
                </div>
              ) : (
                <Tabs value={activePaymentTab} onValueChange={(value) => {
                  setActivePaymentTab(value)
                  const config = availablePaymentConfigs.find(c => `${c.payment_method}-${c.country}` === value)
                  setSelectedPaymentConfig(config || null)
                }}>
                  <TabsList className="inline-flex h-auto">
                    {availablePaymentConfigs.map((config) => {
                      const tabKey = `${config.payment_method}-${config.country}`
                      return (
                        <TabsTrigger key={config.id} value={tabKey}>
                          {capitalizePaymentMethod(config.payment_method)}-{config.country}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                  
                  {availablePaymentConfigs.map((config) => {
                    const tabKey = `${config.payment_method}-${config.country}`
                    return (
                      <TabsContent key={config.id} value={tabKey}>
                        <div className="space-y-6">

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Side - Payment Configuration Table */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-base">Payment Configuration</h4>
                            
                            {config.payment_method === 'wire' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 w-2/5 text-sm">Beneficiary Name</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_name as string || config.account_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_address as string || 'N/A'}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Account Number</td>
                                    <td className="p-3 text-sm">{config.account_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Bank</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_bank as string || config.bank_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Routing Number</td>
                                    <td className="p-3 text-sm">{config.routing_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Swift Code</td>
                                    <td className="p-3 text-sm">{config.swift_code}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Bank Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.bank_address as string || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Reference</td>
                                    <td className="p-3 text-sm">{config.additional_info?.reference as string || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}

                            {config.payment_method === 'zelle' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Name</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_name as string || config.account_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Account Number</td>
                                    <td className="p-3 text-sm">{config.account_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Bank</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_bank as string || config.bank_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Routing Number</td>
                                    <td className="p-3 text-sm">{config.routing_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">SWIFT Code</td>
                                    <td className="p-3 text-sm">{config.swift_code}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Zelle Email/Phone</td>
                                    <td className="p-3 text-sm">{config.additional_info?.zelle_remittance as string || 'N/A'}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Bank Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.bank_address as string || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_address as string || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}

                            {config.payment_method === 'check' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 w-2/5 text-sm">Pay To</td>
                                    <td className="p-3 text-sm">{config.bank_name || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Mail To</td>
                                    <td className="p-3 text-sm">{config.swift_code || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Right Side - Form Fields */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-base">Payment Details</h4>
                            
                            {/* Dynamic Fields Based on Payment Method */}
                            {(config.payment_method === 'wire' || config.payment_method === 'zelle') && (
                              <div className="space-y-4">
                                {/* Two-column layout for most fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="amount">Amount *</Label>
                                    <Input
                                      id="amount"
                                      type="number"
                                      step="0.01"
                                      value={topUpAmount}
                                      onChange={(e) => setTopUpAmount(e.target.value)}
                                      placeholder="100.00"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remitter_sender">Remitter / Sender *</Label>
                                    <Input
                                      id="remitter_sender"
                                      value={dynamicFormData.remitter_sender as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remitter_sender: e.target.value})}
                                      placeholder="Enter remitter/sender name"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remitting_bank">Remitting Bank *</Label>
                                    <Input
                                      id="remitting_bank"
                                      value={dynamicFormData.remitting_bank as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remitting_bank: e.target.value})}
                                      placeholder="Enter remitting bank name"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remittance_account">Remittance Account *</Label>
                                    <Input
                                      id="remittance_account"
                                      value={dynamicFormData.remittance_account as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remittance_account: e.target.value})}
                                      placeholder="Enter remittance account number"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="confirmation_number">Wire Transfer Confirmation Number *</Label>
                                    <Input
                                      id="confirmation_number"
                                      value={dynamicFormData.confirmation_number as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, confirmation_number: e.target.value})}
                                      placeholder="Enter wire transfer confirmation number"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remittance_date">Remittance Date *</Label>
                                    <CustomDatePicker
                                      id="remittance_date"
                                      value={dynamicFormData.remittance_date as string || ''}
                                      onValueChange={(value) => setDynamicFormData({...dynamicFormData, remittance_date: value})}
                                      placeholder="Select remittance date"
                                    />
                                  </div>
                                </div>
                                
                                {/* Full-width fields */}
                                <div className="space-y-2">
                                  <Label htmlFor="upload_document">Upload Document *</Label>
                                  <Input
                                    id="upload_document"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('upload_document', e.target.files?.[0] || null)}
                                    required
                                  />
                                  {dynamicFormData.upload_document && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.upload_document as File).name}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="remarks_note">Remarks / Note *</Label>
                                  <Textarea
                                    id="remarks_note"
                                    value={dynamicFormData.remarks_note as string || ''}
                                    onChange={(e) => setDynamicFormData({...dynamicFormData, remarks_note: e.target.value})}
                                    placeholder="Enter any remarks or notes"
                                    rows={3}
                                    required
                                  />
                                </div>
                              </div>
                            )}

                            {config.payment_method === 'check' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="amount">Amount *</Label>
                                  <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    placeholder="100.00"
                                    required
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="check_front">Front of the check *</Label>
                                  <Input
                                    id="check_front"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('check_front', e.target.files?.[0] || null)}
                                    required
                                  />
                                  {dynamicFormData.check_front && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.check_front as File).name}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="check_back">Back of the check</Label>
                                  <Input
                                    id="check_back"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('check_back', e.target.files?.[0] || null)}
                                  />
                                  {dynamicFormData.check_back && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.check_back as File).name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-6 border-t">
                          <Button 
                            onClick={submitTopUpRequest}
                            disabled={submittingTopUp}
                            size="lg"
                          >
                            {submittingTopUp ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting for Review...
                              </>
                            ) : (
                              'Submit for Review'
                            )}
                          </Button>
                        </div>

                        </div>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}