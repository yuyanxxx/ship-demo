import { NextRequest, NextResponse } from 'next/server'
import { submitFBAQuote } from '@/lib/rapiddeals-fba-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('\n=== FBA QUOTE API ROUTE ===')
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    // Submit FBA quote to RapidDeals API
    const result = await submitFBAQuote(body)
    
    console.log('FBA Quote submission result:', result)
    
    if (result.success && result.quoteNumber) {
      return NextResponse.json({
        success: true,
        quoteNumber: result.quoteNumber,
        message: result.message || 'FBA quote submitted successfully'
      })
    } else {
      throw new Error(result.message || 'Failed to submit FBA quote')
    }
  } catch (error) {
    console.error('Error in FBA quote API route:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit FBA quote' 
      },
      { status: 500 }
    )
  }
}