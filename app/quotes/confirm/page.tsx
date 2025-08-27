"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimePicker } from "@/components/ui/time-picker"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Search, 
  Loader2,
  ArrowLeft,
  FileText,
  Truck,
  ClipboardCheck,
  CheckCircle
} from "lucide-react"
import { useIsTablet } from "@/hooks/use-tablet"
import { StepsIndicator } from "@/components/steps-indicator"
import { OrderSummary } from "./OrderSummary"
import type { QuoteRate } from "@/lib/rapiddeals-quote-results-api"

interface Address {
  address_name?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

interface QuoteSubmissionData {
  orderId: string
  serviceType: string
  originAddress: Address
  destinationAddress: Address | null
  destinationWarehouse?: {
    id: string
    name: string
    code: string
    address_line1: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  pickupDate: string
  deliveryDate?: string
  deliveryAccessorials?: string[]
  packageItems: Array<{
    id: string
    packageName: string
    declaredValue: string
    totalPallet: string
    packageType: string
    totalPackage: string
    freightClass: string
    length: string
    width: string
    height: string
    weight: string
    nmfc: string
    sub: string
  }>
  palletQuantity: number
  timestamp: string
}

function OrderConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const rateId = searchParams.get('rateId')
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Data from sessionStorage
  const [quoteSubmissionData, setQuoteSubmissionData] = useState<QuoteSubmissionData | null>(null)
  const [selectedQuoteData, setSelectedQuoteData] = useState<QuoteRate | null>(null)
  
  // Form state for editable fields
  const [originTimeFrom, setOriginTimeFrom] = useState("")
  const [originTimeTo, setOriginTimeTo] = useState("")
  const [destinationTimeFrom, setDestinationTimeFrom] = useState("")
  const [destinationTimeTo, setDestinationTimeTo] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [originMemo, setOriginMemo] = useState("")
  const [destinationMemo, setDestinationMemo] = useState("")
  const [paymentMethod] = useState(0) // Default to prepaid
  const [declaredValue, setDeclaredValue] = useState("")
  
