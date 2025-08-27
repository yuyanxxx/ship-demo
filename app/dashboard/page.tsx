"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Search, 
  Package, 
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  MapPin,
  Plus,
  Users,
  BarChart3,
  FileText,
  XCircle
} from "lucide-react"
import { useIsTablet } from "@/hooks/use-tablet"
import { api } from "@/lib/api-client"

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  confirmedOrders: number
  inTransitOrders: number
  deliveredOrders: number
  cancelledOrders: number
  rejectedOrders: number
  exceptionOrders: number
  totalSpent: number
  avgOrderValue: number
  savedAddresses: number
  recentQuotes: number
}

interface OrderData {
  id: string
  order_number: string
  status: string
  origin_city?: string
  destination_city?: string
  pickup_date?: string
  pickup_date_formatted?: string
  carrier_name?: string
  cost?: number
  mode?: string
  user_email?: string
  company_name?: string
}

interface RecentOrder {
  id: string
  order_number: string
  status: string
  origin_city: string
  destination_city: string
  pickup_date: string
  carrier_name: string
  cost: number
  mode: string
  user_email?: string
  company_name?: string
}

interface StatusDistribution {
  status: string
  count: number
  percentage: number
}

const TAB_CONFIG: { id: string; label: string; icon?: React.ReactNode; color?: string }[] = [
  { id: 'all', label: 'All Orders', color: 'text-gray-600' },
  { id: 'pending_review', label: 'Pending Review', icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600' },
  { id: 'confirmed', label: 'Confirmed', icon: <CheckCircle className="h-4 w-4" />, color: 'text-blue-600' },
  { id: 'in_transit', label: 'In Transit', icon: <Truck className="h-4 w-4" />, color: 'text-purple-600' },
  { id: 'delivered', label: 'Delivered', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
  { id: 'cancelled', label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500' },
  { id: 'rejected', label: 'Rejected', icon: <XCircle className="h-4 w-4" />, color: 'text-red-600' },
  { id: 'exception', label: 'Exception', icon: <AlertCircle className="h-4 w-4" />, color: 'text-orange-600' }
]

export default function DashboardPage() {
  const router = useRouter()
  const isTablet = useIsTablet()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    rejectedOrders: 0,
    exceptionOrders: 0,
    totalSpent: 0,
    avgOrderValue: 0,
    savedAddresses: 0,
    recentQuotes: 0
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([])
  const [userName, setUserName] = useState<string>("")
  const [userType, setUserType] = useState<string>("")

  useEffect(() => {
    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get user from localStorage
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        router.push('/login')
        return
      }

      const user = JSON.parse(storedUser)
      setUserName(user.full_name?.split(' ')[0] || 'there')
      setUserType(user.user_type || 'customer')

      // Fetch orders with proper auth
      const ordersResponse = await api.get('/api/orders/list')

      const ordersData = await ordersResponse.json()
      
      console.log('Dashboard - API Response:', {
        success: ordersData.success,
        orderCount: ordersData.orders?.length,
        orders: ordersData.orders
      })

      if (ordersData.success && ordersData.orders) {
        const orders = ordersData.orders

        // Calculate statistics
        const stats: DashboardStats = {
          totalOrders: orders.length,
          pendingOrders: orders.filter((o: OrderData) => o.status === 'pending_review').length,
          confirmedOrders: orders.filter((o: OrderData) => o.status === 'confirmed').length,
          inTransitOrders: orders.filter((o: OrderData) => o.status === 'in_transit').length,
          deliveredOrders: orders.filter((o: OrderData) => o.status === 'delivered').length,
          cancelledOrders: orders.filter((o: OrderData) => o.status === 'cancelled').length,
          rejectedOrders: orders.filter((o: OrderData) => o.status === 'rejected').length,
          exceptionOrders: orders.filter((o: OrderData) => o.status === 'exception').length,
          totalSpent: orders.reduce((sum: number, o: OrderData) => sum + (o.cost || 0), 0),
          avgOrderValue: orders.length > 0 ? orders.reduce((sum: number, o: OrderData) => sum + (o.cost || 0), 0) / orders.length : 0,
          savedAddresses: 0, // Will fetch separately
          recentQuotes: 0 // Will fetch from session storage
        }

        setStats(stats)

        // Get recent orders (last 5)
        const recent = orders.slice(0, 5).map((order: OrderData) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          origin_city: order.origin_city || 'N/A',
          destination_city: order.destination_city || 'N/A',
          pickup_date: order.pickup_date_formatted || order.pickup_date || 'N/A',
          carrier_name: order.carrier_name || 'N/A',
          cost: order.cost || 0,
          mode: order.mode || 'N/A',
          user_email: order.user_email,
          company_name: order.company_name
        }))
        setRecentOrders(recent)

        // Calculate status distribution
        const statusCounts: { [key: string]: number } = {}
        orders.forEach((order: OrderData) => {
          if (order.status) {
            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1
          }
        })

        const distribution = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
          percentage: orders.length > 0 ? (count / orders.length) * 100 : 0
        }))
        setStatusDistribution(distribution)
      }

      // Fetch addresses count - for customers, only their own; for admins, still their own (not all)
      try {
        const addressResponse = await api.get(`/api/addresses?user_id=${user.id}`)
        const addressData = await addressResponse.json()
        if (addressData.addresses) {
          setStats(prev => ({ ...prev, savedAddresses: addressData.addresses.length }))
        }
      } catch (error) {
        console.error('Error fetching addresses:', error)
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'in_transit': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'exception': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review': return <Clock className="h-4 w-4" />
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'in_transit': return <Truck className="h-4 w-4" />
      case 'delivered': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      case 'exception': return <AlertCircle className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getTabCount = (tabId: string): number => {
    switch (tabId) {
      case 'all': return stats.totalOrders
      case 'pending_review': return stats.pendingOrders
      case 'confirmed': return stats.confirmedOrders
      case 'in_transit': return stats.inTransitOrders
      case 'delivered': return stats.deliveredOrders
      case 'cancelled': return stats.cancelledOrders
      case 'rejected': return stats.rejectedOrders
      case 'exception': return stats.exceptionOrders
      default: return 0
    }
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <div className="relative w-full max-w-md md:max-w-xl lg:max-w-xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm"
                />
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="ml-auto flex items-center gap-2 pr-4">
              <Button
                onClick={() => router.push('/quotes')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Get Quote
              </Button>
            </div>

          </header>

          <div className="flex flex-1 flex-col">
            <div className="p-6 space-y-6">
              {/* Order Overview - Display as cards in one row */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Welcome back, {userName}! </h2>
                    <p className="text-muted-foreground">
                      {userType === 'admin' 
                        ? "Here's an overview of all customer shipments." 
                        : "Here's what's happening with your shipments today."}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/orders')}
                  >
                    View all orders
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                  {TAB_CONFIG.map((tab) => {
                    const count = getTabCount(tab.id)
                    const TabIcon = tab.icon ? () => tab.icon : () => <Package className="h-4 w-4" />
                    return (
                      <Card 
                        key={tab.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
                        onClick={() => router.push('/orders')}
                      >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 px-4 pb-1">
                          <CardTitle className="text-xs font-medium">{tab.label}</CardTitle>
                          <TabIcon />
                        </CardHeader>
                        <CardContent className="p-0 px-4 pt-0">
                          <div className="text-2xl font-bold">{count}</div>
                          <p className="text-xs text-muted-foreground">
                            {tab.id === 'all' ? 'Total' : 
                             tab.id === 'pending_review' ? 'Awaiting' :
                             tab.id === 'in_transit' ? 'Shipping' :
                             tab.id === 'delivered' ? 'Complete' :
                             tab.id === 'confirmed' ? 'Ready' :
                             'Orders'}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid gap-6 md:grid-cols-8">
                {/* Recent Orders - Takes more space */}
                <Card className="md:col-span-5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Your latest shipment activities</CardDescription>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push('/orders')}
                      >
                        View all
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : recentOrders.length > 0 ? (
                      <div>
                        {recentOrders.map((order, index) => (
                          <div 
                            key={order.id}
                            className={`grid ${userType === 'admin' ? 'grid-cols-6' : 'grid-cols-6'} items-center py-3 px-2 hover:bg-muted/50 cursor-pointer transition-colors gap-4 ${
                              index < recentOrders.length - 1 ? 'border-b' : ''
                            }`}
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            <div className="col-span-1">
                              <p className="font-medium text-sm">#{order.order_number}</p>
                            </div>
                            {userType === 'admin' && (
                              <div className="col-span-1">
                                <p className="text-sm text-muted-foreground truncate">{order.user_email}</p>
                              </div>
                            )}
                            <div className="col-span-2">
                              <p className="text-sm text-muted-foreground">
                                {order.origin_city} → {order.destination_city}
                              </p>
                            </div>
                            {userType !== 'admin' && (
                              <div className="col-span-1">
                                <span className="text-xs text-muted-foreground">
                                  {order.pickup_date}
                                </span>
                              </div>
                            )}
                            <div className="col-span-1 flex justify-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {order.status.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className="font-semibold text-sm">{formatCurrency(order.cost)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No orders yet</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => router.push('/quotes')}
                        >
                          Create your first shipment
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle>Status Distribution</CardTitle>
                    <CardDescription>Overview of your shipment statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statusDistribution.length > 0 ? (
                      <div className="space-y-4">
                        {statusDistribution.map((item) => (
                          <div key={item.status} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(item.status)}
                                <span className="text-sm font-medium capitalize">
                                  {item.status.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {item.count} ({item.percentage.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  item.status === 'delivered' ? 'bg-green-500' :
                                  item.status === 'in_transit' ? 'bg-purple-500' :
                                  item.status === 'pending_review' ? 'bg-yellow-500' :
                                  item.status === 'confirmed' ? 'bg-blue-500' :
                                  item.status === 'cancelled' ? 'bg-gray-500' :
                                  item.status === 'rejected' ? 'bg-red-500' :
                                  'bg-orange-500'
                                }`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}