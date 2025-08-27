/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { submitTLQuote } from '@/lib/rapiddeals-tl-api'
import { pricingEngine, type UserPricingData } from '@/lib/pricing-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Get user context from headers (set by middleware)
    const userDataHeader = request.headers.get('x-user-data')
    const userData = userDataHeader ? JSON.parse(userDataHeader) : null
    
    console.log('\n=== TL QUOTE API ROUTE ===')
    console.log('User Type:', user?.user_type);
    console.log('Price Ratio:', user?.price_ratio);
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    // Submit TL quote to RapidDeals API
    const result = await submitTLQuote(body)
    
    console.log('TL Quote submission result:', result)
    
    if (result.success && result.quoteNumber) {
      // Apply pricing based on user type
      let processedRates = result.initialRates || [];
      if (userData && processedRates.length > 0) {
        const userPricing: UserPricingData = {
          id: user.id || '',
          user_type: user.user_type || 'customer',
          price_ratio: user.price_ratio || 0
        };
        console.log('Applying pricing to TL rates:', userPricing.price_ratio);
        
        processedRates = pricingEngine.processBatchQuotes(processedRates, userPricing);
        
        console.log('Processed TL rates with pricing:', processedRates);
      } else {
        console.log('No user data or rates available, returning base pricing');
      }
      
      // TL returns immediate results, so we can return them right away
      // The client can store these in sessionStorage for the results page
      return NextResponse.json({
        success: true,
        orderId: result.quoteNumber,
        initialRates: processedRates,
        message: result.message || 'Quote submitted successfully',
        isTL: true // Flag to indicate this is a TL quote
      })
    } else {
      throw new Error(result.message || 'Failed to submit TL quote')
    }
  } catch (error) {
    console.error('Error in TL quote API route:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit TL quote' 
      },
      { status: 500 }
    )
  }
}