  // Contact info from localStorage
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: ''
  })
  
  // FBA specific fields
  const [amzPoId, setAmzPoId] = useState('')
  const [amzRefNumber, setAmzRefNumber] = useState('')
  
  // Calculate max declared value from all items
  const calculateMaxDeclaredValue = (): number => {
    if (!quoteSubmissionData?.packageItems) return 0
    
    return quoteSubmissionData.packageItems.reduce((total, item) => {
      const declaredValue = parseFloat(item.declaredValue || '0')
      return total + declaredValue
    }, 0)
  }
  
  // Temporary time values for save functionality
  const [tempOriginTimeFrom, setTempOriginTimeFrom] = useState('')
  const [tempOriginTimeTo, setTempOriginTimeTo] = useState('')
  const [tempDestinationTimeFrom, setTempDestinationTimeFrom] = useState('')
  const [tempDestinationTimeTo, setTempDestinationTimeTo] = useState('')

  // Modal states
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  
  // Additional modal fields
  const [orderNumber, setOrderNumber] = useState("")
  const [pickupAdditionalMemo, setPickupAdditionalMemo] = useState("")
  const [deliveryAdditionalMemo, setDeliveryAdditionalMemo] = useState("")
  
  // Time validation errors
  const [pickupTimeError, setPickupTimeError] = useState(false)
  const [deliveryTimeError, setDeliveryTimeError] = useState(false)
  
  // Track if details have been saved
  const [pickupDetailsSaved, setPickupDetailsSaved] = useState(false)
  const [deliveryDetailsSaved, setDeliveryDetailsSaved] = useState(false)
  
  // Insufficient balance dialog state
  const [showInsufficientBalanceDialog, setShowInsufficientBalanceDialog] = useState(false)
  const [balanceInfo, setBalanceInfo] = useState<{
    currentBalance: number
    requiredAmount: number
    shortfall: number
  } | null>(null)
  
  // Insurance state
  const [insuranceQuote, setInsuranceQuote] = useState<{
    amount: number
    compensationCeiling: number
  } | null>(null)

  // Validate input to prevent Chinese characters
  const validateNoChineseCharacters = (text: string): string => {
    // Remove any Chinese characters (Unicode range for CJK Unified Ideographs)
    // Also remove other non-ASCII characters except common punctuation
    return text.replace(/[^\x00-\x7F]/g, '')
  }

  // Validate that To time is after From time
  const validateTimeRange = (fromTime: string, toTime: string): boolean => {
    if (!fromTime || !toTime) return true // Skip validation if either is empty
    
    const [fromHour, fromMin] = fromTime.split(':').map(Number)
    const [toHour, toMin] = toTime.split(':').map(Number)
    
    // Special handling for 12 AM (midnight = 0) and 12 PM (noon = 12)
    // In 24-hour format:
    // 12:00 AM = 00:00 (start of day)
    // 1:00 AM - 11:59 AM = 01:00 - 11:59
    // 12:00 PM = 12:00 (noon)
    // 1:00 PM - 11:59 PM = 13:00 - 23:59
    
    // If From is AM (0-11) and To is PM (12-23), To is always after From
    if (fromHour < 12 && toHour >= 12) {
      return true
    }
    
    // If From is PM (12-23) and To is AM (0-11), To is before From
    if (fromHour >= 12 && toHour < 12) {
      return false
    }
    
    // Same period (both AM or both PM) - compare directly
    const fromMinutes = fromHour * 60 + fromMin
    const toMinutes = toHour * 60 + toMin
    
    // To time must be after From time
    return toMinutes > fromMinutes
  }
  
  // Format time from 24-hour to 12-hour display
  const formatTimeDisplay = (time24: string): string => {
    if (!time24) return ''
    const [hour, minute] = time24.split(':').map(Number)
    let hour12 = hour
    let period = 'AM'
    
    if (hour === 0) {
      hour12 = 12
    } else if (hour === 12) {
      period = 'PM'
    } else if (hour > 12) {
      hour12 = hour - 12
      period = 'PM'
    }
    
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`
  }
  
  // Format date for display
  const formatDateDisplay = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    }
    return date.toLocaleDateString('en-US', options)
  }
  
  // Calculate estimated delivery date based on transit days
  const calculateEstimatedDeliveryDate = (): string => {
    if (!quoteSubmissionData?.pickupDate || !selectedQuoteData) return ''
    
    // Extract transit days from carrier guarantee (e.g., "1-2 days" -> 2, "3 days" -> 3)
    const guarantee = selectedQuoteData.carrierGuarantee || ''
    const matches = guarantee.match(/(\d+)(?:-(\d+))?\s*(?:business\s*)?days?/i)
    
    let transitDays = 3 // Default to 3 business days if not found
    if (matches) {
      // If range (e.g., "1-2"), use the maximum
      transitDays = matches[2] ? parseInt(matches[2]) : parseInt(matches[1])
    }
    
    // Start from pickup date
    const startDate = new Date(quoteSubmissionData.pickupDate)
    const deliveryDate = new Date(startDate)
    let daysAdded = 0
    
    // Add business days (skip weekends)
    while (daysAdded < transitDays) {
      deliveryDate.setDate(deliveryDate.getDate() + 1)
      const dayOfWeek = deliveryDate.getDay()
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++
      }
    }
    
    return deliveryDate.toISOString().split('T')[0] // Return YYYY-MM-DD format
  }

  useEffect(() => {
    if (!orderId || !rateId) {
      setError('Missing order or rate information')
      setLoading(false)
      return
    }
    
    // Load quote submission data
    const storedQuoteData = sessionStorage.getItem(`quote_submission_${orderId}`)
    const storedSelectedQuote = sessionStorage.getItem(`selected_quote_${orderId}`)
    
    if (!storedQuoteData || !storedSelectedQuote) {
      setError('Quote data not found. Please start a new quote.')
      setTimeout(() => {
        router.push('/quotes')
      }, 2000)
      return
    }
    
    try {
      const quoteData = JSON.parse(storedQuoteData)
      const selectedQuote = JSON.parse(storedSelectedQuote)
      
      setQuoteSubmissionData(quoteData)
      setSelectedQuoteData(selectedQuote)
      
      // Load user info from localStorage
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        setContactInfo({
          name: userData.full_name || '',
          email: userData.email || '',
          phone: userData.phone || ''
        })
      }
      
      setLoading(false)
    } catch (e) {
      console.error('Error parsing stored data:', e)
      setError('Invalid quote data')
      setLoading(false)
    }
  }, [orderId, rateId, router])

  const handleQueryInsurance = async (value: string) => {
    if (!quoteSubmissionData || !orderId) {
      throw new Error('Missing order data')
    }
    
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      throw new Error('User not authenticated')
    }
    
    const user = JSON.parse(userStr)
    const userId = user.id
    if (!userId) {
      throw new Error('User ID not found')
    }
    
    try {
      // Get user from localStorage for auth
      const userStr = localStorage.getItem('user')
      const userId = userStr ? JSON.parse(userStr).id : null
      
      const response = await fetch('/api/insurance/quote-rapiddeals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userId ? `Bearer ${userId}` : ''
        },
        body: JSON.stringify({
          quoteOrderId: orderId,
          originPickDateYmd: quoteSubmissionData.pickupDate,
          originUserName: quoteSubmissionData.originAddress?.contact_name || contactInfo.name,
          originEmail: quoteSubmissionData.originAddress?.contact_email || contactInfo.email,
          originPhone: quoteSubmissionData.originAddress?.contact_phone || contactInfo.phone,
          originAddress1: quoteSubmissionData.originAddress?.address_line1 || '',
          originAddress2: quoteSubmissionData.originAddress?.address_line2 || '',
          originCity: quoteSubmissionData.originAddress?.city || '',
          originProvince: quoteSubmissionData.originAddress?.state || '',
          originZipCode: quoteSubmissionData.originAddress?.postal_code || '',
          originCountry: quoteSubmissionData.originAddress?.country || 'US',
          destinationUserName: quoteSubmissionData.destinationAddress?.contact_name || quoteSubmissionData.destinationWarehouse?.name || contactInfo.name,
          destinationEmail: quoteSubmissionData.destinationAddress?.contact_email || contactInfo.email,
          destinationPhone: quoteSubmissionData.destinationAddress?.contact_phone || contactInfo.phone,
          destinationAddress1: quoteSubmissionData.destinationAddress?.address_line1 || quoteSubmissionData.destinationWarehouse?.address_line1 || '',
          destinationAddress2: quoteSubmissionData.destinationAddress?.address_line2 || '',
          destinationCity: quoteSubmissionData.destinationAddress?.city || quoteSubmissionData.destinationWarehouse?.city || '',
          destinationProvince: quoteSubmissionData.destinationAddress?.state || quoteSubmissionData.destinationWarehouse?.state || '',
          destinationZipCode: quoteSubmissionData.destinationAddress?.postal_code || quoteSubmissionData.destinationWarehouse?.postal_code || '',
          destinationCountry: quoteSubmissionData.destinationAddress?.country || quoteSubmissionData.destinationWarehouse?.country || 'US',
          shipmentType: quoteSubmissionData.serviceType === 'TL' ? 'TL' : 'LTL',
          declaredValue: value
        })
      })
      
      const data = await response.json()
      
      console.log('Insurance quote response:', data)
      
      if (!response.ok || !data.success) {
        console.error('Insurance quote error:', data)
        throw new Error(data.error || 'Failed to get insurance quote')
      }
      
      setInsuranceQuote({
        amount: parseFloat(data.data.insuranceAmount),
        compensationCeiling: parseFloat(data.data.compensationCeiling)
      })
      
      // Return the insurance quote data
      return {
        insuranceAmount: data.data.insuranceAmount,
        compensationCeiling: data.data.compensationCeiling
      }
    } catch (error) {
      console.error('Error getting insurance quote:', error)
      throw error
    }
  }
  
  const handlePlaceOrder = async () => {
    if (!quoteSubmissionData || !selectedQuoteData || !orderId) return
    
    // Validate required fields
    if (!referenceNumber || referenceNumber.trim() === '') {
      return
    }
    
    // FBA specific validation
    if (quoteSubmissionData.serviceType === 'FBA') {
      if (!amzPoId?.trim() || !amzRefNumber?.trim()) {
        setError('Amazon PO ID and Reference Number are required for FBA orders')
        return
      }
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      // Prepare the complete order request
      const orderRequest = {
        // Quote and rate info
        orderId: selectedQuoteData.orderId,
        rateId: selectedQuoteData.rateId,
        carrierSCAC: selectedQuoteData.carrierSCAC,
        carrierGuarantee: selectedQuoteData.carrierGuarantee || '',
        customerDump: selectedQuoteData.customerDump,
        
        // Include the selected quote data for pricing information
        selectedQuoteData: {
          totalCharge: selectedQuoteData.totalCharge,
          lineCharge: selectedQuoteData.lineCharge,
          fuelCharge: selectedQuoteData.fuelCharge,
          accessorialCharge: selectedQuoteData.accessorialCharge,
          carrierName: selectedQuoteData.carrierName
        },
        
        // Payment info
        paymentMethod,
        declaredValue: declaredValue ? parseFloat(declaredValue) : undefined,
        
        // Reference numbers
        referenceNumber,
        orderNumber,
        
        // Time windows (ensure HH:mm format)
        originTimeFrom: originTimeFrom || '08:30',
        originTimeTo: originTimeTo || '17:30',
        destinationTimeFrom: destinationTimeFrom || '08:30',
        destinationTimeTo: destinationTimeTo || '17:30',
        
        // Memos
        originMemo,
        destinationMemo,
        pickupAdditionalMemo,
        deliveryAdditionalMemo,
        
        // Original quote submission data
        quoteSubmissionData,
        
        // Contact info (merge with address-specific contacts if available)
        contactInfo: {
          ...contactInfo,
          // Override with origin contact if available
          originName: quoteSubmissionData.originAddress?.contact_name || contactInfo.name,
          originEmail: quoteSubmissionData.originAddress?.contact_email || contactInfo.email,
          originPhone: quoteSubmissionData.originAddress?.contact_phone || contactInfo.phone,
          // Override with destination contact if available
          destinationName: quoteSubmissionData.destinationAddress?.contact_name || contactInfo.name,
          destinationEmail: quoteSubmissionData.destinationAddress?.contact_email || contactInfo.email,
          destinationPhone: quoteSubmissionData.destinationAddress?.contact_phone || contactInfo.phone
        },
        
        // FBA specific fields
        amzPoId: quoteSubmissionData.serviceType === 'FBA' ? amzPoId : undefined,
        amzRefNumber: quoteSubmissionData.serviceType === 'FBA' ? amzRefNumber : undefined
      }
      
      console.log('Submitting order:', orderRequest)
      
      // Get the user ID from localStorage for auth
      const userStr = localStorage.getItem('user')
      const userId = userStr ? JSON.parse(userStr).id : null
      
      // Submit order to API
      const response = await fetch('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': userId ? `Bearer ${userId}` : ''
        },
        body: JSON.stringify(orderRequest)
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        // Check if it's an insufficient balance error
        if (data.insufficientBalance) {
          setBalanceInfo({
            currentBalance: Number(data.currentBalance || 0),
            requiredAmount: Number(data.requiredAmount || 0),
            shortfall: Number(data.shortfall || 0)
          })
          setShowInsufficientBalanceDialog(true)
          setSubmitting(false)
          return
        }
        throw new Error(data.error || 'Failed to place order')
      }
      
      // Clear stored data on success
      sessionStorage.removeItem(`quote_submission_${orderId}`)
      sessionStorage.removeItem(`selected_quote_${orderId}`)
      sessionStorage.removeItem(`tl_rates_${orderId}`)
      
      // Store order info for success page
      sessionStorage.setItem('recent_order', JSON.stringify({
        orderId: orderId,
        amount: selectedQuoteData.totalCharge,
        carrier: selectedQuoteData.carrierName,
        origin: quoteSubmissionData.originAddress?.city,
        destination: quoteSubmissionData.destinationAddress?.city || quoteSubmissionData.destinationWarehouse?.city
      }))
      
      // Redirect to success page
      router.push('/order-success')
      
    } catch (error) {
      console.error('Error placing order:', error)
      setError(error instanceof Error ? error.message : 'Failed to place order')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error && !quoteSubmissionData) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={() => router.push('/quotes')}>
          Start New Quote
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 md:px-12 py-8">
      {/* Header with Steps */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Review Your Order</h1>
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            disabled={submitting}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <StepsIndicator
          steps={[
            { id: 1, name: "Quote", description: "Enter shipment details", icon: FileText },
            { id: 2, name: "Select Truck Carrier", description: "Choose your carrier", icon: Truck },
            { id: 3, name: "Confirm Order", description: "Review and confirm", icon: ClipboardCheck },
            { id: 4, name: "Complete", description: "Order placed", icon: CheckCircle }
          ]}
          currentStep={3}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Panel - Order Details */}
        <div className="flex-1 md:flex-[2] space-y-6">
          {/* FBA Information - Only show for FBA orders */}
          {quoteSubmissionData?.serviceType === 'FBA' && (
            <div className="border rounded-lg">
              <div className="bg-gray-50 px-6 py-2 border-b">
                <h2 className="text-lg font-semibold">Amazon FBA Information</h2>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="amzPoId">
                      Amazon PO ID <span className="text-gray-500">*</span>
                    </Label>
                    <Input
                      id="amzPoId"
                      type="text"
                      placeholder="Enter Amazon PO ID"
                      value={amzPoId}
                      onChange={(e) => setAmzPoId(e.target.value)}
                      className="mt-1"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Required for FBA shipments
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="amzRefNumber">
                      Amazon Reference Number <span className="text-gray-500">*</span>
                    </Label>
                    <Input
                      id="amzRefNumber"
                      type="text"
                      placeholder="Enter Amazon Reference Number"
                      value={amzRefNumber}
                      onChange={(e) => setAmzRefNumber(e.target.value)}
                      className="mt-1"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Required for FBA shipments
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Origin Section with Inline Pickup Form */}
          <div className="border rounded-lg">
            <div className="bg-gray-50 px-6 py-2 border-b">
              <h2 className="text-lg font-semibold">Origin & Pickup Details</h2>
            </div>
            <div className="px-6 py-4 space-y-6">
              {/* Address and Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">ADDRESS</p>
                  <div className="space-y-1">
                    <p className="font-medium">{quoteSubmissionData?.originAddress?.address_name || 'Business Name'}</p>
                    <p className="text-sm text-gray-600">
                      {quoteSubmissionData?.originAddress?.address_line1}
                      {quoteSubmissionData?.originAddress?.address_line2 && (
                        <> {quoteSubmissionData.originAddress.address_line2}</>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      {quoteSubmissionData?.originAddress?.city}, {quoteSubmissionData?.originAddress?.state} {quoteSubmissionData?.originAddress?.postal_code} {quoteSubmissionData?.originAddress?.country || 'US'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">CONTACT</p>
                  <div className="space-y-1">
                    <p className="font-medium">{quoteSubmissionData?.originAddress?.contact_name || contactInfo.name}</p>
                    <p className="text-sm text-gray-600">{quoteSubmissionData?.originAddress?.contact_phone || contactInfo.phone}</p>
                    <p className="text-sm text-gray-600">{quoteSubmissionData?.originAddress?.contact_email || contactInfo.email}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pickup Form Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pickup-date-display">Pickup Date</Label>
                    <Input
                      id="pickup-date-display"
                      value={formatDateDisplay(quoteSubmissionData?.pickupDate || '')}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="pickup-from">
                          From Time <span className="text-red-500">*</span>
                        </Label>
                        <TimePicker
                          id="pickup-from"
                          value={tempOriginTimeFrom || originTimeFrom}
                          onValueChange={(val) => {
                            setTempOriginTimeFrom(val)
                            // Validate against temp value if exists, otherwise saved value
                            const toTime = tempOriginTimeTo || originTimeTo
                            if (toTime && val) {
                              const isValid = validateTimeRange(val, toTime)
                              setPickupTimeError(!isValid)
                              if (!isValid) {
                                setTempOriginTimeTo("")
                              }
                            } else {
                              setPickupTimeError(false)
                            }
                          }}
                          placeholder="Start time"
                          className="mt-1"
                          showSaveButton={true}
                          onSave={() => {
                            // Use the temp values for both fields when saving
                            const fromTime = tempOriginTimeFrom || originTimeFrom
                            const toTime = tempOriginTimeTo || originTimeTo
                            
                            if (fromTime && toTime) {
                              // Validate before saving
                              const isValid = validateTimeRange(fromTime, toTime)
                              if (isValid) {
                                setOriginTimeFrom(fromTime)
                                setOriginTimeTo(toTime)
                                setPickupDetailsSaved(!!fromTime && !!toTime && !!referenceNumber)
                                setTempOriginTimeFrom('')
                                setTempOriginTimeTo('')
                                setPickupTimeError(false) // Clear error on successful save
                              }
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="pickup-to">
                          To Time <span className="text-red-500">*</span>
                        </Label>
                        <TimePicker
                          id="pickup-to"
                          value={tempOriginTimeTo || originTimeTo}
                          onValueChange={(val) => {
                            setTempOriginTimeTo(val)
                            // Always use temp value if it exists for validation during editing
                            const fromTime = tempOriginTimeFrom || originTimeFrom
                            if (fromTime && val) {
                              const isValid = validateTimeRange(fromTime, val)
                              setPickupTimeError(!isValid)
                            } else {
                              setPickupTimeError(false)
                            }
                          }}
                          placeholder="End time"
                          minTime={tempOriginTimeFrom || originTimeFrom}
                          disabled={!tempOriginTimeFrom && !originTimeFrom}
                          error={pickupTimeError}
                          className="mt-1"
                          showSaveButton={true}
                          onSave={() => {
                            // Use the temp values for both fields when saving
                            const fromTime = tempOriginTimeFrom || originTimeFrom
                            const toTime = tempOriginTimeTo || originTimeTo
                            
                            if (fromTime && toTime) {
                              // Validate before saving
                              const isValid = validateTimeRange(fromTime, toTime)
                              if (isValid) {
                                setOriginTimeFrom(fromTime)
                                setOriginTimeTo(toTime)
                                setPickupDetailsSaved(!!fromTime && !!toTime && !!referenceNumber)
                                setTempOriginTimeFrom('')
                                setTempOriginTimeTo('')
                                setPickupTimeError(false) // Clear error on successful save
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order-number">Order #</Label>
                    <Input
                      id="order-number"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(validateNoChineseCharacters(e.target.value))}
                      placeholder="Optional order number"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pickup-ref">
                      Reference # <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pickup-ref"
                      value={referenceNumber}
                      onChange={(e) => {
                        setReferenceNumber(validateNoChineseCharacters(e.target.value))
                        setPickupDetailsSaved(!!originTimeFrom && !!originTimeTo && !!e.target.value)
                      }}
                      placeholder="Required reference number"
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pickup-memo">Pickup Memo</Label>
                  <Input
                    id="pickup-memo"
                    value={originMemo}
                    onChange={(e) => setOriginMemo(validateNoChineseCharacters(e.target.value).slice(0, 30))}
                    maxLength={30}
                    placeholder="Brief pickup instructions (max 30 chars)"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="pickup-additional-memo">Additional Pickup Instructions</Label>
                  <Textarea
                    id="pickup-additional-memo"
                    value={pickupAdditionalMemo}
                    onChange={(e) => setPickupAdditionalMemo(validateNoChineseCharacters(e.target.value).slice(0, 100))}
                    maxLength={100}
                    placeholder="Detailed pickup instructions (max 100 chars)"
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Destination Section with Inline Delivery Form */}
          <div className="border rounded-lg">
            <div className="bg-gray-50 px-6 py-2 border-b">
              <h2 className="text-lg font-semibold">Destination & Delivery Details</h2>
            </div>
            <div className="px-6 py-4 space-y-6">
              {/* Address and Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">ADDRESS</p>
                  <div className="space-y-1">
                    {quoteSubmissionData?.serviceType === 'FBA' ? (
                      <>
                        <p className="font-medium">{quoteSubmissionData?.destinationWarehouse?.name}</p>
                        <p className="text-sm text-gray-600">
                          {quoteSubmissionData?.destinationWarehouse?.address_line1}
                        </p>
                        <p className="text-sm text-gray-600">
                          {quoteSubmissionData?.destinationWarehouse?.city}, {quoteSubmissionData?.destinationWarehouse?.state} {quoteSubmissionData?.destinationWarehouse?.postal_code} US
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">{quoteSubmissionData?.destinationAddress?.address_name || 'Business Name'}</p>
                        <p className="text-sm text-gray-600">
                          {quoteSubmissionData?.destinationAddress?.address_line1}
                          {quoteSubmissionData?.destinationAddress?.address_line2 && (
                            <> {quoteSubmissionData.destinationAddress.address_line2}</>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {quoteSubmissionData?.destinationAddress?.city}, {quoteSubmissionData?.destinationAddress?.state} {quoteSubmissionData?.destinationAddress?.postal_code} {quoteSubmissionData?.destinationAddress?.country || 'US'}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">CONTACT</p>
                  <div className="space-y-1">
                    <p className="font-medium">{quoteSubmissionData?.destinationAddress?.contact_name || contactInfo.name}</p>
                    <p className="text-sm text-gray-600">{quoteSubmissionData?.destinationAddress?.contact_phone || contactInfo.phone}</p>
                    <p className="text-sm text-gray-600">{quoteSubmissionData?.destinationAddress?.contact_email || contactInfo.email}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Delivery Form Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delivery-date-display">Delivery Date</Label>
                    <Input
                      id="delivery-date-display"
                      value={`${formatDateDisplay(quoteSubmissionData?.deliveryDate || calculateEstimatedDeliveryDate())} (Estimated)`}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="delivery-from">
                          From Time <span className="text-red-500">*</span>
                        </Label>
                        <TimePicker
                          id="delivery-from"
                          value={tempDestinationTimeFrom || destinationTimeFrom}
                          onValueChange={(val) => {
                            setTempDestinationTimeFrom(val)
                            // Validate against temp value if exists, otherwise saved value
                            const toTime = tempDestinationTimeTo || destinationTimeTo
                            if (toTime && val) {
                              const isValid = validateTimeRange(val, toTime)
                              setDeliveryTimeError(!isValid)
                              if (!isValid) {
                                setTempDestinationTimeTo("")
                              }
                            } else {
                              setDeliveryTimeError(false)
                            }
                          }}
                          placeholder="Start time"
                          className="mt-1"
                          showSaveButton={true}
                          onSave={() => {
                            // Use the temp values for both fields when saving
                            const fromTime = tempDestinationTimeFrom || destinationTimeFrom
                            const toTime = tempDestinationTimeTo || destinationTimeTo
                            
                            if (fromTime && toTime) {
                              // Validate before saving
                              const isValid = validateTimeRange(fromTime, toTime)
                              if (isValid) {
                                setDestinationTimeFrom(fromTime)
                                setDestinationTimeTo(toTime)
                                setDeliveryDetailsSaved(true)
                                setTempDestinationTimeFrom('')
                                setTempDestinationTimeTo('')
                                setDeliveryTimeError(false) // Clear error on successful save
                              }
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-to">
                          To Time <span className="text-red-500">*</span>
                        </Label>
                        <TimePicker
                          id="delivery-to"
                          value={tempDestinationTimeTo || destinationTimeTo}
                          onValueChange={(val) => {
                            setTempDestinationTimeTo(val)
                            // Always use temp value if it exists for validation during editing
                            const fromTime = tempDestinationTimeFrom || destinationTimeFrom
                            if (fromTime && val) {
                              const isValid = validateTimeRange(fromTime, val)
                              setDeliveryTimeError(!isValid)
                            } else {
                              setDeliveryTimeError(false)
                            }
                          }}
                          placeholder="End time"
                          minTime={tempDestinationTimeFrom || destinationTimeFrom}
                          disabled={!tempDestinationTimeFrom && !destinationTimeFrom}
                          error={deliveryTimeError}
                          className="mt-1"
                          showSaveButton={true}
                          onSave={() => {
                            // Use the temp values for both fields when saving
                            const fromTime = tempDestinationTimeFrom || destinationTimeFrom
                            const toTime = tempDestinationTimeTo || destinationTimeTo
                            
                            if (fromTime && toTime) {
                              // Validate before saving
                              const isValid = validateTimeRange(fromTime, toTime)
                              if (isValid) {
                                setDestinationTimeFrom(fromTime)
                                setDestinationTimeTo(toTime)
                                setDeliveryDetailsSaved(true)
                                setTempDestinationTimeFrom('')
                                setTempDestinationTimeTo('')
                                setDeliveryTimeError(false) // Clear error on successful save
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="delivery-memo">Delivery Memo</Label>
                  <Input
                    id="delivery-memo"
                    value={destinationMemo}
                    onChange={(e) => setDestinationMemo(validateNoChineseCharacters(e.target.value).slice(0, 30))}
                    maxLength={30}
                    placeholder="Brief delivery instructions (max 30 chars)"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="delivery-additional-memo">Additional Delivery Instructions</Label>
                  <Textarea
                    id="delivery-additional-memo"
                    value={deliveryAdditionalMemo}
                    onChange={(e) => setDeliveryAdditionalMemo(validateNoChineseCharacters(e.target.value).slice(0, 100))}
                    maxLength={100}
                    placeholder="Detailed delivery instructions (max 100 chars)"
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cargo Information Section */}
          <div className="border rounded-lg">
            <div className="bg-gray-50 px-6 py-2 border-b">
              <h2 className="text-lg font-semibold">Cargo Information</h2>
            </div>
            <div className="px-6 py-4">
              {/* Package Items Details - Emphasized */}
              {quoteSubmissionData?.packageItems && quoteSubmissionData.packageItems.length > 0 && (
                <div>
                  {quoteSubmissionData.packageItems.map((item, index) => {
                    // Calculate individual item totals
                    const length = parseFloat(item.length) || 0
                    const width = parseFloat(item.width) || 0
                    const height = parseFloat(item.height) || 0
                    const weight = parseFloat(item.weight) || 0
                    const totalPallets = parseInt(item.totalPallet) || 1
                    
                    // Volume in cubic feet (dimensions are for the entire pallet, in inches)
                    // Volume per pallet = (L × W × H) / 1728
                    const volumePerPallet = (length * width * height) / 1728
                    const totalVolume = (volumePerPallet * totalPallets).toFixed(2)
                    
                    // Total weight: weight is for the entire pallet
                    const totalWeight = (weight * totalPallets).toFixed(2)
                    
                    // Density: total weight / total volume
                    const totalVolumeNum = volumePerPallet * totalPallets
                    const density = totalVolumeNum > 0 ? ((weight * totalPallets) / totalVolumeNum).toFixed(2) : '0.00'
                    
                    return (
                      <div key={item.id || index}>
                        {index > 0 && <hr className="my-4 border-gray-200" />}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Product Name</p>
                            <p className="text-base font-semibold">{item.packageName || `Item ${index + 1}`}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Pallets</p>
                            <p className="text-base font-semibold">{item.totalPallet || '1'} Pallet(s)</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Quantity per Pallet</p>
                            <p className="text-base font-semibold">{item.totalPackage || '1'} {item.packageType || 'Package'}(s)</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pallet Specifications</p>
                            <p className="text-base font-semibold">{item.length}&quot; × {item.width}&quot; × {item.height}&quot;, {item.weight} lbs</p>
                          </div>
                          {item.freightClass && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Freight Class</p>
                              <p className="text-base font-semibold">{item.freightClass}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">NMFC Code</p>
                            <p className="text-base font-semibold">{item.nmfc || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sub Code</p>
                            <p className="text-base font-semibold">{item.sub || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Declared Value</p>
                            <p className="text-base font-semibold">{item.declaredValue ? `$${item.declaredValue}` : '-'}</p>
                          </div>
                        </div>
                        
                        {/* Individual Item Totals */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-600">
                          <div>
                            Total Volume: <span className="font-bold text-gray-800">{totalVolume} ft³</span>
                          </div>
                          <div>
                            Total Weight: <span className="font-bold text-gray-800">{totalWeight} lbs</span>
                          </div>
                          <div>
                            Total Density: <span className="font-bold text-gray-800">{density} lbs/ft³</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* Right Panel - Order Summary */}
        <div className="flex-1 md:flex-none order-first md:order-last">
          <OrderSummary
            lineCharge={selectedQuoteData?.lineCharge || 0}
            fuelCharge={selectedQuoteData?.fuelCharge || 0}
            accessorialCharge={selectedQuoteData?.accessorialCharge || 0}
            totalCharge={selectedQuoteData?.totalCharge || 0}
            declaredValue={declaredValue}
            onDeclaredValueChange={setDeclaredValue}
            onPlaceOrder={handlePlaceOrder}
            submitting={submitting}
            isDisabled={
              !referenceNumber || 
              !originTimeFrom || 
              !originTimeTo ||
              !destinationTimeFrom ||
              !destinationTimeTo ||
              (quoteSubmissionData?.serviceType === 'FBA' && (!amzPoId?.trim() || !amzRefNumber?.trim()))
            }
            maxDeclaredValue={calculateMaxDeclaredValue()}
            onQueryInsurance={handleQueryInsurance}
          />
        </div>
      </div>

      {/* Pickup Modal */}
      <Dialog open={showPickupModal} onOpenChange={setShowPickupModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Pickup Details</DialogTitle>
            <DialogDescription>
              Configure pickup time window and reference numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="pickup-from" className="w-32 text-left whitespace-nowrap">
                From <span className="text-red-500">*</span>
              </Label>
              <TimePicker
                id="pickup-from"
                value={originTimeFrom}
                onValueChange={(val) => {
                  setOriginTimeFrom(val)
                  // Validate with To time if it exists
                  if (originTimeTo && val) {
                    const isValid = validateTimeRange(val, originTimeTo)
                    setPickupTimeError(!isValid)
                    if (!isValid) {
                      // Clear To field if it becomes invalid
                      setOriginTimeTo("")
                    }
                  }
                }}
                placeholder="Select start time"
                className="flex-1"
                showSaveButton={true}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="pickup-to" className="w-32 text-left whitespace-nowrap">
                To <span className="text-red-500">*</span>
              </Label>
              <TimePicker
                id="pickup-to"
                value={originTimeTo}
                onValueChange={(val) => {
                  setOriginTimeTo(val)
                  // Validate with From time
                  if (originTimeFrom && val) {
                    const isValid = validateTimeRange(originTimeFrom, val)
                    setPickupTimeError(!isValid)
                  }
                }}
                placeholder="Select end time"
                minTime={originTimeFrom}
                disabled={!originTimeFrom}
                error={pickupTimeError}
                className="flex-1"
                showSaveButton={true}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="order-number" className="w-32 text-left whitespace-nowrap">
                Order #
              </Label>
              <Input
                id="order-number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(validateNoChineseCharacters(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="pickup-ref" className="w-32 text-left whitespace-nowrap">
                Ref # <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pickup-ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(validateNoChineseCharacters(e.target.value))}
                placeholder="Required"
                className="flex-1"
                required
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="pickup-memo" className="w-32 text-left whitespace-nowrap">
                Memo
              </Label>
              <Input
                id="pickup-memo"
                value={originMemo}
                onChange={(e) => setOriginMemo(validateNoChineseCharacters(e.target.value).slice(0, 30))}
                maxLength={30}
                placeholder="Max 30 chars (English only)"
                className="flex-1"
              />
            </div>
            <div className="flex items-start gap-4">
              <Label htmlFor="pickup-additional-memo" className="w-32 text-left whitespace-nowrap pt-2">
                Additional Memo
              </Label>
              <Textarea
                id="pickup-additional-memo"
                value={pickupAdditionalMemo}
                onChange={(e) => setPickupAdditionalMemo(validateNoChineseCharacters(e.target.value).slice(0, 100))}
                maxLength={100}
                placeholder="Max 100 chars (English only)"
                className="flex-1 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button 
              type="button"
              variant="outline"
              onClick={() => {
                // Reset all pickup form fields
                setOriginTimeFrom("")
                setOriginTimeTo("")
                setOrderNumber("")
                setReferenceNumber("")
                setOriginMemo("")
                setPickupAdditionalMemo("")
                setPickupTimeError(false)
                setPickupDetailsSaved(false)
              }}
            >
              Reset
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (originTimeFrom && originTimeTo && referenceNumber && !pickupTimeError) {
                  setPickupDetailsSaved(true)
                }
                setPickupTimeError(false)
                setShowPickupModal(false)
              }}
              disabled={pickupTimeError || !originTimeFrom || !originTimeTo || !referenceNumber}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Modal */}
      <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Delivery Details</DialogTitle>
            <DialogDescription>
              Configure delivery time window and reference numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="delivery-from" className="w-32 text-left whitespace-nowrap">
                From <span className="text-red-500">*</span>
              </Label>
              <TimePicker
                id="delivery-from"
                value={destinationTimeFrom}
                onValueChange={(val) => {
                  setDestinationTimeFrom(val)
                  // Validate with To time if it exists
                  if (destinationTimeTo && val) {
                    const isValid = validateTimeRange(val, destinationTimeTo)
                    setDeliveryTimeError(!isValid)
                    if (!isValid) {
                      // Clear To field if it becomes invalid
                      setDestinationTimeTo("")
                    }
                  }
                }}
                placeholder="Select start time"
                className="flex-1"
                showSaveButton={true}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="delivery-to" className="w-32 text-left whitespace-nowrap">
                To <span className="text-red-500">*</span>
              </Label>
              <TimePicker
                id="delivery-to"
                value={destinationTimeTo}
                onValueChange={(val) => {
                  setDestinationTimeTo(val)
                  // Validate with From time
                  if (destinationTimeFrom && val) {
                    const isValid = validateTimeRange(destinationTimeFrom, val)
                    setDeliveryTimeError(!isValid)
                  }
                }}
                placeholder="Select end time"
                minTime={destinationTimeFrom}
                disabled={!destinationTimeFrom}
                error={deliveryTimeError}
                className="flex-1"
                showSaveButton={true}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="delivery-memo" className="w-32 text-left whitespace-nowrap">
                Memo
              </Label>
              <Input
                id="delivery-memo"
                value={destinationMemo}
                onChange={(e) => setDestinationMemo(validateNoChineseCharacters(e.target.value).slice(0, 30))}
                maxLength={30}
                placeholder="Max 30 chars (English only)"
                className="flex-1"
              />
            </div>
            <div className="flex items-start gap-4">
              <Label htmlFor="delivery-additional-memo" className="w-32 text-left whitespace-nowrap pt-2">
                Additional Memo
              </Label>
              <Textarea
                id="delivery-additional-memo"
                value={deliveryAdditionalMemo}
                onChange={(e) => setDeliveryAdditionalMemo(validateNoChineseCharacters(e.target.value).slice(0, 100))}
                maxLength={100}
                placeholder="Max 100 chars (English only)"
                className="flex-1 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button 
              type="button"
              variant="outline"
              onClick={() => {
                // Reset all delivery form fields
                setDestinationTimeFrom("")
                setDestinationTimeTo("")
                setDestinationMemo("")
                setDeliveryAdditionalMemo("")
                setDeliveryTimeError(false)
                setDeliveryDetailsSaved(false)
              }}
            >
              Reset
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (destinationTimeFrom && destinationTimeTo && !deliveryTimeError) {
                  setDeliveryDetailsSaved(true)
                }
                setDeliveryTimeError(false)
                setShowDeliveryModal(false)
              }}
              disabled={deliveryTimeError || !destinationTimeFrom || !destinationTimeTo}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Insufficient Balance Alert Dialog */}
      <AlertDialog open={showInsufficientBalanceDialog} onOpenChange={setShowInsufficientBalanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Insufficient Balance</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Your account balance is insufficient to place this order.</p>
              {balanceInfo && (
                <div className="mt-4 space-y-1 text-sm">
                  <p>Current Balance: <span className="font-semibold">${Number(balanceInfo.currentBalance || 0).toFixed(2)}</span></p>
                  <p>Required Amount: <span className="font-semibold">${Number(balanceInfo.requiredAmount || 0).toFixed(2)}</span></p>
                  <p>Shortfall: <span className="font-semibold text-red-600">${Number(balanceInfo.shortfall || 0).toFixed(2)}</span></p>
                </div>
              )}
              <p className="mt-4">Would you like to recharge your account?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              // TODO: Navigate to recharge page
              console.log('Recharge button clicked')
            }}>
              Recharge Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function OrderConfirmPage() {
  const isTablet = useIsTablet()
  
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader />
          
          <div className="flex flex-col h-[calc(100vh-4rem)]">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <OrderConfirmContent />
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}