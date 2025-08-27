"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Search, 
  CheckCircle,
  FileText,
  Clock,
  Package
} from "lucide-react"
import { useIsTablet } from "@/hooks/use-tablet"

interface OrderInfo {
  orderId: string
  amount: string
  carrier: string
  origin: string
  destination: string
}

export default function OrderSuccessPage() {
  const router = useRouter()
  const isTablet = useIsTablet()
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)

  useEffect(() => {
    // Get order info from session storage
    const storedOrder = sessionStorage.getItem('recent_order')
    if (storedOrder) {
      setOrderInfo(JSON.parse(storedOrder))
      // Don't clear immediately - keep it for page refresh
      // Only clear when user navigates away
    }
  }, [])

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 flex-1">
              <div className="relative max-w-md md:max-w-xl flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="w-full appearance-none bg-background pl-8 h-9 px-3 py-1 text-sm border rounded-md"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </Button>
          </header>

          <main className="flex flex-1 flex-col gap-8 px-4 md:px-12 py-8">
            <div className="max-w-2xl mx-auto w-full">
              {/* Success Icon and Message */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="rounded-full bg-green-100 p-3">
                    <CheckCircle className="h-16 w-16 text-green-600" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold mb-2">Order Placed Successfully!</h1>
                <p className="text-gray-600">
                  Your order has been submitted and is pending review
                </p>
              </div>

              {/* Order Status Card */}
              <Card className="mb-6">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Order Status</h2>
                    <div className="flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Pending Review
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600">
                    Your order is currently being reviewed by our team. You will receive an email confirmation once the review is complete, typically within 1-2 business hours.
                  </div>
                </CardContent>
              </Card>

              {/* Order Details Card */}
              {orderInfo && (
                <Card className="mb-6">
                  <CardHeader>
                    <h2 className="text-lg font-semibold">Order Details</h2>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-medium">{orderInfo.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(orderInfo.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carrier:</span>
                      <span className="font-medium">{orderInfo.carrier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Route:</span>
                      <span className="font-medium">
                        {orderInfo.origin} → {orderInfo.destination}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* What's Next Card */}
              <Card className="mb-6">
                <CardHeader>
                  <h2 className="text-lg font-semibold">What Happens Next?</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Order Review & Warehouse Preparation</p>
                        <p className="text-sm text-gray-600">After placing your order, our team will review the details and verify availability. Please arrange for the warehouse to prepare the goods.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Delivery with Platform BOL</p>
                        <p className="text-sm text-gray-600">When delivering the goods, ensure you use the BOL provided by the platform.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Shipment Tracking</p>
                        <p className="text-sm text-gray-600">Track your shipment in real time from pickup to delivery.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    sessionStorage.removeItem('recent_order')
                    router.push('/orders')
                  }}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  View All Orders
                </Button>
                <Button
                  onClick={() => {
                    sessionStorage.removeItem('recent_order')
                    router.push('/quotes')
                  }}
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Create New Quote
                </Button>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}