import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateBasePrice } from '@/lib/pricing-utils'

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

    // Get user from header
    const userId = request.headers.get('x-user-id')
    const userDataHeader = request.headers.get('x-user-data')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let userData = null
    if (userDataHeader) {
      try {
        userData = JSON.parse(userDataHeader)
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }

    console.log('Fetching order details for:', orderId, 'User:', userId, 'User type:', user?.user_type)

    // Build order query based on user type
    let orderQuery = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)

    if (user?.user_type === 'admin') {
      // Admin can view orders from customers in their customer list
      // First get the order without user restriction
      const { data: order, error: orderError } = await orderQuery.single()

    if (orderError || !order) {
      console.error('Error fetching order:', orderError)
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

      // Check if the order's user is in the admin's customer list
      if (order.user_id !== userId) {
        const { data: customerExists, error: customerError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', order.user_id)
          .eq('user_type', 'customer')
          .single()

        if (customerError || !customerExists) {
          return NextResponse.json(
            { success: false, error: 'Order not found or access denied' },
            { status: 403 }
          )
        }
      }
      
      // Admin has access, continue with the order
      let finalOrder = { ...order }
      
      // Calculate correct pricing for admin viewing customer orders
      if (order.user_id !== userId) {
        // This is a customer's order being viewed by admin
        // Get the customer's price_ratio
        const { data: customerData, error: customerError } = await supabaseAdmin
          .from('users')
          .select('price_ratio')
          .eq('id', order.user_id)
          .single();

        let customerPriceRatio = 20; // Default fallback
        if (!customerError && customerData?.price_ratio) {
          customerPriceRatio = customerData.price_ratio;
        }

        // Calculate base prices from customer prices
        finalOrder = {
          ...order,
          // Store original customer amounts
          customer_order_amount: order.order_amount,
          customer_line_charge: order.line_charge,
          customer_fuel_charge: order.fuel_charge,
          customer_accessorial_charge: order.accessorial_charge,
          customer_insurance_amount: order.insurance_amount,
          // Calculate base amounts (what admin should see)
          order_amount: order.order_amount ? calculateBasePrice(order.order_amount, customerPriceRatio) : order.order_amount,
          line_charge: order.line_charge ? calculateBasePrice(order.line_charge, customerPriceRatio) : order.line_charge,
          fuel_charge: order.fuel_charge ? calculateBasePrice(order.fuel_charge, customerPriceRatio) : order.fuel_charge,
          accessorial_charge: order.accessorial_charge ? calculateBasePrice(order.accessorial_charge, customerPriceRatio) : order.accessorial_charge,
          insurance_amount: order.insurance_amount ? calculateBasePrice(order.insurance_amount, customerPriceRatio) : order.insurance_amount,
          // Add metadata for frontend
          is_customer_order: true,
          customer_price_ratio: customerPriceRatio
        }
      }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('item_number', { ascending: true })

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
    }

    console.log('Found order with', orderItems?.length || 0, 'items')

    return NextResponse.json({
      success: true,
        order: finalOrder,
      orderItems: orderItems || []
    })
    } else {
      // Customer can only view their own orders
      orderQuery = orderQuery.eq('user_id', userId)
      
      const { data: order, error: orderError } = await orderQuery.single()

      if (orderError || !order) {
        console.error('Error fetching order:', orderError)
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        )
      }

      // Fetch order items
      const { data: orderItems, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('item_number', { ascending: true })

      if (itemsError) {
        console.error('Error fetching order items:', itemsError)
      }

      console.log('Found order with', orderItems?.length || 0, 'items')

      return NextResponse.json({
        success: true,
        order: order,
        orderItems: orderItems || []
      })
    }

  } catch (error) {
    console.error('Error in order details API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}