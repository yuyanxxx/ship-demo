import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { authorizeApiRequest } from '@/lib/auth-utils'

// GET - List all customers (admin only)
export async function GET(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    // Get optional filters from query params
    const searchParams = request.nextUrl.searchParams
    const isActive = searchParams.get('is_active')
    
    // Build query with role information
    let query = supabaseAdmin
      .from('users')
      .select(`
        id, 
        email, 
        full_name, 
        phone, 
        company_name, 
        bonus_credit, 
        price_ratio,
        is_active, 
        created_at, 
        updated_at,
        user_roles!user_roles_user_id_fkey (
          role_id,
          roles (
            id,
            name
          )
        )
      `)
      .eq('user_type', 'customer')
      .order('created_at', { ascending: false })

    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: customers, error } = await query

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch customers' },
        { status: 500 }
      )
    }

    // Transform the data to include role_id at the top level
    const transformedCustomers = customers?.map(customer => ({
      ...customer,
      role_id: customer.user_roles?.[0]?.role_id || null,
      user_roles: undefined // Remove the nested structure
    }))

    return NextResponse.json({ customers: transformedCustomers }, { status: 200 })

  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new customer (admin only)
export async function POST(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!

    const { 
      email, 
      password, 
      fullName, 
      phone,
      companyName,
      bonusCredit,
      priceRatio,
      isActive,
      roleId 
    } = await request.json()

    // Validate required fields
    if (!email || !password || !fullName || !companyName) {
      return NextResponse.json(
        { error: 'Email, password, contact name, and company name are required' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create customer
    const { data: newCustomer, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName,
          phone: phone || null,
          company_name: companyName,
          bonus_credit: bonusCredit || 0,
          price_ratio: priceRatio || 1.0,
          user_type: 'customer',
          is_active: isActive !== false,
          created_by: user.id
        }
      ])
      .select('id, email, full_name, phone, company_name, bonus_credit, price_ratio, is_active, created_at')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      )
    }

    // Create initial balance record for the customer
    // First, ensure user_balances record exists
    const { error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .insert([
        {
          user_id: newCustomer.id,
          current_balance: 0,
          available_balance: 0,
          pending_balance: 0,
          currency: 'USD'
        }
      ])
      .single()

    if (balanceError && balanceError.code !== '23505') { // 23505 is unique violation (record already exists)
      console.error('Failed to create user balance record:', balanceError)
      // Don't fail the entire operation, just log the error
    }

    // If bonus credit is provided, create an initial balance transaction
    if (bonusCredit && bonusCredit > 0) {
      await supabaseAdmin
        .from('balance_transactions')
        .insert([
          {
            user_id: newCustomer.id,
            amount: bonusCredit,
            transaction_type: 'credit',
            description: 'Initial bonus credit',
            status: 'completed',
            metadata: {
              source: 'admin_creation',
              created_by: user.id
            }
          }
        ])
    }

    // If role is provided, assign it to the user
    if (roleId) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert([
          {
            user_id: newCustomer.id,
            role_id: roleId,
            assigned_by: user.id
          }
        ])

      if (roleError) {
        console.error('Role assignment error:', roleError)
        // Don't fail the entire operation, just log the error
      }
    }

    return NextResponse.json(
      { 
        message: 'Customer created successfully',
        customer: newCustomer
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}