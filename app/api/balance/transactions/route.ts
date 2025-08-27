import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'
import { createDualTransaction } from '@/lib/transaction-utils'
import { getPriceRatio, getSupervisorUserId } from '@/lib/pricing-utils'

export async function GET(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userId = user.id

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || 'all'
    const dateRange = searchParams.get('range') || '30days'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query - adjust based on user type
    let query = supabaseAdmin
      .from('balance_transactions')
      .select(`
        *,
        users!balance_transactions_user_id_fkey (
          email,
          full_name,
          user_type
        )
      `)
    
    // Filter transactions based on user type
    if (user?.user_type === 'admin') {
      // Admins can see:
      // 1. Their own transactions (user_id = admin_id)
      // 2. All supervisor transactions (is_supervisor_transaction = true) 
      // This shows both their direct transactions and supervisor transactions from customer orders
      const targetUserId = searchParams.get('user_id') || userId
      
      query = query.or(`user_id.eq.${targetUserId},is_supervisor_transaction.eq.true`)
    } else {
      // Customers can only see their own transactions
      query = query.eq('user_id', userId)
      // For customers, exclude supervisor transactions to avoid confusion
      query = query.eq('is_supervisor_transaction', false)
    }
    
    query = query.order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`transaction_id.ilike.%${search}%,order_number.ilike.%${search}%,company_name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply type filter
    if (type !== 'all') {
      query = query.eq('transaction_type', type)
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date()
      const startDate = new Date()
      
      switch (dateRange) {
        case '7days':
          startDate.setDate(now.getDate() - 7)
          break
        case '30days':
          startDate.setDate(now.getDate() - 30)
          break
        case '90days':
          startDate.setDate(now.getDate() - 90)
          break
      }
      
      query = query.gte('created_at', startDate.toISOString())
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: transactions, error } = await query

    if (error) {
      console.error('Error fetching transactions:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transactions' },
        { status: 500 }
      )
    }

    // Map transactions to include user_email from the joined users table
    interface TransactionWithUser extends Record<string, unknown> {
      users?: { email?: string }
      user_email?: string
      metadata?: Record<string, unknown>
    }
    
    const mappedTransactions = await Promise.all(
      (transactions || []).map(async (transaction: TransactionWithUser) => {
        const baseTransaction = {
          ...transaction,
          user_email: transaction.users?.email || transaction.user_email,
          users: undefined // Remove the nested users object
        };

        // For supervisor transactions, get the actual customer info
        if (transaction.is_supervisor_transaction && transaction.metadata?.customer_user_id) {
          const { data: customerInfo } = await supabaseAdmin
            .from('users')
            .select('email, full_name, user_type')
            .eq('id', transaction.metadata.customer_user_id as string)
            .single();

          if (customerInfo) {
            return {
              ...baseTransaction,
              users: {
                email: customerInfo.email,
                full_name: customerInfo.full_name,
                user_type: customerInfo.user_type
              }
            };
          }
        }

        return baseTransaction;
      })
    );

    // Also fetch user's current balance
    const { data: balanceData } = await supabaseAdmin
      .from('user_balances')
      .select('*')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({
      success: true,
      transactions: mappedTransactions,
      balance: balanceData || {
        current_balance: 0,
        available_balance: 0,
        pending_balance: 0,
        credit_limit: 0
      }
    })

  } catch (error) {
    console.error('Error in balance transactions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST endpoint to create a new transaction (for payments, adjustments, etc.)
export async function POST(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userId = user.id

    const body = await request.json()
    const {
      amount,
      transaction_type,
      description,
      payment_method,
      reference_id,
      order_id,
      order_number,
      create_dual_transaction = false // Optional flag for dual transaction creation
    } = body

    // Validate required fields
    if (!amount || !transaction_type) {
      return NextResponse.json(
        { success: false, error: 'Amount and transaction type are required' },
        { status: 400 }
      )
    }

    // Only admins can create dual transactions
    if (create_dual_transaction && user?.user_type !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions for dual transaction creation' },
        { status: 403 }
      )
    }

    // Get user info for company name
    const { data: userInfo } = await supabaseAdmin
      .from('users')
      .select('full_name, email, user_type, price_ratio')
      .eq('id', userId)
      .single()

    // Check if dual transaction is requested and user is customer
    if (create_dual_transaction && userInfo?.user_type === 'customer') {
      // Create dual transaction for customer with markup
      const supervisorUserId = await getSupervisorUserId(supabaseAdmin)
      
      if (!supervisorUserId) {
        return NextResponse.json(
          { success: false, error: 'Supervisor user not found for dual transaction' },
          { status: 500 }
        )
      }

      const priceRatio = getPriceRatio(userInfo)
      const customerAmount = transaction_type === 'debit' ? -Math.abs(amount) : Math.abs(amount)
      const baseAmount = transaction_type === 'debit' 
        ? -Math.abs(amount / (1 + priceRatio / 100))
        : Math.abs(amount / (1 + priceRatio / 100))

      const dualTransactionResult = await createDualTransaction(
        supabaseAdmin,
        userId,
        supervisorUserId,
        {
          orderId: order_id || '',
          orderNumber: order_number || '',
          description: description || `${transaction_type.charAt(0).toUpperCase() + transaction_type.slice(1)} transaction`,
          customerAmount: Math.abs(customerAmount),
          baseAmount: Math.abs(baseAmount),
          transactionType: transaction_type as 'debit' | 'credit' | 'refund'
        }
      )

      if (!dualTransactionResult.success) {
        return NextResponse.json(
          { success: false, error: dualTransactionResult.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Dual transaction created successfully'
      })
    }

    // Standard single transaction creation
    // Generate transaction ID
    const { data: countData } = await supabaseAdmin
      .from('balance_transactions')
      .select('transaction_id', { count: 'exact' })
      .like('transaction_id', `TXN-${new Date().getFullYear()}-%`)

    const sequenceNum = (countData?.length || 0) + 1
    const transactionId = `TXN-${new Date().getFullYear()}-${String(sequenceNum).padStart(6, '0')}`
    
    // Create order account from user ID
    const orderAccount = `ACC-${userId.substring(0, 8).toUpperCase()}`

    // Insert transaction
    const { data: transaction, error } = await supabaseAdmin
      .from('balance_transactions')
      .insert({
        transaction_id: transactionId,
        user_id: userId,
        order_account: orderAccount,
        company_name: userInfo?.full_name || 'Unknown',
        order_number: reference_id || `PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        amount: transaction_type === 'debit' ? -Math.abs(amount) : Math.abs(amount),
        transaction_type,
        description: description || `${transaction_type.charAt(0).toUpperCase() + transaction_type.slice(1)} transaction`,
        payment_method,
        reference_id,
        status: 'completed'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transaction
    })

  } catch (error) {
    console.error('Error in create transaction API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}