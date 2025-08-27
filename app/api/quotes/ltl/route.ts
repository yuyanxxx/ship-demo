/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { submitLTLQuote, formatDateForAPI } from '@/lib/rapiddeals-ltl-api'
import { pricingEngine, type UserPricingData } from '@/lib/pricing-engine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Get user context from headers (set by middleware)
    const userDataHeader = req.headers.get('x-user-data')
    const userData = userDataHeader ? JSON.parse(userDataHeader) : null
    
    // Server-side debug logging
    console.log('\n=== SERVER: LTL Quote API Request Received ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User Type:', user?.user_type);
    console.log('Price Ratio:', user?.price_ratio);
    console.log('Request Body:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    if (!body.originAddress || !body.destinationAddress || !body.pickupDate || !body.packageItems) {
      console.error('SERVER: Missing required fields');
      console.error('Has originAddress:', !!body.originAddress);
      console.error('Has destinationAddress:', !!body.destinationAddress);
      console.error('Has pickupDate:', !!body.pickupDate);
      console.error('Has packageItems:', !!body.packageItems);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Format the pickup date
    const formattedPickupDate = formatDateForAPI(body.pickupDate)
    console.log('SERVER: Formatted pickup date:', body.pickupDate, '->', formattedPickupDate);
    
    // Log the request being sent to RapidDeals
    console.log('\n=== SERVER: Sending to RapidDeals API ===');
    console.log('Formatted Request:', {
      originAddress: body.originAddress,
      destinationAddress: body.destinationAddress,
      pickupDate: formattedPickupDate,
      deliveryAccessorials: body.deliveryAccessorials || [],
      packageItems: body.packageItems
    });
    
    // Submit the quote
    const result = await submitLTLQuote({
      originAddress: body.originAddress,
      destinationAddress: body.destinationAddress,
      pickupDate: formattedPickupDate,
      deliveryAccessorials: body.deliveryAccessorials || [],
      packageItems: body.packageItems
    })
    
    // Log the response from RapidDeals
    console.log('\n=== SERVER: RapidDeals API Response ===');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // LTL returns a quote number, not immediate rates
    // We need to maintain the response structure for the frontend
    console.log('LTL Quote Response Structure:', {
      success: result.success,
      quoteNumber: result.quoteNumber,
      message: result.message
    });
    
    console.log('==========================================\n');
    
    // Return the structured response that frontend expects
    return NextResponse.json({
      success: result.success,
      quoteNumber: result.quoteNumber,
      orderId: result.quoteNumber, // Add orderId for consistency with frontend
      message: result.message
    })
  } catch (error) {
    console.error('\n=== SERVER: Error in LTL quote API route ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('==========================================\n');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit quote' },
      { status: 500 }
    )
  }
}