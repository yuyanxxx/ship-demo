/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
  Loader2,
  ArrowUpDown,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  Plus
} from "lucide-react"
import { CommonHeader } from "@/components/common-header"
import { useIsTablet } from "@/hooks/use-tablet"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatPriceForUser, getPriceRatio } from "@/lib/pricing-utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Order {
  id: string
  order_number: string
  status: 'booked' | 'pending_review' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled' | 'rejected' | 'exception'
  origin_company: string
  origin_address: string
  origin_city?: string
  destination_company: string
  destination_address: string
  destination_city?: string
  pickup_date: string
  pickup_time: string
  delivery_date: string
  delivery_status: 'estimated' | 'confirmed'
  mode: 'LTL' | 'TL' | 'FBA'
  carrier_name: string
  carrier_logo?: string
  cost: number // Display amount (base for admin, customer for users)
  order_amount: number // Original stored amount
  base_amount?: number // Calculated base amount
  customer_amount?: number // Customer amount (with markup)
  created_at: string
  user_id?: string
  user_email?: string
  company_name?: string
}

type TabType = 'all' | 'pending_review' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled' | 'rejected' | 'exception'

const TAB_CONFIG: { id: TabType; label: string; icon?: React.ReactNode }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending Review', icon: <Clock className="h-4 w-4" /> },
  { id: 'confirmed', label: 'Confirmed', icon: <CheckCircle className="h-4 w-4" /> },
  { id: 'in_transit', label: 'In Transit', icon: <Truck className="h-4 w-4" /> },
  { id: 'delivered', label: 'Delivered', icon: <CheckCircle className="h-4 w-4" /> },
  { id: 'cancelled', label: 'Cancelled', icon: <XCircle className="h-4 w-4" /> },
  { id: 'rejected', label: 'Rejected', icon: <XCircle className="h-4 w-4" /> },
  { id: 'exception', label: 'Exception', icon: <AlertCircle className="h-4 w-4" /> }
]

