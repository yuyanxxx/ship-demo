import { NextRequest, NextResponse } from 'next/server'
import { fetchQuoteResults, pollQuoteResults } from '@/lib/rapiddeals-quote-results-api'
import { pricingEngine, type UserPricingData } from '@/lib/pricing-engine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { quoteOrderId, poll = false } = body
    
    if (!quoteOrderId) {
      return NextResponse.json(
        { error: 'Quote order ID is required' },
        { status: 400 }
      )
    }

    // Get user context from headers (set by middleware)
    const userDataHeader = req.headers.get('x-user-data')
    const userData = userDataHeader ? JSON.parse(userDataHeader) : null

    console.log('\n=== SERVER: Quote Results API Request ===')
    console.log('Quote Order ID:', quoteOrderId)
    console.log('Polling Mode:', poll)
    console.log('User Type:', userData?.user_type)
    console.log('Price Ratio:', userData?.price_ratio)
    
    if (poll) {
      // Use polling mode to fetch results multiple times
      const rates = await pollQuoteResults(quoteOrderId, 3, 4000)
      
      // Apply price ratio to rates if user data is available
      let processedRates = rates
      if (userData && rates.length > 0) {
        const userPricing: UserPricingData = {
          id: userData.id || '',
          user_type: userData.user_type || 'customer',
          price_ratio: userData.price_ratio || 0
        }
        console.log('Applying pricing to rates:', userPricing.price_ratio)
        processedRates = pricingEngine.processBatchQuotes(rates as unknown as Record<string, unknown>[], userPricing) as unknown as typeof rates
      }
      
      return NextResponse.json({
        success: true,
        data: {
          orderId: quoteOrderId,
          rates: processedRates
        }
      })
    } else {
      // Single fetch
      const result = await fetchQuoteResults(quoteOrderId)
      
      // Apply price ratio to rates if user data is available
      if (userData && result.success && result.data?.rates) {
        const userPricing: UserPricingData = {
          id: userData.id || '',
          user_type: userData.user_type || 'customer',
          price_ratio: userData.price_ratio || 0
        }
        console.log('Applying pricing to rates:', userPricing.price_ratio)
        result.data.rates = pricingEngine.processBatchQuotes(result.data.rates as unknown as Record<string, unknown>[], userPricing) as unknown as typeof result.data.rates
      }
      
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Error in quote results API route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote results' },
      { status: 500 }
    )
  }
}