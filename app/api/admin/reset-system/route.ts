import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    // Get user from middleware header
    const userDataHeader = request.headers.get('x-user-data')
    
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse user data
    let userData = null
    try {
      userData = JSON.parse(userDataHeader)
    } catch (error) {
      console.error('Error parsing user data:', error)
      return NextResponse.json({ error: 'Invalid user data' }, { status: 400 })
    }

    // CRITICAL: Only allow admin users
    if (userData.user_type !== 'admin') {
      console.error(`Unauthorized reset attempt by user: ${userData.email} (${userData.user_type})`)
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    console.log(`System reset initiated by admin: ${userData.email}`)

    // Start transaction-like operations
    const resetOperations = []

    // 1. Clear all balance transactions
    console.log('Clearing balance transactions...')
    const { error: transactionError } = await supabaseAdmin
      .from('balance_transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (transactionError) {
      console.error('Error clearing transactions:', transactionError)
      resetOperations.push(`Failed to clear transactions: ${transactionError.message}`)
    } else {
      resetOperations.push('✅ Cleared all balance transactions')
    }

    // 2. Clear all orders
    console.log('Clearing orders...')
    const { error: ordersError } = await supabaseAdmin
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (ordersError) {
      console.error('Error clearing orders:', ordersError)
      resetOperations.push(`Failed to clear orders: ${ordersError.message}`)
    } else {
      resetOperations.push('✅ Cleared all orders')
    }

    // 3. Clear all top-up requests
    console.log('Clearing top-up requests...')
    const { error: topUpError } = await supabaseAdmin
      .from('top_up_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (topUpError) {
      console.error('Error clearing top-up requests:', topUpError)
      resetOperations.push(`Failed to clear top-up requests: ${topUpError.message}`)
    } else {
      resetOperations.push('✅ Cleared all top-up requests')
    }

    // 4. Reset user balances (directly update user_balances table)
    console.log('Resetting user balances...')
    
    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, user_type, email')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      resetOperations.push(`Failed to fetch users: ${usersError.message}`)
    } else {
      // Reset balances for each user
      for (const user of users) {
        const defaultBalance = user.user_type === 'admin' ? 2000 : 1000
        
        // First try to update existing balance record
        const { error: updateError } = await supabaseAdmin
          .from('user_balances')
          .update({ 
            current_balance: defaultBalance,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', user.id)

        // If update failed (no existing record), insert new one
        if (updateError) {
          const { error: insertError } = await supabaseAdmin
            .from('user_balances')
            .insert({
              user_id: user.id,
              current_balance: defaultBalance,
              last_updated: new Date().toISOString()
            })

          if (insertError) {
            console.error(`Error setting balance for ${user.email}:`, insertError)
            resetOperations.push(`❌ Failed to reset balance for ${user.email}`)
          } else {
            resetOperations.push(`✅ Set balance for ${user.email}: $${defaultBalance}`)
          }
        } else {
          resetOperations.push(`✅ Reset balance for ${user.email}: $${defaultBalance}`)
        }
      }
    }

    // 5. Clear insurance certificates
    console.log('Clearing insurance certificates...')
    const { error: insuranceError } = await supabaseAdmin
      .from('insurance_certificates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (insuranceError) {
      console.error('Error clearing insurance certificates:', insuranceError)
      resetOperations.push(`Failed to clear insurance certificates: ${insuranceError.message}`)
    } else {
      resetOperations.push('✅ Cleared all insurance certificates')
    }

    console.log('System reset completed successfully')
    console.log('Reset operations:', resetOperations)

    return NextResponse.json({ 
      success: true, 
      message: 'System reset completed successfully',
      operations: resetOperations,
      resetBy: userData.email,
      resetAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error during system reset:', error)
    return NextResponse.json({ 
      error: 'Internal server error during reset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}