/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Truck, 
  Package,
  Loader2,
  AlertCircle,
  FileText,
  ClipboardCheck,
  CheckCircle
} from "lucide-react"
import { CommonHeader } from "@/components/common-header"
import { useIsTablet } from "@/hooks/use-tablet"
import type { QuoteRate } from "@/lib/rapiddeals-quote-results-api"
import { StepsIndicator } from "@/components/steps-indicator"

function QuoteResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  
  const [quotes, setQuotes] = useState<QuoteRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)
  // const [pollingAttempt, setPollingAttempt] = useState(0)
  
  // Determine current step
  const getCurrentStep = () => {
    return 2 // Select Truck Carrier
  }

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided')
      setLoading(false)
      return
    }


    // Check if we have initial rates from TL submission stored in sessionStorage
    const storedTLRates = sessionStorage.getItem(`tl_rates_${orderId}`)
    if (storedTLRates) {
      try {
        const rates = JSON.parse(storedTLRates)
        setQuotes(rates.sort((a: QuoteRate, b: QuoteRate) => 
          parseFloat(a.totalCharge) - parseFloat(b.totalCharge)
        ))
        setLoading(false)
        // Clear the stored rates after using them
        sessionStorage.removeItem(`tl_rates_${orderId}`)
        return
      } catch (e) {
        console.error('Error parsing stored TL rates:', e)
      }
    }

    fetchQuoteResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const fetchQuoteResults = async () => {
    if (!orderId) return

    setLoading(true)
    setError(null)
    
    // Get user ID for authorization
    const storedUser = localStorage.getItem('user')
    let userId = ''
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        userId = user.id
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
    
    const maxAttempts = 3 // Reduced to 3 attempts
    const intervalMs = 500 // 0.5 seconds interval
    let attempts = 0
    const allRates: QuoteRate[] = []
    const rateIds = new Set<string>()

    const pollForResults = async () => {
      while (attempts < maxAttempts) {
        attempts++
        // setPollingAttempt(attempts)
        
        try {
          // Use real API endpoint
          const response = await fetch('/api/quotes/results', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userId}`
            },
            body: JSON.stringify({
              quoteOrderId: orderId,
              poll: false // Single fetch per attempt
            })
          })

          if (!response.ok) {
            throw new Error('Failed to fetch quote results')
          }

          const data = await response.json()
          
          if (data.success && data.data?.rates) {
            // Add new rates that we haven't seen before
            for (const rate of data.data.rates) {
              if (!rateIds.has(rate.rateId)) {
                rateIds.add(rate.rateId)
                allRates.push(rate)
              }
            }
            
            // Update quotes in real-time
            setQuotes([...allRates].sort((a, b) => 
              parseFloat(a.totalCharge) - parseFloat(b.totalCharge)
            ))
          }
          
          // Wait before next attempt (except for the last one)
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs))
          }
        } catch (error) {
          console.error(`Error on attempt ${attempts}:`, error)
        }
      }
    }

    await pollForResults()
    setLoading(false)
    // setPollingAttempt(0)
  }

  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuote(quoteId)
    console.log('Selected quote:', quoteId)
  }

  const handleNext = () => {
    console.log('handleNext called')
    console.log('selectedQuote:', selectedQuote)
    console.log('orderId:', orderId)
    console.log('quotes:', quotes)
    
    if (!selectedQuote || !orderId) {
      console.error('Missing selectedQuote or orderId')
      return
    }
    
    // Find the selected quote data
    const selectedQuoteData = quotes.find(q => q.rateId === selectedQuote)
    console.log('selectedQuoteData:', selectedQuoteData)
    
    if (!selectedQuoteData) {
      console.error('Selected quote not found in quotes array')
      return
    }
    
    // Store the selected quote in sessionStorage
    sessionStorage.setItem(`selected_quote_${orderId}`, JSON.stringify(selectedQuoteData))
    console.log('Data stored in sessionStorage')
    
    // Navigate to the confirmation page
    const url = `/quotes/confirm?orderId=${orderId}&rateId=${selectedQuote}`
    console.log('Navigating to:', url)
    router.push(url)
  }


  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    
    // Prices already have price ratio applied from the backend API
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Fixed Header Section */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="px-4 md:px-12 pt-4 pb-4 w-full xl:w-[85%] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Quote Results</h1>
              <p className="text-sm text-muted-foreground">Order ID: {orderId}</p>
            </div>
            <div className="flex items-center gap-2">
              {!loading && quotes.length > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => router.push('/quotes')}
                >
                  Requote
                </Button>
              )}
              {loading ? (
                <Button disabled className="gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching quotes
                </Button>
              ) : quotes.length > 0 ? (
                <Button 
                  disabled={!selectedQuote}
                  onClick={handleNext}
                >
                  Next
                </Button>
              ) : null}
            </div>
          </div>
          
          {/* Steps Indicator */}
          <StepsIndicator
            steps={[
              { id: 1, name: "Quote", description: "Enter shipment details", icon: FileText },
              { id: 2, name: "Select Truck Carrier", description: "Choose your carrier", icon: Truck },
              { id: 3, name: "Confirm Order", description: "Review and confirm", icon: ClipboardCheck },
              { id: 4, name: "Complete", description: "Order placed", icon: CheckCircle }
            ]}
            currentStep={getCurrentStep()}
            className="mt-4"
          />
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-12 py-6 w-full xl:w-[85%] mx-auto space-y-4">
          {/* Error State */}
          {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && quotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-lg font-medium">Fetching quotes from carriers...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a few seconds as we gather the best rates for you
            </p>
          </div>
        </div>
      )}


      {/* Quote Cards */}
      <div className="grid gap-4">
        {quotes.map((quote, index) => (
          <Card 
            key={quote.rateId} 
            className={`cursor-pointer transition-all ${
              selectedQuote === quote.rateId 
                ? 'border-2 border-green-500' 
                : 'border hover:border-gray-300'
            } ${index === 0 ? 'relative overflow-hidden' : ''}`}
            onClick={() => handleSelectQuote(quote.rateId)}
          >
            {index === 0 && (
              <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                BEST RATE
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex w-12 h-12 bg-blue-100 rounded-lg items-center justify-center">
                    <Truck className="h-6 w-6 text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{quote.carrierName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      SCAC: {quote.carrierSCAC}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(quote.totalCharge)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total charge</p>
                </div>
              </div>
            </CardHeader>
            
            <div className="border-t border-dashed border-gray-300"></div>
            
            <CardContent className="space-y-4">
              {/* Main Charges Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    <span className="text-xs">Base Rate</span>
                  </div>
                  <p className="font-semibold">{formatCurrency(quote.lineCharge)}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    <span className="text-xs">Fuel Charge</span>
                  </div>
                  <p className="font-semibold">{formatCurrency(quote.fuelCharge)}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    <span className="text-xs">Accessorials</span>
                  </div>
                  <p className="font-semibold">{formatCurrency(quote.accessorialCharge)}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    <span className="text-xs">Transit Time</span>
                  </div>
                  <p className="font-semibold">{quote.carrierTransitDays} day{quote.carrierTransitDays > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Additional Info */}
              {quote.customerDump === 1 && (
                <div className="pt-3 border-t">
                  <div className="text-sm text-orange-600 font-medium">
                    Self-unload required
                  </div>
                </div>
              )}

              {/* Accessorial Services - Only show services with charges > 0 */}
              {quote.accesoriesList && quote.accesoriesList.filter(s => 
                s.chargeAmount && parseFloat(s.chargeAmount) > 0
              ).length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Additional Services:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {quote.accesoriesList
                      .filter(service => service.chargeAmount && parseFloat(service.chargeAmount) > 0)
                      .map((service, idx) => (
                        <div key={idx} className="text-xs bg-gray-50 rounded px-2 py-1 flex items-center">
                          <span className="font-medium whitespace-nowrap">{service.serviceName}</span>
                          <span className="flex-1 mx-2 border-b border-dotted border-gray-400"></span>
                          <span className="font-bold text-black whitespace-nowrap">
                            {formatCurrency(service.chargeAmount)}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results State */}
      {!loading && quotes.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-1">No quotes available yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Carriers are still processing your request. Please check back in a few moments or try refreshing.
            </p>
            <Button onClick={() => fetchQuoteResults()} className="mt-4">
              Refresh Quotes
            </Button>
          </CardContent>
        </Card>
      )}
        </div>
      </div>

    </div>
  )
}

export default function QuoteResultsPage() {
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
              <QuoteResultsContent />
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}