import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get user from auth middleware
    const userDataHeader = request.headers.get('x-user-data')
    if (!userDataHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const userData = JSON.parse(userDataHeader)
    const userId = userData.id

    // Get user's addresses
    const { data: addresses, error } = await supabaseAdmin
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch addresses' },
        { status: 500 }
      )
    }

    return NextResponse.json({ addresses }, { status: 200 })

  } catch (error) {
    console.error('Get addresses error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      address_name, 
      contact_name, 
      contact_phone, 
      contact_email,
      address_line1, 
      address_line2, 
      city, 
      state, 
      postal_code, 
      country, 
      user_id, 
      address_type, 
      address_classification 
    } = await request.json()

    // Validate required fields
    if (!address_name || !contact_name || !contact_phone || !contact_email || !address_line1 || !city || !postal_code || !country || !address_type) {
      return NextResponse.json(
        { error: 'Address name, contact information, address line 1, city, postal code, country, and address type are required' },
        { status: 400 }
      )
    }

    // Validate address_type
    const validTypes = ['origin', 'destination', 'both']
    if (!validTypes.includes(address_type)) {
      return NextResponse.json(
        { error: 'Address type must be one of: origin, destination, both' },
        { status: 400 }
      )
    }

    // Validate user_id is provided
    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user exists and is active
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_active')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 401 }
      )
    }

    // Create address
    const { data: newAddress, error: insertError } = await supabaseAdmin
      .from('addresses')
      .insert([
        {
          user_id: user_id,
          address_name,
          contact_name,
          contact_phone,
          contact_email,
          address_line1,
          address_line2: address_line2 || null,
          city,
          state: state || null,
          postal_code,
          country,
          address_type,
          address_classification: address_classification || 'Unknown',
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create address' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Address created successfully',
        address: newAddress
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Create address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}