export default function OrdersPage() {
  const router = useRouter()
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchOrders()
    
    // Load user data from localStorage
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setUserData(user)
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  const fetchOrders = async () => {
    try {
      // Get user ID from localStorage
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        console.error('No user found in localStorage')
        setLoading(false)
        return
      }

      const user = JSON.parse(storedUser)
      
      // Fetch real orders from database with proper auth
      const response = await fetch('/api/orders/list', {
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      })

      const data = await response.json()

      if (data.success && data.orders) {
        setOrders(data.orders)
      } else {
        console.error('Failed to fetch orders:', data.error)
        setOrders([])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching orders:', error)
      setOrders([])
      setLoading(false)
    }
  }

  // Filter orders based on search term
  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return orders
    
    const searchLower = searchTerm.toLowerCase()
    return orders.filter(order => 
      order.order_number.toLowerCase().includes(searchLower) ||
      order.origin_company?.toLowerCase().includes(searchLower) ||
      order.destination_company?.toLowerCase().includes(searchLower) ||
      order.carrier_name?.toLowerCase().includes(searchLower) ||
      order.status?.toLowerCase().includes(searchLower)
    )
  }, [orders, searchTerm])

  // Filter orders based on active tab
  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return searchFilteredOrders
    return searchFilteredOrders.filter(order => order.status === activeTab)
  }, [searchFilteredOrders, activeTab])
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm])

  // Count orders per status for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<TabType, number> = {
      all: searchFilteredOrders.length,
      pending_review: 0,
      confirmed: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      rejected: 0,
      exception: 0
    }
    
    searchFilteredOrders.forEach(order => {
      if (order.status && counts[order.status as TabType] !== undefined) {
        counts[order.status as TabType]++
      }
    })
    
    return counts
  }, [searchFilteredOrders])

  const formatCurrency = (amount: number, useUserPricing = false) => {
    if (useUserPricing && userData) {
      const priceRatio = getPriceRatio(userData)
      return formatPriceForUser(amount, (userData as any).user_type, priceRatio)
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleCancelOrder = async () => {
    if (!orderToCancel) return
    
    setCancellingOrder(true)
    
    try {
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        console.error('No user found')
        setCancellingOrder(false)
        return
      }
      
      const user = JSON.parse(storedUser)
      
      const response = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
          'x-user-id': user.id
        },
        body: JSON.stringify({
          orderId: orderToCancel.id
        })
      })
      
      const result = await response.json()
      
      console.log('Cancel API response:', { ok: response.ok, result })
      
      // Check for actual success - never show dialog if successful
      if (response.ok && (result.success === true || result.success === 'true')) {
        // Close cancel dialog immediately
        setCancelDialogOpen(false)
        setOrderToCancel(null)
        
        // Update the order status in the local state to 'cancelled' immediately
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderToCancel.id 
              ? { ...order, status: 'cancelled' as const }
              : order
          )
        )
        
        // Refresh the orders list to get the latest data from server
        // This will ensure the database update is reflected
        await fetchOrders()
        
        // IMPORTANT: Do NOT show any success dialog/popup
        // Just update the UI and refresh the list
      } else if (!response.ok || (result.error && result.error !== 'success')) {
        // Only show error dialog if there's an actual error
        // Never show dialog if error message is 'success'
        setCancelDialogOpen(false)
        
        // Don't show error dialog if the message contains 'success'
        const errorMsg = result.error || 'Failed to cancel order. Please try again.'
        if (!errorMsg.toLowerCase().includes('success')) {
          setErrorMessage(errorMsg)
          setErrorDialogOpen(true)
        } else {
          // If we somehow get 'success' as an error, treat it as success
          // Update the order status and refresh
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === orderToCancel.id 
                ? { ...order, status: 'cancelled' as const }
                : order
            )
          )
          await fetchOrders()
        }
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      setCancelDialogOpen(false)
      setErrorMessage('An error occurred while cancelling the order. Please try again.')
      setErrorDialogOpen(true)
    } finally {
      setCancellingOrder(false)
    }
  }

  const openCancelDialog = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation() // Prevent navigation to order details
    setOrderToCancel(order)
    setCancelDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const config = TAB_CONFIG.find(tab => tab.id === status)
    if (!config || config.id === 'all') return null
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
        status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
        status === 'in_transit' ? 'bg-purple-100 text-purple-700' :
        status === 'delivered' ? 'bg-green-100 text-green-700' :
        status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
        status === 'rejected' ? 'bg-red-100 text-red-700' :
        status === 'exception' ? 'bg-orange-100 text-orange-700' :
        'bg-gray-100 text-gray-700'
      }`}>
        {config.icon}
        {config.label}
      </span>
    )
  }
  
  // Generate pagination items
  const generatePaginationItems = () => {
    const items = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        items.push(i)
      }
    } else {
      // Always show first page
      items.push(1)
      
      if (currentPage > 3) {
        items.push('ellipsis-start')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        items.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        items.push('ellipsis-end')
      }
      
      // Always show last page
      if (totalPages > 1) {
        items.push(totalPages)
      }
    }
    
    return items
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader 
            searchPlaceholder="Search orders..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
          />

          <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">All Shipments</h1>
                <p className="text-sm md:text-base text-gray-600">Manage and track your shipment orders</p>
              </div>
              <Button 
                onClick={() => router.push('/quotes')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Get a Quote
              </Button>
            </div>

            {/* Status Tabs */}
            <div className="overflow-x-auto mb-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
                <TabsList className="inline-flex h-auto">
                  {TAB_CONFIG.map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="flex items-center gap-1 data-[state=active]:shadow-sm whitespace-nowrap"
                    >
                      {tab.icon}
                      {tab.label}
                      {statusCounts[tab.id] > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600">
                          {statusCounts[tab.id]}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Orders Summary - Moved to pagination section */}
            
            {/* Orders List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? `No orders match your search in "${TAB_CONFIG.find(t => t.id === activeTab)?.label}" status` 
                    : activeTab === 'all' 
                      ? 'You haven\'t placed any orders yet'
                      : `No orders with "${TAB_CONFIG.find(t => t.id === activeTab)?.label}" status`}
                </p>
                {!searchTerm && activeTab === 'all' && (
                  <Button onClick={() => window.location.href = '/quotes'}>
                    Create Your First Quote
                  </Button>
                )}
              </div>
            ) : isMobile ? (
              // Mobile Card Layout
              <>
                <div className="space-y-3">
                  {paginatedOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    {/* First row: Order ID and Status */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-base">
                        {order.order_number}
                      </span>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        {order.status === 'pending_review' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => openCancelDialog(e, order)}
                            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                            title="Cancel Order"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Second row: Origin and Destination with dashed line */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600">From: </span>
                        <span className="text-sm font-medium ml-1">
                          {order.origin_city || order.origin_address.split(',')[0]}
                        </span>
                      </div>
                      
                      <div className="flex-1 mx-3">
                        <div className="border-t border-dashed border-gray-300"></div>
                      </div>
                      
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600">To: </span>
                        <span className="text-sm font-medium ml-1">
                          {order.destination_city || order.destination_address.split(',')[0]}
                        </span>
                      </div>
                    </div>
                    
                    {/* Third row: Cost */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Cost</span>
                      <div className="text-right">
                        <span className="font-semibold text-base">
                          {formatCurrency(order.cost, false)}
                        </span>
                        {userData && (userData as any)?.user_type === 'admin' && order.user_email && userData.email !== order.user_email && order.customer_amount && (
                          <div className="text-xs text-blue-600">
                            Customer Paid: {formatCurrency(order.customer_amount, false)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination - Mobile */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {generatePaginationItems().map((item, index) => (
                        <PaginationItem key={index}>
                          {item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(Number(item))}
                              isActive={currentPage === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            ) : (
              // Desktop/Tablet Table Layout
              <>
                <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                            Load ID
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Status</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Origin</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Destination</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Pickup</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Delivery</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Mode</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Carrier</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Cost</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Actions</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedOrders.map((order) => (
                        <tr 
                          key={order.id} 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <td className="px-4 py-3">
                            <div>
                            <span className="text-sm font-medium">
                              {order.order_number}
                            </span>
                              {userData?.user_type === 'admin' && order.user_email && userData.email !== order.user_email && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Customer: {order.user_email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm font-medium">{order.origin_company}</div>
                              <div className="text-xs text-gray-500">{order.origin_city || order.origin_address.split(',')[0]}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm font-medium">{order.destination_company}</div>
                              <div className="text-xs text-gray-500">{order.destination_city || order.destination_address.split(',')[0]}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm">{order.pickup_date}</div>
                              <div className="text-xs text-gray-500">{order.pickup_time}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm">{order.delivery_date}</div>
                              <div className="text-xs text-gray-500">
                                {order.delivery_status === 'estimated' ? 'Estimated' : 'Confirmed'}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              {order.mode}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {order.carrier_logo && (
                                <img 
                                  src={order.carrier_logo} 
                                  alt={order.carrier_name} 
                                  className="h-5 w-auto"
                                />
                              )}
                              <span className="text-sm">{order.carrier_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-sm font-medium">{formatCurrency(order.cost, false)}</div>
                              {userData && (userData as any)?.user_type === 'admin' && order.user_email && userData.email !== order.user_email && order.customer_amount && (
                                <div className="text-xs text-blue-600">Customer Paid: {formatCurrency(order.customer_amount, false)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {order.status === 'pending_review' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => openCancelDialog(e, order)}
                                className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                                title="Cancel Order"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Pagination - Desktop */}
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {generatePaginationItems().map((item, index) => (
                        <PaginationItem key={index}>
                          {item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(Number(item))}
                              isActive={currentPage === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
              </>
            )}
          </main>

          {/* Cancel Order Dialog */}
          <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel order <strong>#{orderToCancel?.order_number}</strong>? 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  disabled={cancellingOrder}
                  onClick={(e) => {
                    if (cancellingOrder) {
                      e.preventDefault();
                      return;
                    }
                  }}
                >
                  Keep Order
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelOrder}
                  disabled={cancellingOrder}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {cancellingOrder ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel Order'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Error Dialog */}
          <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Error
                  </div>
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {errorMessage}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
                  OK
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}