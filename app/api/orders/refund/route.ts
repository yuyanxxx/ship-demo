import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { createRefundTransaction as createDualRefund } from '@/lib/transaction-utils'
import { getPriceRatio, calculateBasePrice } from '@/lib/pricing-engine'

export async function POST(request: NextRequest) {
  try {
    // Get user from header
    const userId = request.headers.get('x-user-id')
    const userDataHeader = request.headers.get('x-user-data')
    const userData = userDataHeader ? JSON.parse(userDataHeader) : null
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orderId, reason = 'Order rejected by carrier' } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    console.log('Processing refund for order:', orderId)

    // Get the order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
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

    // Check if order is eligible for refund
    const eligibleStatuses = ['rejected', 'cancelled', 'exception']
    if (!eligibleStatuses.includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `Order status '${order.status}' is not eligible for refund` },
        { status: 400 }
      )
    }

    // Check if refund already exists (check for customer transaction with this order_id)
    const { data: existingRefund } = await supabaseAdmin
      .from('balance_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('transaction_type', 'refund')
      .eq('user_id', userId)
      .single()

    if (existingRefund) {
      console.log('Refund already exists for order:', existingRefund.transaction_id)
      return NextResponse.json({
        success: true,
        message: 'Refund already processed',
        refund: existingRefund
      })
    }

    // Get the original order transaction to find the linked dual transactions
    const { data: originalTransaction } = await supabaseAdmin
      .from('balance_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .eq('transaction_type', 'debit')
      .single()

    if (!originalTransaction) {
      console.error('Original order transaction not found for order:', orderId)
      return NextResponse.json(
        { success: false, error: 'Original transaction not found' },
        { status: 404 }
      )
    }

    console.log('Found original transaction:', originalTransaction.transaction_id)

    // Get supervisor ID
    const { data: supervisor } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('user_type', 'admin')
      .limit(1)
      .single()
    
    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: 'System configuration error' },
        { status: 500 }
      )
    }
    
    // Calculate base amount from the original transaction
    const baseAmount = originalTransaction.base_amount || originalTransaction.amount
    
    // Create dual refund transactions
    const dualRefundResult = await createDualRefund(
      supabaseAdmin,
      orderId,
      userId,
      supervisor.id,
      Math.abs(order.order_amount || 0),
      Math.abs(baseAmount),
      `${reason} - Order ${order.order_number}`
    )

    if (!dualRefundResult.success) {
      console.error('Error creating dual refund transactions:', dualRefundResult.error)
      return NextResponse.json(
        { success: false, error: dualRefundResult.error || 'Failed to create refund transactions' },
        { status: 500 }
      )
    }

    console.log('Dual refund transactions created successfully')

    // Update order status if needed
    if (order.status === 'rejected') {
      await supabaseAdmin
        .from('orders')
        .update({
          refund_status: 'refunded',
          refund_date: new Date().toISOString(),
          refund_amount: order.order_amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    }

    return NextResponse.json({
      success: true,
      message: 'Refund processed successfully'
    })

  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}