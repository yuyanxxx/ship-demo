"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AuthGuard } from "@/components/auth-guard"
import { useIsTablet } from "@/hooks/use-tablet"
import { HelpCircle, Search, Shield, DollarSign, FileText, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

interface StoredOrder {
  id: string
  order_number: string
  order_date: string
  pickup_date: string
  delivery_date: string
  origin_city: string
  origin_state: string
  origin_zip_code: string
  origin_country: string
  origin_address_line1: string
  origin_address_line2?: string
  origin_contact_name: string
  origin_contact_phone: string
  origin_contact_email: string
  destination_city: string
  destination_state: string
  destination_zip_code: string
  destination_country: string
  destination_address_line1: string
  destination_address_line2?: string
  destination_contact_name: string
  destination_contact_phone: string
  destination_contact_email: string
  order_amount: number
  declared_value: number  // Add declared value from order_items
  status: string
  has_insurance?: boolean
  insurance_certificate_number?: string
  mode?: string
  carrier_name?: string
}

interface InsuranceQuote {
  id: string
  quoteToken: string
  dbQuoteToken?: string // Reference token for database if JWT is too long
  product: {
    id: string
    name: string
    description: string
    termsAndConditionsLink: string
  }
  coverage: {
    limit: number
    deductible: number
    currency: string
    exclusions: string[]
  }
  pricing: {
    premium: number
    serviceFee: number
    tax: number
    total: number
    currency: string
  }
  expiresAt: string
}

function InsuranceQuotesContent() {
  const isTablet = useIsTablet()
  const router = useRouter()
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<StoredOrder | null>(null)
  const [quote, setQuote] = useState<InsuranceQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      const response = await fetch("/api/orders/list", {
        headers: {
          "Authorization": `Bearer ${user.id}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter orders that don't have insurance yet and are in pending_review status only
        const uninsuredOrders = data.orders.filter((order: StoredOrder) => 
          !order.has_insurance && 
          order.status === 'pending_review'
        )
        setOrders(uninsuredOrders)
      }
    } catch (err) {
      console.error("Error fetching orders:", err)
    }
  }

  const getInsuranceQuote = async () => {
    if (!selectedOrder) {
      setError("Please select an order to insure")
      return
    }

    setLoading(true)
    setError("")
    setQuote(null)

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      
      // Prepare quote data from the order with all actual fields
      const quoteData = {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.order_number,
        pickupDate: selectedOrder.pickup_date,
        deliveryDate: selectedOrder.delivery_date,
        originAddress: {
          addressLine1: selectedOrder.origin_address_line1,
          addressLine2: selectedOrder.origin_address_line2,
          city: selectedOrder.origin_city,
          state: selectedOrder.origin_state,
          zipCode: selectedOrder.origin_zip_code,
          country: selectedOrder.origin_country || "US",
        },
        destinationAddress: {
          addressLine1: selectedOrder.destination_address_line1,
          addressLine2: selectedOrder.destination_address_line2,
          city: selectedOrder.destination_city,
          state: selectedOrder.destination_state,
          zipCode: selectedOrder.destination_zip_code,
          country: selectedOrder.destination_country || "US",
        },
        originContact: {
          name: selectedOrder.origin_contact_name,
          phone: selectedOrder.origin_contact_phone,
          email: selectedOrder.origin_contact_email,
        },
        destinationContact: {
          name: selectedOrder.destination_contact_name,
          phone: selectedOrder.destination_contact_phone,
          email: selectedOrder.destination_contact_email,
        },
        packageItems: [
          {
            packageName: "General Cargo",
            declaredValue: selectedOrder.declared_value || selectedOrder.order_amount, // Use declared_value from order_items
            quantity: 1,
          }
        ],
        totalWeight: 1000, // Default weight
        serviceType: selectedOrder.mode || "LTL",
        carrierName: selectedOrder.carrier_name,
      }

      console.log("=== INSURANCE QUOTE REQUEST ===")
      console.log("Order ID:", selectedOrder.id)
      console.log("Order Number:", selectedOrder.order_number)
      console.log("Pickup Date:", selectedOrder.pickup_date)
      console.log("Delivery Date:", selectedOrder.delivery_date)
      console.log("Service Type:", selectedOrder.mode)
      console.log("Order Amount:", selectedOrder.order_amount)
      console.log("Declared Value from Items:", selectedOrder.declared_value)
      console.log("Using Declared Value:", selectedOrder.declared_value || selectedOrder.order_amount)
      console.log("Full Quote Request Data:", JSON.stringify(quoteData, null, 2))

      const response = await fetch("/api/insurance/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.id}`,
        },
        body: JSON.stringify(quoteData),
      })

      const data = await response.json()

      console.log("=== INSURANCE QUOTE RESPONSE ===")
      console.log("Response Status:", response.status)
      console.log("Response Data:", JSON.stringify(data, null, 2))

      if (data.success && data.quote) {
        setQuote(data.quote)
        console.log("Quote successfully set")
      } else {
        setError(data.error || "Failed to get insurance quote")
        console.error("Quote failed:", data.error)
      }
    } catch (err) {
      setError("Error getting insurance quote")
      console.error("Exception in getInsuranceQuote:", err)
    } finally {
      setLoading(false)
    }
  }

  const purchaseInsurance = async () => {
    if (!quote || !selectedOrder) return

    setPurchasing(true)
    setError("")

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}")
      
      console.log("=== PURCHASING INSURANCE ===")
      console.log("User ID:", user.id)
      console.log("Quote Token:", quote.quoteToken)
      console.log("Quote ID:", quote.id)
      console.log("Order ID:", selectedOrder.id)
      
      const purchaseData = {
        quoteToken: quote.quoteToken, // The original JWT token
        dbQuoteToken: quote.dbQuoteToken, // The reference token if exists
        quoteId: quote.id,
        orderId: selectedOrder.id,
        sendEmailsTo: ["USER", "ASSURED"],
      }
      
      console.log("Purchase request data:", JSON.stringify(purchaseData, null, 2))
      
      const response = await fetch("/api/insurance/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.id}`,
        },
        body: JSON.stringify(purchaseData),
      })

      const data = await response.json()
      
      console.log("=== PURCHASE RESPONSE ===")
      console.log("Status:", response.status)
      console.log("Success:", data.success)
      console.log("Error:", data.error)
      console.log("Full response:", JSON.stringify(data, null, 2))

      if (data.success && data.certificate) {
        // Redirect to certificates page
        router.push("/insurance/certificates")
      } else {
        setError(data.error || "Failed to purchase insurance")
        console.error("Purchase failed:", data.error)
      }
    } catch (err) {
      setError("Error purchasing insurance")
      console.error(err)
    } finally {
      setPurchasing(false)
    }
  }

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center px-4 lg:px-6 border-b">
          <SidebarTrigger />
          <div className="flex items-center gap-4 ml-4 flex-1">
            <div className="relative flex-1 max-w-md lg:max-w-xl">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 bg-muted/50"
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </header>

        <main className="p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Insurance Quotes</h1>
            <p className="text-muted-foreground">
              Get insurance coverage for your shipments
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Order to Insure</CardTitle>
                <CardDescription>
                  Choose an order that needs insurance coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orders.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No uninsured orders available
                    </p>
                  ) : (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedOrder?.id === order.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.origin_city}, {order.origin_state} → {order.destination_city}, {order.destination_state}
                            </p>
                            <p className="text-sm mt-1">
                              Pickup: {new Date(order.pickup_date).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="mb-1">
                              <p className="text-xs text-muted-foreground">Declared Value</p>
                              <p className="font-semibold">
                                {formatCurrency(order.declared_value || order.order_amount)}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Order Total: {formatCurrency(order.order_amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedOrder && (
                  <Button
                    className="w-full mt-4"
                    onClick={getInsuranceQuote}
                    disabled={loading}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    {loading ? "Getting Quote..." : "Get Insurance Quote"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quote Details */}
            <Card>
              <CardHeader>
                <CardTitle>Insurance Quote</CardTitle>
                <CardDescription>
                  Review your insurance coverage details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {quote ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">{quote.product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {quote.product.description}
                      </p>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between">
                        <span className="text-sm">Declared Value:</span>
                        <span className="font-medium">
                          {formatCurrency(selectedOrder?.declared_value || selectedOrder?.order_amount || quote.coverage.limit, quote.coverage.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Coverage Limit:</span>
                        <span className="font-medium">
                          {formatCurrency(quote.coverage.limit, quote.coverage.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Deductible:</span>
                        <span className="font-medium">
                          {formatCurrency(quote.coverage.deductible, quote.coverage.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between font-semibold">
                        <span>Premium:</span>
                        <span>{formatCurrency(quote.pricing.premium, quote.pricing.currency)}</span>
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button
                        className="w-full"
                        onClick={purchaseInsurance}
                        disabled={purchasing}
                      >
                        <DollarSign className="mr-2 h-4 w-4" />
                        {purchasing ? "Processing..." : "Purchase Insurance"}
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(quote.product.termsAndConditionsLink, "_blank")}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Terms & Conditions
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Quote expires: {new Date(quote.expiresAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Select an order and get a quote to see details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function InsuranceQuotesPage() {
  return (
    <AuthGuard>
      <InsuranceQuotesContent />
    </AuthGuard>
  )
}