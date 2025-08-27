import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, phone } = await request.json()

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
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

    // Password strength validation
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
        { error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Extract domain from email
    const domain = email.split('@')[1]

    // Save user to database
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName,
          phone: phone || null,
          user_type: 'customer',
          domain: domain,
          is_active: true
        }
      ])
      .select('id, email, full_name, phone, user_type, domain, created_at')
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // Create initial balance record for the new user
    const { error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .insert([
        {
          user_id: newUser.id,
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

    // Return success response (without password)
    return NextResponse.json(
      { 
        message: 'Registration successful',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          phone: newUser.phone,
          userType: newUser.user_type,
          domain: newUser.domain,
          createdAt: newUser.created_at
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}