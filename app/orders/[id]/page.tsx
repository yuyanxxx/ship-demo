/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Package, 
  Truck,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar
} from "lucide-react"
import { useIsTablet } from "@/hooks/use-tablet"
import { formatPriceForUser, getPriceRatio } from "@/lib/pricing-utils"

interface TrackingEvent {
  time: string
  location: string
  event: string
}

interface OrderDetails {
  id: string
  order_number: string
  status: string
  order_status?: string
  track_number?: string
  tracking_number?: string
  pro_number?: string
  audit_remark?: string
  pickup_number?: string
  delivery_number?: string
  insured_status?: string
  files?: Array<{
    url: string
    type: string
  }>
  last_api_sync?: string
  origin_extra_memo?: string
  destination_extra_memo?: string
  
  // Dates
  order_date: string
  pickup_date: string
  estimated_delivery_date: string
  actual_delivery_date?: string
  
  // Origin
  origin_location_name: string
  origin_contact_name: string
  origin_contact_phone: string
  origin_contact_email: string
  origin_address_line1: string
  origin_address_line2?: string
  origin_city: string
  origin_state: string
  origin_zip_code: string
  origin_type?: string
  origin_time_from?: string
  origin_time_to?: string
  origin_memo?: string
  
  // Destination
  destination_location_name: string
  destination_contact_name: string
  destination_contact_phone: string
  destination_contact_email: string
  destination_address_line1: string
  destination_address_line2?: string
  destination_city: string
  destination_state: string
  destination_zip_code: string
  destination_type?: string
  destination_time_from?: string
  destination_time_to?: string
  destination_memo?: string
  
  // Carrier
  carrier_name: string
  carrier_scac?: string
  carrier_guarantee?: string
  service_type: string
  
  // Financial
  order_amount: number
  line_charge?: number
  fuel_charge?: number
  accessorial_charge?: number
  insurance_amount?: number
  
  // References
  reference_number: string
  bol_number?: string
  customer_order_number?: string
  is_customer_order?: boolean
  customer_line_charge?: number
  customer_fuel_charge?: number
  customer_accessorial_charge?: number
  customer_insurance_amount?: number
  customer_order_amount?: number
}

interface OrderItem {
  id: string
  item_number: number
  product_name: string
  package_type: string
  quantity: number
  pallet_quantity: number
  weight_per_unit: number
  total_weight: number
  length?: number
  width?: number
  height?: number
  freight_class?: string
  nmfc_code?: string
  declared_value?: number
}

