import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeApiRequest } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const orderId = params.id
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Use new authentication system
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userId = user.id

    console.log('Fetching tracking info for order:', orderId)

    // First, get the order from database to get the order_number
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('order_number, rapiddeals_order_id, status, tracking_number')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single()

    if (orderError || !order) {
      console.error('Error fetching order:', orderError)
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Use rapiddeals_order_id or order_number for API call
    const rapiddealsOrderId = order.rapiddeals_order_id || order.order_number

    // Call RapidDeals Tracking API
    const apiUrl = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'
    const apiId = process.env.RAPIDDEALS_API_ID
    const apiKey = process.env.RAPIDDEALS_API_KEY

    if (!apiId || !apiKey) {
      console.error('RapidDeals API credentials not configured')
      return NextResponse.json(
        { success: false, error: 'API configuration error' },
        { status: 500 }
      )
    }

    console.log('Calling RapidDeals tracking API for order:', rapiddealsOrderId)

    const response = await fetch(`${apiUrl}/tracking?orderId=${rapiddealsOrderId}`, {
      method: 'GET',
      headers: {
        'api_Id': apiId,
        'user_key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('RapidDeals API error:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tracking info from carrier' },
        { status: response.status }
      )
    }

    const responseData = await response.json()
    console.log('RapidDeals tracking response:', JSON.stringify(responseData, null, 2))

    // Check if the response is successful
    if (responseData.code === 200 && responseData.success) {
      // Return tracking data
      return NextResponse.json({
        success: true,
        trackingNumber: order.tracking_number,
        trackingInfo: responseData.data?.trackingInfo || [],
        raw: responseData.data
      })
    } else {
      console.error('Tracking API returned error:', responseData)
      return NextResponse.json({
        success: false,
        error: responseData.msg || 'Failed to fetch tracking information',
        trackingNumber: order.tracking_number,
        trackingInfo: []
      })
    }

  } catch (error) {
    console.error('Error in tracking API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}