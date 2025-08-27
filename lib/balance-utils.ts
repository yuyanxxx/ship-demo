import { supabaseAdmin } from '@/lib/supabase'

/**
 * Creates a refund transaction for an order
 * @param orderId - The order ID
 * @param order - The order data (if already fetched)
 * @param reason - The reason for refund
 * @returns The created transaction or null if failed
 */
export async function createRefundTransaction(
  orderId: string,
  order?: {
    order_number: string
    order_amount: number
    user_id: string
    company_name: string
  },
  reason: string = 'Order cancelled'
) {
  try {
    // If order data not provided, fetch it
    let orderData = order
    if (!orderData) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('order_number, order_amount, user_id, company_name')
        .eq('id', orderId)
        .single()
      
      if (error || !data) {
        console.error('Failed to fetch order for refund:', error)
        return null
      }
      orderData = data
    }

    // Check if refund already exists for this order
    const { data: existingRefund } = await supabaseAdmin
      .from('balance_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('transaction_type', 'refund')
      .single()
    
    if (existingRefund) {
      console.log('Refund transaction already exists for order:', orderId)
      return existingRefund
    }

    // Generate transaction ID
    const { data: countData } = await supabaseAdmin
      .from('balance_transactions')
      .select('transaction_id', { count: 'exact' })
      .like('transaction_id', `TXN-${new Date().getFullYear()}-%`)

    const sequenceNum = (countData?.length || 0) + 1
    const transactionId = `TXN-${new Date().getFullYear()}-${String(sequenceNum).padStart(6, '0')}`
    
    // Create order account from user ID
    const orderAccount = `ACC-${orderData.user_id.substring(0, 8).toUpperCase()}`
    
    // Insert refund transaction (positive amount for refund)
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('balance_transactions')
      .insert({
        transaction_id: transactionId,
        user_id: orderData.user_id,
        order_id: orderId,
        order_account: orderAccount,
        company_name: orderData.company_name || 'Unknown',
        order_number: orderData.order_number,
        amount: Math.abs(orderData.order_amount || 0), // Positive for refund
        transaction_type: 'refund',
        description: `${reason} - ${orderData.order_number}`,
        status: 'completed',
        metadata: {
          refund_reason: reason,
          refunded_at: new Date().toISOString()
        }
      })
      .select()
      .single()
    
    if (transactionError) {
      console.error('Failed to create refund transaction:', transactionError)
      return null
    }

    console.log('Refund transaction created successfully:', transaction.transaction_id)
    return transaction
  } catch (error) {
    console.error('Error creating refund transaction:', error)
    return null
  }
}

/**
 * Handles balance transaction when order status changes
 * @param orderId - The order ID
 * @param oldStatus - The previous order status
 * @param newStatus - The new order status
 * @param orderData - Optional order data if already available
 */
export async function handleOrderStatusChange(
  orderId: string,
  oldStatus: string,
  newStatus: string,
  orderData?: {
    order_number: string
    order_amount: number
    user_id: string
    company_name: string
  }
) {
  // Define statuses that trigger refund
  const refundStatuses = ['cancelled', 'rejected', 'failed', 'refunded']
  
  // Check if we need to create a refund
  if (!refundStatuses.includes(oldStatus) && refundStatuses.includes(newStatus)) {
    // Status changed to a refundable status
    const refundReason = {
      'cancelled': 'Order cancelled',
      'rejected': 'Order rejected',
      'failed': 'Order failed',
      'refunded': 'Order refunded'
    }[newStatus] || 'Order refunded'
    
    await createRefundTransaction(orderId, orderData, refundReason)
  }
}