import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const userId = userData.id

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
      address_type, 
      address_classification 
    } = await request.json()
    const { id: addressId } = await params

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

    // Check if address exists and belongs to the user (or admin can access any address)
    let addressQuery = supabaseAdmin
      .from('addresses')
      .select('id, user_id')
      .eq('id', addressId)

    // If not admin, restrict to user's own addresses
    if (userData.user_type !== 'admin') {
      addressQuery = addressQuery.eq('user_id', userId)
    }

    const { data: existingAddress, error: fetchError } = await addressQuery.single()

    if (fetchError || !existingAddress) {
      return NextResponse.json(
        { error: 'Address not found or access denied' },
        { status: 404 }
      )
    }

    // Update address
    const { data: updatedAddress, error: updateError } = await supabaseAdmin
      .from('addresses')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', addressId)
      .eq('user_id', existingAddress.user_id) // Use the existing address user_id
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update address' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Address updated successfully',
        address: updatedAddress
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Update address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const userId = userData.id
    const { id: addressId } = await params

    // Check if address exists and belongs to the user (or admin can access any address)
    let addressQuery = supabaseAdmin
      .from('addresses')
      .select('id, user_id')
      .eq('id', addressId)

    // If not admin, restrict to user's own addresses
    if (userData.user_type !== 'admin') {
      addressQuery = addressQuery.eq('user_id', userId)
    }

    const { data: existingAddress, error: fetchError } = await addressQuery.single()

    if (fetchError || !existingAddress) {
      return NextResponse.json(
        { error: 'Address not found or access denied' },
        { status: 404 }
      )
    }

    // Delete address
    const { error: deleteError } = await supabaseAdmin
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', existingAddress.user_id) // Use the existing address user_id

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete address' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'Address deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Delete address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}