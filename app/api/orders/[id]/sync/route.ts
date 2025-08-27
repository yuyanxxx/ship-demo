import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { createRefundTransaction } from '@/lib/transaction-utils'
import { pricingEngine } from '@/lib/pricing-engine'

interface StatusHistoryEntry {
  timestamp: string
  status: string
  api_status?: string
  audit_remark?: string
  pickup_number?: string
  delivery_number?: string
  insured_status?: string
  files?: Array<{ url: string; type: string }>
  source: string
  event?: string
  refund_transaction_id?: string
  refund_amount?: number
}

interface OrderUpdateData {
  status: string
  tracking_number: string | null
  pro_number: string | null
  updated_at: string
  status_history?: StatusHistoryEntry[]
}

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

    // Get user from middleware header
    const userDataHeader = request.headers.get('x-user-data')
    
    if (!userDataHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse user data
    let userId = null
    try {
      const userData = JSON.parse(userDataHeader)
      userId = user.id
    } catch (error) {
      console.error('Error parsing user data:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid user data' },
        { status: 400 }
      )
    }

    console.log('Syncing order info from RapidDeals for:', orderId)

    // First, get the order from database to get the order_number
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('order_number, rapiddeals_order_id, status, status_history, order_amount, company_name')
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

    // If order is already cancelled locally, don't override with API status
    if (order.status === 'cancelled') {
      console.log('Order is already cancelled locally, skipping status update from API')
    }

    // Use rapiddeals_order_id or order_number for API call
    const rapiddealsOrderId = order.rapiddeals_order_id || order.order_number

    // Call RapidDeals API
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

    console.log('Calling RapidDeals API for order:', rapiddealsOrderId)

    const response = await fetch(`${apiUrl}/orderInfo?orderId=${rapiddealsOrderId}`, {
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
        { success: false, error: 'Failed to fetch order info from carrier' },
        { status: response.status }
      )
    }

    const responseData = await response.json()
    console.log('RapidDeals API response:', JSON.stringify(responseData, null, 2))

    // Extract the actual data from the response
    const apiData = responseData.data || responseData
    
    // Map API status to our internal status
    const mapApiStatus = (apiStatus: string | undefined | null): string => {
      if (!apiStatus) return 'pending_review'
      
      switch (apiStatus) {
        case 'check pending': return 'pending_review'
        case 'Approval rejection': return 'rejected'
        case 'To be picked': return 'confirmed'
        case 'In-Transit': return 'in_transit'
        case 'Delivered': return 'delivered'
        case 'Cancelled': return 'cancelled'
        case 'Reject': return 'exception'
        default: return apiStatus.toLowerCase().replace(/\s+/g, '_')
      }
    }

    // Check if order was cancelled locally
    const isLocalCancelled = order.status === 'cancelled'
    const apiMappedStatus = mapApiStatus(apiData.orderStatus)
    
    // If order is cancelled locally and API shows pending with audit remark, keep it as cancelled
    const finalStatus = isLocalCancelled && apiMappedStatus === 'pending_review' && apiData.auditRemark
      ? 'cancelled' 
      : apiMappedStatus

    // Update the order in database with fresh data
    // Only update columns that exist in the orders table
    const updateData: OrderUpdateData = {
      status: finalStatus,
      tracking_number: apiData.trackNumber || null,
      pro_number: apiData.proNumber || null,
      updated_at: new Date().toISOString()
    }
    
    // Store additional data in status_history for now
    const statusHistoryEntry = {
      timestamp: new Date().toISOString(),
      status: finalStatus,
      api_status: apiData.orderStatus,
      audit_remark: apiData.auditRemark,
      pickup_number: apiData.pickupNumber,
      delivery_number: apiData.deliveryNumber,
      insured_status: apiData.insuredStatus,
      files: apiData.files || [],
      source: 'api_sync'
    }
    
    // Get current status_history
    const currentHistory = order.status_history || []
    updateData.status_history = [...currentHistory, statusHistoryEntry]

    console.log('Updating order with:', updateData)

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating order:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update order' },
        { status: 500 }
      )
    }

    console.log('Order updated successfully')

    // Check if order needs refund (either status changed OR already refundable but no refund exists)
    const previousStatus = order.status
    const refundableStatuses = ['rejected', 'cancelled']
    const needsRefund = refundableStatuses.includes(finalStatus)
    
    if (needsRefund) {
      console.log(`Order has refundable status (${finalStatus}), checking for existing refund...`)
      
      try {
        // Check if refund already exists for this order
        const { data: existingRefund } = await supabaseAdmin
          .from('balance_transactions')
          .select('id')
          .eq('order_id', orderId)
          .eq('transaction_type', 'refund')
          .single()

        if (!existingRefund) {
          // Get user details for pricing calculation
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, email, user_type, price_ratio')
            .eq('id', userId)
            .single()

          if (!user) {
            console.error('User not found for refund processing')
          } else {
            // Determine refund description based on status
            const refundReason = finalStatus === 'rejected' 
              ? 'Order rejected by carrier' 
              : 'Order cancelled'
            
            // Get supervisor user ID
            const { data: supervisor } = await supabaseAdmin
              .from('users')
              .select('id')
              .eq('user_type', 'admin')
              .limit(1)
              .single()
            
            if (!supervisor) {
              console.error('No supervisor found for dual refund')
              // Fall back to single refund if no supervisor found
              const transactionId = `TXN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
              const { error: refundError } = await supabaseAdmin
                .from('balance_transactions')
                .insert({
                  transaction_id: transactionId,
                  user_id: userId,
                  order_id: orderId,
                  order_account: user.email,
                  company_name: updatedOrder.company_name || 'Unknown',
                  order_number: updatedOrder.order_number,
                  amount: updatedOrder.order_amount || 0,
                  transaction_type: 'refund',
                  description: `${refundReason} - Order ${updatedOrder.order_number}`,
                  reference_id: orderId,
                  user_email: user.email,
                  created_at: new Date().toISOString()
                })
              
              if (refundError) {
                console.error('Error creating single refund:', refundError)
              } else {
                console.log('Single refund transaction created')
              }
            } else {
              // Calculate base amount from customer amount
              const customerAmount = updatedOrder.order_amount || 0
              const priceRatio = user.price_ratio || 0
              const baseAmount = pricingEngine.calculateBasePrice(customerAmount, priceRatio)
              
              console.log('Creating dual refund transactions:')
              console.log('- Customer refund:', customerAmount)
              console.log('- Supervisor refund:', baseAmount)
              console.log('- Price ratio:', priceRatio)
              
              // Create dual refund transactions
              const refundResult = await createRefundTransaction(
                supabaseAdmin,
                orderId,
                userId,
                supervisor.id,
                customerAmount,
                baseAmount,
                `${refundReason} - Order ${updatedOrder.order_number}`
              )
              
              if (refundResult.success) {
                console.log('Dual refund transactions created successfully')
              } else {
                console.error('Error creating dual refund:', refundResult.error)
              }
            }
            
            // Update order status_history with refund information
            const refundHistoryEntry = {
              timestamp: new Date().toISOString(),
              status: finalStatus,
              event: 'refund_processed',
              refund_amount: updatedOrder.order_amount || 0,
              source: 'automatic_refund'
            }
            
            await supabaseAdmin
              .from('orders')
              .update({
                status_history: [...(updatedOrder.status_history || []), refundHistoryEntry],
                updated_at: new Date().toISOString()
              })
              .eq('id', orderId)
            
            // Add refund info to response (if refund was processed)
            const refundInfo = existingRefund ? null : {
              created: true,
              amount: updatedOrder.order_amount || 0,
              description: `Refund processed for ${finalStatus} order`
            }
            
            return NextResponse.json({
              success: true,
              order: updatedOrder,
              refund: refundInfo,
              apiResponse: {
                orderStatus: apiData.orderStatus || null,
                trackNumber: apiData.trackNumber || null,
                proNumber: apiData.proNumber || null,
                auditRemark: apiData.auditRemark || null,
                pickupNumber: apiData.pickupNumber || null,
                deliveryNumber: apiData.deliveryNumber || null,
                insuredStatus: apiData.insuredStatus || null,
                files: apiData.files || []
              }
            })
          }
        } else {
          console.log('Refund already exists for this order')
        }
      } catch (refundError) {
        console.error('Error processing refund:', refundError)
        // Continue even if refund fails
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      apiResponse: {
        orderStatus: apiData.orderStatus || null,
        trackNumber: apiData.trackNumber || null,
        proNumber: apiData.proNumber || null,
        auditRemark: apiData.auditRemark || null,
        pickupNumber: apiData.pickupNumber || null,
        deliveryNumber: apiData.deliveryNumber || null,
        insuredStatus: apiData.insuredStatus || null,
        files: apiData.files || []
      }
    })

  } catch (error) {
    console.error('Error in order sync API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}