function OrderDetailsContent() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [syncingStatus, setSyncingStatus] = useState(false)
  const [trackingInfo, setTrackingInfo] = useState<TrackingEvent[]>([])
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null)

  // Fetch order details and sync with API
  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        router.push('/login')
        return
      }

      const user = JSON.parse(storedUser)
      setUserData(user) // Store user data for pricing

      // First fetch order details
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`,
          'x-user-id': user.id,
          'x-user-data': JSON.stringify(user)
        }
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch order details')
      }

      setOrder(data.order)
      setOrderItems(data.orderItems || [])

      // Only fetch tracking information for 'in_transit' and 'delivered' statuses
      const trackableStatuses = ['in_transit', 'delivered']
      if (trackableStatuses.includes(data.order.status)) {
        fetchTrackingInfo(user.id)
      }

      // Skip sync for cancelled, rejected, or exception orders
      const skipSyncStatuses = ['cancelled', 'rejected', 'exception']
      if (!skipSyncStatuses.includes(data.order.status)) {
        // Then sync with RapidDeals API in the background
        setSyncingStatus(true)
        fetch(`/api/orders/${orderId}/sync`, {
          headers: {
            'Authorization': `Bearer ${user.id}`,
            'x-user-id': user.id,
            'x-user-data': JSON.stringify(user)
          }
        }).then(async (syncResponse) => {
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            if (syncData.success && syncData.order) {
              setOrder(syncData.order)
            }
          }
        }).catch(err => {
          console.error('Sync failed:', err)
          // Don't show error for sync failure, just use cached data
        }).finally(() => {
          setSyncingStatus(false)
        })
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(err instanceof Error ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }


  // Fetch tracking information
  const fetchTrackingInfo = async (userId: string) => {
    try {
      setLoadingTracking(true)
      setTrackingError(null)

      const response = await fetch(`/api/orders/${orderId}/tracking`, {
        headers: {
          'Authorization': `Bearer ${userId}`,
          'x-user-id': userId
        }
      })

      const data = await response.json()

      if (data.success && data.trackingInfo && data.trackingInfo.length > 0) {
        setTrackingInfo(data.trackingInfo)
      } else {
        // If no tracking data available, set empty array
        setTrackingInfo([])
        if (!data.success) {
          setTrackingError(data.error || 'Failed to fetch tracking information')
        }
      }
    } catch (err) {
      console.error('Error fetching tracking:', err)
      setTrackingError('Failed to load tracking information')
    } finally {
      setLoadingTracking(false)
    }
  }

  useEffect(() => {
    fetchOrderDetails()
  }, [orderId])

  // Get status badge color and icon
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      'pending_review': { 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: <Clock className="h-4 w-4" />,
        label: 'Pending Review'
      },
      'rejected': { 
        color: 'bg-red-100 text-red-800', 
        icon: <XCircle className="h-4 w-4" />,
        label: 'Rejected'
      },
      'confirmed': { 
        color: 'bg-blue-100 text-blue-800', 
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Confirmed'
      },
      'in_transit': { 
        color: 'bg-purple-100 text-purple-800', 
        icon: <Truck className="h-4 w-4" />,
        label: 'In Transit'
      },
      'delivered': { 
        color: 'bg-green-100 text-green-800', 
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Delivered'
      },
      'cancelled': { 
        color: 'bg-gray-100 text-gray-800', 
        icon: <XCircle className="h-4 w-4" />,
        label: 'Cancelled'
      },
      'exception': { 
        color: 'bg-orange-100 text-orange-800', 
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Exception'
      }
    }

    const statusInfo = statusMap[status] || statusMap['pending_review']
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.icon}
        {statusInfo.label}
      </span>
    )
  }

  // Format tracking time
  const formatTrackingTime = (timeString: string) => {
    try {
      // Handle both formats: "2025-08-12 12:30:01" and "2022-01-25T05:39:16"
      const date = new Date(timeString.replace(' ', 'T'))
      if (isNaN(date.getTime())) {
        return timeString // Return original if parsing fails
      }
      
      // Format as "Aug 12, 2025 at 12:30 PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      return timeString
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Format time
  const formatTime = (time: string | undefined) => {
    if (!time) return 'N/A'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Get file type label
  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'bol': return 'Bill of Lading'
      case 'shipmentLabel': return 'Shipment Label'
      case 'pod': return 'Proof of Delivery'
      default: return type.toUpperCase()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-lg text-gray-600">{error || 'Order not found'}</p>
        <Button onClick={() => router.push('/orders')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <CommonHeader showSearch={false}>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/orders')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">Order #{order.order_number}</h1>
          {syncingStatus ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing Status...
            </div>
          ) : (
            getStatusBadge(order.status)
          )}
        </div>
      </CommonHeader>

      {/* Content - 3:1 Layout */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-full">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Left Side - 3/4 width */}
            <div className="lg:col-span-3 space-y-6">
              {/* Audit Remark - Show if exists */}
              {order.audit_remark && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Audit Remark:</strong> {order.audit_remark}
                  </p>
                </div>
              )}


              {/* Shipment Details */}
              <div className="border rounded-lg">
                <div className="bg-gray-50 px-6 py-2 border-b">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Shipment Details
                  </h2>
                </div>
                <div className="px-6 py-4 space-y-6">
                  {/* Dates */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Important Dates</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Order Date</p>
                        <p className="font-medium">{formatDate(order.order_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Pickup Date</p>
                        <p className="font-medium">{formatDate(order.pickup_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Est. Delivery</p>
                        <p className="font-medium">{formatDate(order.estimated_delivery_date)}</p>
                      </div>
                      {order.actual_delivery_date && (
                        <div>
                          <p className="text-sm text-gray-500">Actual Delivery</p>
                          <p className="font-medium">{formatDate(order.actual_delivery_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Carrier Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Carrier Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Carrier</p>
                        <p className="font-medium">{order.carrier_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Service Type</p>
                        <p className="font-medium">{order.service_type}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pickup/Delivery Numbers */}
                  {(order.pickup_number || order.delivery_number) && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Pickup/Delivery Numbers</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {order.pickup_number && (
                            <div>
                              <p className="text-sm text-gray-500">Pickup Number</p>
                              <p className="font-mono font-medium">{order.pickup_number}</p>
                            </div>
                          )}
                          {order.delivery_number && (
                            <div>
                              <p className="text-sm text-gray-500">Delivery Number</p>
                              <p className="font-mono font-medium">{order.delivery_number}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* References */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Reference Numbers</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Reference #</p>
                        <p className="font-medium">{order.reference_number}</p>
                      </div>
                      {order.bol_number && (
                        <div>
                          <p className="text-sm text-gray-500">BOL #</p>
                          <p className="font-medium">{order.bol_number}</p>
                        </div>
                      )}
                      {order.customer_order_number && (
                        <div>
                          <p className="text-sm text-gray-500">Customer Order #</p>
                          <p className="font-medium">{order.customer_order_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Origin & Destination - Updated Display Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Origin - Compact Display */}
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <div className="flex items-center">
                        {order.origin_type === 'BUSINESS' || order.origin_type === 'BUSINESSDOC' ? (
                          // Commercial Address Icon
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M3 21v-13l9 -4l9 4v13" />
                            <path d="M13 13h4v8h-10v-6h6" />
                            <path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3" />
                          </svg>
                        ) : order.origin_type === 'RESIDENTIAL' ? (
                          // Residential Address Icon
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M4 21v-15c0 -1 1 -2 2 -2h5c1 0 2 1 2 2v15" />
                            <path d="M16 8h2c1 0 2 1 2 2v11" />
                            <path d="M3 21h18" />
                            <path d="M10 12v0" />
                            <path d="M10 16v0" />
                            <path d="M10 8v0" />
                            <path d="M7 12v0" />
                            <path d="M7 16v0" />
                            <path d="M7 8v0" />
                            <path d="M17 12v0" />
                            <path d="M17 16v0" />
                          </svg>
                        ) : (
                          // Default Origin Icon
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8" fill="#10B981" stroke="#059669" strokeWidth="2"/>
                            <circle cx="10" cy="10" r="3" fill="white"/>
                          </svg>
                        )}
                      </div>
                      <span>Origin {order.origin_type === 'BUSINESS' || order.origin_type === 'BUSINESSDOC' ? '(Commercial)' : order.origin_type === 'RESIDENTIAL' ? '(Residential)' : ''}</span>
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      {/* Location Name */}
                      <div>
                        <h4 className="font-semibold text-gray-900">{order.origin_location_name}</h4>
                      </div>
                      
                      {/* Address */}
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {order.origin_address_line1}<br />
                        {order.origin_address_line2 && (
                          <>{order.origin_address_line2}<br /></>
                        )}
                        {order.origin_city}, {order.origin_state} {order.origin_zip_code}
                      </div>

                      {/* Contact Info */}
                      <div className="border-t pt-3">
                        <p className="font-medium text-sm text-gray-900 mb-2">{order.origin_contact_name}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{order.origin_contact_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{order.origin_contact_email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pickup Time */}
                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            Pickup: {formatTime(order.origin_time_from)} - {formatTime(order.origin_time_to)}
                          </span>
                        </div>
                      </div>

                      {/* Memo if exists */}
                      {order.origin_memo && (
                        <div className="border-t pt-3">
                          <p className="text-sm text-gray-500">Note: {order.origin_memo}</p>
                        </div>
                      )}
                      
                      {/* Additional Memo if exists */}
                      {order.origin_extra_memo && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-600 mb-1">Pickup Additional Memo:</p>
                          <p className="text-sm text-gray-700">{order.origin_extra_memo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Destination - Compact Display */}
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <div className="flex items-center">
                        {order.destination_type === 'BUSINESS' || order.destination_type === 'BUSINESSDOC' ? (
                          // Commercial Address Icon
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M3 21v-13l9 -4l9 4v13" />
                            <path d="M13 13h4v8h-10v-6h6" />
                            <path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3" />
                          </svg>
                        ) : order.destination_type === 'RESIDENTIAL' ? (
                          // Residential Address Icon
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M4 21v-15c0 -1 1 -2 2 -2h5c1 0 2 1 2 2v15" />
                            <path d="M16 8h2c1 0 2 1 2 2v11" />
                            <path d="M3 21h18" />
                            <path d="M10 12v0" />
                            <path d="M10 16v0" />
                            <path d="M10 8v0" />
                            <path d="M7 12v0" />
                            <path d="M7 16v0" />
                            <path d="M7 8v0" />
                            <path d="M17 12v0" />
                            <path d="M17 16v0" />
                          </svg>
                        ) : (
                          // Default Destination Icon
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2C7.24 2 5 4.24 5 7C5 11.5 10 18 10 18C10 18 15 11.5 15 7C15 4.24 12.76 2 10 2Z" fill="#EF4444" stroke="#DC2626" strokeWidth="1"/>
                            <circle cx="10" cy="7" r="2" fill="white"/>
                          </svg>
                        )}
                      </div>
                      <span>Destination {order.destination_type === 'BUSINESS' || order.destination_type === 'BUSINESSDOC' ? '(Commercial)' : order.destination_type === 'RESIDENTIAL' ? '(Residential)' : ''}</span>
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      {/* Location Name */}
                      <div>
                        <h4 className="font-semibold text-gray-900">{order.destination_location_name}</h4>
                      </div>
                      
                      {/* Address */}
                      <div className="text-sm text-gray-600 leading-relaxed">
                        {order.destination_address_line1}<br />
                        {order.destination_address_line2 && (
                          <>{order.destination_address_line2}<br /></>
                        )}
                        {order.destination_city}, {order.destination_state} {order.destination_zip_code}
                      </div>

                      {/* Contact Info */}
                      <div className="border-t pt-3">
                        <p className="font-medium text-sm text-gray-900 mb-2">{order.destination_contact_name}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{order.destination_contact_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{order.destination_contact_email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Time */}
                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            Delivery: {formatTime(order.destination_time_from)} - {formatTime(order.destination_time_to)}
                          </span>
                        </div>
                      </div>

                      {/* Memo if exists */}
                      {order.destination_memo && (
                        <div className="border-t pt-3">
                          <p className="text-sm text-gray-500">Note: {order.destination_memo}</p>
                        </div>
                      )}
                      
                      {/* Additional Memo if exists */}
                      {order.destination_extra_memo && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-600 mb-1">Delivery Additional Memo:</p>
                          <p className="text-sm text-gray-700">{order.destination_extra_memo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Items */}
              {orderItems.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Cargo Items
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">#</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Product</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Type</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Qty</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Pallets</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Weight</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Dimensions</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Class</th>
                            <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-3 px-2 text-sm">{item.item_number}</td>
                              <td className="py-3 px-2 text-sm font-medium">{item.product_name}</td>
                              <td className="py-3 px-2 text-sm">{item.package_type}</td>
                              <td className="py-3 px-2 text-sm">{item.quantity}</td>
                              <td className="py-3 px-2 text-sm">{item.pallet_quantity}</td>
                              <td className="py-3 px-2 text-sm">{item.total_weight} lbs</td>
                              <td className="py-3 px-2 text-sm">
                                {item.length && item.width && item.height 
                                  ? `${item.length}x${item.width}x${item.height}"`
                                  : 'N/A'}
                              </td>
                              <td className="py-3 px-2 text-sm">{item.freight_class || 'N/A'}</td>
                              <td className="py-3 px-2 text-sm">
                                {item.declared_value ? `$${item.declared_value}` : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Side - 1/4 width - Tracking & Pricing */}
            <div className="lg:col-span-1 space-y-6">
              {/* Tracking Information - Only show for in_transit and delivered statuses */}
              {(order.status === 'in_transit' || order.status === 'delivered') && (
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Tracking Information
                      {loadingTracking && (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      )}
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    {/* Tracking Number */}
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-sm text-gray-500">Tracking Number</p>
                          <p className="font-semibold">{order.track_number || order.tracking_number || 'N/A'}</p>
                        </div>
                        {order.pro_number && (
                          <div>
                            <p className="text-sm text-gray-500">PRO Number</p>
                            <p className="font-semibold">{order.pro_number}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tracking Timeline */}
                    {loadingTracking ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    ) : trackingError ? (
                      <div className="text-center py-8">
                        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">{trackingError}</p>
                      </div>
                    ) : trackingInfo.length > 0 ? (
                      <div className="relative max-h-[400px] overflow-y-auto">
                        {/* Timeline */}
                        <div className="space-y-4">
                          {trackingInfo.slice(0, 5).map((event, index) => {
                            const isFirst = index === 0
                            const isLast = index === Math.min(4, trackingInfo.length - 1)
                            const isDelivered = event.event.toLowerCase().includes('delivered')
                            const isInTransit = event.event.toLowerCase().includes('transit') || event.event.toLowerCase().includes('out for delivery')
                            const isPickup = event.event.toLowerCase().includes('pickup') || event.event.toLowerCase().includes('picked up') || event.event.toLowerCase().includes('manifested') || event.event.toLowerCase().includes('shipment information')
                            
                            return (
                              <div key={index} className="relative flex gap-3">
                                {/* Timeline Line */}
                                {!isLast && (
                                  <div className="absolute left-[11px] top-[24px] w-[2px] h-[calc(100%+16px)] bg-gray-200" />
                                )}
                                
                                {/* Timeline Dot */}
                                <div className="relative z-10 flex-shrink-0">
                                  <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center ${
                                    isFirst ? 'bg-blue-500' :
                                    isDelivered ? 'bg-green-500' :
                                    isInTransit ? 'bg-purple-500' :
                                    isPickup ? 'bg-orange-500' :
                                    'bg-gray-400'
                                  }`}>
                                    {isDelivered ? (
                                      <CheckCircle className="h-3 w-3 text-white" />
                                    ) : isInTransit ? (
                                      <Truck className="h-3 w-3 text-white" />
                                    ) : isPickup ? (
                                      <Package className="h-3 w-3 text-white" />
                                    ) : (
                                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Event Content */}
                                <div className="flex-1 pb-4">
                                  <div className="space-y-1">
                                    <h4 className={`text-sm font-medium ${
                                      isFirst ? 'text-blue-900' : 'text-gray-900'
                                    }`}>
                                      {event.event}
                                      {isFirst && (
                                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Latest</span>
                                      )}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                      <MapPin className="h-3 w-3" />
                                      <span>{event.location}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                      <Calendar className="h-3 w-3" />
                                      <span>{formatTrackingTime(event.time)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {trackingInfo.length > 5 && (
                            <div className="text-center pt-2">
                              <p className="text-xs text-gray-500">
                                +{trackingInfo.length - 5} more events
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No tracking information available yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order Pricing Details */}
              <div className="border rounded-lg">
                <div className="bg-gray-50 px-6 py-2 border-b">
                  <h2 className="text-lg font-semibold">Order Pricing Details</h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.line_charge !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Line Charge</span>
                        <div className="text-right">
                          <span className="font-medium">
                            ${order.line_charge.toFixed(2)}
                          </span>
                          {(order as any)?.is_customer_order && (order as any)?.customer_line_charge && (
                            <div className="text-xs text-blue-600">Customer Paid: ${(order as any).customer_line_charge.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {order.fuel_charge !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Fuel Charge</span>
                        <div className="text-right">
                          <span className="font-medium">
                            ${order.fuel_charge.toFixed(2)}
                          </span>
                          {(order as any)?.is_customer_order && (order as any)?.customer_fuel_charge && (
                            <div className="text-xs text-blue-600">Customer Paid: ${(order as any).customer_fuel_charge.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {order.accessorial_charge !== undefined && order.accessorial_charge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Accessorial</span>
                        <div className="text-right">
                          <span className="font-medium">
                            ${order.accessorial_charge.toFixed(2)}
                          </span>
                          {(order as any)?.is_customer_order && (order as any)?.customer_accessorial_charge && (
                            <div className="text-xs text-blue-600">Customer Paid: ${(order as any).customer_accessorial_charge.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {order.insurance_amount !== undefined && order.insurance_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Insurance</span>
                        <div className="text-right">
                          <span className="font-medium">
                            ${order.insurance_amount.toFixed(2)}
                          </span>
                          {(order as any)?.is_customer_order && (order as any)?.customer_insurance_amount && (
                            <div className="text-xs text-blue-600">Customer Paid: ${(order as any).customer_insurance_amount.toFixed(2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Separator className="my-3" />
                    
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Amount</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                          ${order.order_amount.toFixed(2)}
                        </span>
                        {(order as any)?.is_customer_order && (order as any)?.customer_order_amount && (
                          <div className="text-sm text-blue-600 font-medium">
                            Customer Paid: ${(order as any).customer_order_amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {order.insured_status && (
                      <>
                        <Separator className="my-3" />
                        <div className="text-sm">
                          <p className="text-gray-500 mb-1">Insurance Status</p>
                          <p className={`font-medium ${
                            order.insured_status === 'Purchase successful' 
                              ? 'text-green-600' 
                              : order.insured_status === 'Purchase failed'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}>
                            {order.insured_status}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents - With proper spacing */}
              {order.files && order.files.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documents
                      {syncingStatus && (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      )}
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-3">
                      {order.files.map((file, index) => {
                        const isCancelled = order.status === 'cancelled';
                        return (
                          <div 
                            key={index} 
                            className={`border rounded-lg p-4 transition-colors ${
                              isCancelled 
                                ? 'bg-gray-50 cursor-not-allowed opacity-60' 
                                : 'hover:bg-gray-50 cursor-pointer'
                            }`}
                            onClick={() => !isCancelled && window.open(file.url, '_blank')}
                            title={isCancelled ? 'Documents are read-only for cancelled orders' : 'Click to download'}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-gray-400" />
                                <div>
                                  <p className="font-medium text-sm">{getFileTypeLabel(file.type)}</p>
                                  <p className="text-xs text-gray-500">
                                    {isCancelled ? 'Read-only (Order Cancelled)' : 'Click to download'}
                                  </p>
                                </div>
                              </div>
                              <Download className={`h-4 w-4 ${isCancelled ? 'text-gray-300' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailsPage() {
  const isTablet = useIsTablet()
  
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <OrderDetailsContent />
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}