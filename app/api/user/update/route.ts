import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  try {
    const { user_id, full_name } = await request.json()

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Full name must be at least 2 characters long' },
        { status: 400 }
      )
    }

    // Verify user exists and is active
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_active, email')
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

    // Update user's full name
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name: full_name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)
      .select('id, email, full_name, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update user information' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'User information updated successfully',
        user: updatedUser
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}