import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from "@/lib/supabase"
import { createRefundTransaction as createDualRefund } from '@/lib/transaction-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body
    
    // Get user from middleware header
    const userDataHeader = request.headers.get('x-user-data')
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse user data
    let userId = null
    let userData = null
    try {
      userData = JSON.parse(userDataHeader)
      userId = user.id
    } catch (error) {
      console.error('Error parsing user data:', error)
      return NextResponse.json({ error: 'Invalid user data' }, { status: 400 })
    }

    // First verify the order belongs to the user and is in pending_review status
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id, 
        status, 
        order_number, 
        order_amount, 
        user_id, 
        company_name
      `)
      .eq('id', orderId)
      .eq('user_id', userId)
      .single()

    // Get user email separately if order is found
    let userEmail = ''
    if (order && !orderError) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      userEmail = user?.email || ''
    }

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'pending_review') {
      return NextResponse.json({ 
        error: 'Only orders with pending review status can be cancelled' 
      }, { status: 400 })
    }

    // Call RapidDeals API to cancel the order
    const formData = new URLSearchParams()
    formData.append('orderId', order.order_number)

    const response = await fetch('https://ship.rapiddeals.com/api/shipment/cancelOrder', {
      method: 'POST',
      headers: {
        'api_id': process.env.RAPIDDEALS_API_ID || '',
        'user_key': process.env.RAPIDDEALS_API_KEY || '',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    const result = await response.json()
    
    console.log('RapidDeals cancel response:', JSON.stringify(result, null, 2))

    // Check for success - RapidDeals might return success in different ways
    // Also check if msg is 'success' which might indicate success even without success flag
    const isSuccess = (result.code === '200' || result.code === 200) || 
                     result.success === true || 
                     result.success === 'true' || 
                     (result.msg && result.msg.toLowerCase() === 'success')
    
    if (isSuccess) {
      // Update order status in database to 'cancelled'
      // Also store the audit remark if provided by the API
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'cancelled',
          order_status: 'Cancelled', // Store the actual API status
          audit_remark: result.data?.auditRemark || 'Customer cancelled',
          updated_at: new Date().toISOString(),
          last_api_sync: new Date().toISOString()
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order status:', updateError)
        return NextResponse.json({ 
          error: 'Order cancelled but failed to update local status' 
        }, { status: 500 })
      }

      // Create dual refund transactions for the cancelled order
      try {
        console.log('Creating dual refund transactions for cancelled order...')
        
        // Get the original customer transaction
        const { data: originalTransaction } = await supabaseAdmin
          .from('balance_transactions')
          .select('*')
          .eq('order_id', orderId)
          .eq('user_id', userId)
          .eq('transaction_type', 'debit')
          .eq('is_supervisor_transaction', false)
          .single()

        console.log('Original customer transaction found:', !!originalTransaction)
        
        if (originalTransaction) {
          // Get the linked supervisor transaction
          const { data: supervisorTransaction } = await supabaseAdmin
            .from('balance_transactions')
            .select('*')
            .eq('order_id', orderId)
            .eq('transaction_type', 'debit')
            .eq('is_supervisor_transaction', true)
            .single()
            
          console.log('Supervisor transaction found:', !!supervisorTransaction)
          
          if (supervisorTransaction) {
            // Create dual refund transactions
            const dualRefundResult = await createDualRefund(
              supabaseAdmin,
              order.id,
              userId,
              supervisorTransaction.user_id, // Use the supervisor from the original transaction
              Math.abs(originalTransaction.amount), // Customer refund amount
              Math.abs(supervisorTransaction.amount), // Supervisor refund amount (base cost)
              `Order cancellation refund - ${order.order_number}`
            )

            if (!dualRefundResult.success) {
              console.error('Warning: Failed to create dual refund transactions:', dualRefundResult.error)
              // Don't fail the cancellation, just log the error
            } else {
              console.log('SUCCESS: Dual refund transactions created')
            }
          } else {
            console.error('Warning: Supervisor transaction not found, skipping refund')
          }
        } else {
          console.error('Warning: Original customer transaction not found, skipping refund')
        }
      } catch (refundError) {
        console.error('Warning: Error creating refund transactions:', refundError)
        // Don't fail the cancellation, just log the error
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Order cancelled successfully',
        data: result.data 
      })
    } else {
      // If RapidDeals returns any other response, treat it as an error
      console.error('RapidDeals cancellation failed:', result)
      
      // Never return 'success' as an error message
      const errorMessage = result.msg || 'Failed to cancel order'
      if (errorMessage.toLowerCase() === 'success') {
        // If somehow we get 'success' as a message but not recognized as success,
        // still treat it as success to avoid confusion
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ 
            status: 'cancelled',
            order_status: 'Cancelled',
            audit_remark: 'Customer cancelled',
            updated_at: new Date().toISOString(),
            last_api_sync: new Date().toISOString()
          })
          .eq('id', orderId)

        if (updateError) {
          console.error('Error updating order status:', updateError)
          return NextResponse.json({ 
            error: 'Order cancelled but failed to update local status' 
          }, { status: 500 })
        }

        // Create dual refund transactions for this edge case as well
        try {
          console.log('Creating dual refund transactions for cancelled order (edge case)...')
          
          // Get the original customer transaction  
          const { data: originalTransaction } = await supabaseAdmin
            .from('balance_transactions')
            .select('*')
            .eq('order_id', orderId)
            .eq('user_id', userId)
            .eq('transaction_type', 'debit')
            .eq('is_supervisor_transaction', false)
            .single()

          console.log('Original customer transaction found (edge case):', !!originalTransaction)
          
          if (originalTransaction) {
            // Get the linked supervisor transaction
            const { data: supervisorTransaction } = await supabaseAdmin
              .from('balance_transactions')
              .select('*')
              .eq('order_id', orderId)
              .eq('transaction_type', 'debit')
              .eq('is_supervisor_transaction', true)
              .single()
              
            console.log('Supervisor transaction found (edge case):', !!supervisorTransaction)
            
            if (supervisorTransaction) {
              // Create dual refund transactions
              const dualRefundResult = await createDualRefund(
                supabaseAdmin,
                order.id,
                userId,
                supervisorTransaction.user_id, // Use the supervisor from the original transaction
                Math.abs(originalTransaction.amount), // Customer refund amount
                Math.abs(supervisorTransaction.amount), // Supervisor refund amount (base cost)
                `Order cancellation refund - ${order.order_number}`
              )

              if (!dualRefundResult.success) {
                console.error('Warning: Failed to create dual refund transactions:', dualRefundResult.error)
              } else {
                console.log('SUCCESS: Dual refund transactions created')
              }
            } else {
              console.error('Warning: Supervisor transaction not found, skipping refund (edge case)')
            }
          } else {
            console.error('Warning: Original customer transaction not found, skipping refund (edge case)')
          }
        } catch (refundError) {
          console.error('Warning: Error creating refund transactions:', refundError)
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Order cancelled successfully',
          data: result 
        })
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: result 
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}