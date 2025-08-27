import { NextRequest, NextResponse } from 'next/server'

// Mock API route for testing when RapidDeals API is unavailable
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('\n=== MOCK: LTL Quote Submission ===')
    console.log('Using mock response for testing')
    console.log('Origin:', body.originAddress?.city, body.originAddress?.state)
    console.log('Destination:', body.destinationAddress?.city, body.destinationAddress?.state)
    
    // Generate a mock order ID starting with FB
    const mockOrderId = `FB${Date.now().toString().slice(-8)}`
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return NextResponse.json({
      success: true,
      quoteNumber: mockOrderId,
      message: 'Quote request received successfully (MOCK)'
    })
  } catch (error) {
    console.error('Error in mock LTL quote API:', error)
    return NextResponse.json(
      { error: 'Mock API error' },
      { status: 500 }
    )
  }
}