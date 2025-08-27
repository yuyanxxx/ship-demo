import { NextRequest, NextResponse } from 'next/server'

/**
 * Example API route showing how to use RapidDeals API integration
 * This demonstrates server-side usage where environment variables are accessible
 */
export async function GET() {
  try {
    // Check if API credentials are configured
    if (!process.env.RAPIDDEALS_API_ID) {
      return NextResponse.json(
        { error: 'RapidDeals API ID not configured. Please set RAPIDDEALS_API_ID in .env.local' },
        { status: 500 }
      )
    }

    if (!process.env.RAPIDDEALS_API_KEY) {
      return NextResponse.json(
        { error: 'RapidDeals API key not configured. Please set RAPIDDEALS_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    if (!process.env.RAPIDDEALS_API_URL) {
      return NextResponse.json(
        { error: 'RapidDeals API URL not configured. Please set RAPIDDEALS_API_URL in .env.local' },
        { status: 500 }
      )
    }

    // Example: Get API status or health check
    // In a real implementation, replace with actual RapidDeals API endpoint
    const response = {
      status: 'connected',
      apiUrl: process.env.RAPIDDEALS_API_URL,
      apiIdConfigured: !!process.env.RAPIDDEALS_API_ID,
      apiKeyConfigured: !!process.env.RAPIDDEALS_API_KEY,
      timestamp: new Date().toISOString(),
      message: 'RapidDeals API is properly configured and ready to use'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('RapidDeals API error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to RapidDeals API' },
      { status: 500 }
    )
  }
}

/**
 * Example POST endpoint for creating a quote
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.originAddress || !body.destinationAddress) {
      return NextResponse.json(
        { error: 'Origin and destination addresses are required' },
        { status: 400 }
      )
    }

    // Example: Create a quote using RapidDeals API
    // This would call the actual RapidDeals quote endpoint
    const quoteData = {
      originAddress: body.originAddress,
      destinationAddress: body.destinationAddress,
      weight: body.weight || 0,
      serviceType: body.serviceType || 'LTL',
      pickupDate: body.pickupDate,
      // API credentials are handled by the rapidDealsAPI function
      // No need to include them in the request body
    }

    // In production, this would call the actual RapidDeals API
    // const quote = await rapidDealsAPI('/quotes', {
    //   method: 'POST',
    //   body: JSON.stringify(quoteData)
    // })

    // For now, return a mock response
    const mockQuote = {
      quoteId: `QUOTE-${Date.now()}`,
      ...quoteData,
      estimatedCost: Math.floor(Math.random() * 1000) + 100,
      estimatedTransitDays: Math.floor(Math.random() * 7) + 1,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json(mockQuote)
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    )
  }
}