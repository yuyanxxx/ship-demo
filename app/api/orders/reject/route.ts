import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, reason } = body
    const userId = request.headers.get('x-user-id')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // For rejection, we might not require user ID if this is an admin action
    // But we still need to verify the order exists
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id, 
        status, 
        order_number, 
        order_amount, 
        user_id, 
        company_name,
        users!orders_user_id_fkey (
          email
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if order can be rejected (only pending_review or similar statuses)
    const rejectableStatuses = ['pending_review', 'pending', 'processing']
    if (!rejectableStatuses.includes(order.status)) {
      return NextResponse.json({ 
        error: `Order cannot be rejected. Current status: ${order.status}` 
      }, { status: 400 })
    }

    // Update order status to rejected
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'rejected',
        order_status: 'Rejected',
        audit_remark: reason || 'Order rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order status:', updateError)
      return NextResponse.json({ 
        error: 'Failed to reject order' 
      }, { status: 500 })
    }

    // Create refund transaction for the rejected order
    try {
      console.log('Creating refund transaction for rejected order...')
      
      // Generate transaction ID
      const { data: countData } = await supabaseAdmin
        .from('balance_transactions')
        .select('transaction_id', { count: 'exact' })
        .like('transaction_id', `TXN-${new Date().getFullYear()}-%`)

      const sequenceNum = (countData?.length || 0) + 1
      const transactionId = `TXN-${new Date().getFullYear()}-${String(sequenceNum).padStart(6, '0')}`
      
      // Create order account from user ID
      const orderAccount = `ACC-${order.user_id.substring(0, 8).toUpperCase()}`
      
      // Insert refund transaction (positive amount for refund)
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('balance_transactions')
        .insert({
          transaction_id: transactionId,
          user_id: order.user_id,
          user_email: (order as unknown as { users?: { email?: string } }).users?.email, // Add user email
          order_id: orderId,
          order_account: orderAccount,
          company_name: order.company_name || 'Unknown',
          order_number: order.order_number,
          amount: Math.abs(order.order_amount || 0), // Positive for refund
          transaction_type: 'refund',
          description: `Order rejection refund - ${order.order_number}`,
          status: 'completed',
          metadata: {
            rejection_reason: reason || 'Order rejected',
            rejected_at: new Date().toISOString(),
            rejected_by: userId || 'system'
          }
        })
        .select()
        .single()
      
      if (transactionError) {
        console.error('Warning: Failed to create refund transaction:', transactionError)
        // Don't fail the rejection, just log the error
      } else {
        console.log('SUCCESS: Refund transaction created:', transaction?.transaction_id)
      }
    } catch (refundError) {
      console.error('Warning: Error creating refund transaction:', refundError)
      // Don't fail the rejection, just log the error
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order rejected successfully',
      orderId: orderId
    })

  } catch (error) {
    console.error('Error rejecting order:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}