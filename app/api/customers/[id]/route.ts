import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
// Removed unused imports - these functions don't exist in auth-utils

// GET - Get single customer details (admin only)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    // Get user from session
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    
    // Check if user is admin
    if (user.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { data: customer, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, company_name, bonus_credit, price_ratio, is_active, created_at, updated_at')
      .eq('id', params.id)
      .eq('user_type', 'customer')
      .single()

    if (error || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customer }, { status: 200 })

  } catch (error) {
    console.error('Get customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update customer (admin only)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    // Get user from session
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    
    // Check if user is admin
    if (user.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const updates = await request.json()
    
    // Build update object
    interface UpdateData {
      email?: string
      password_hash?: string
      full_name?: string
      phone?: string | null
      company_name?: string
      bonus_credit?: number
      price_ratio?: number
      is_active?: boolean
    }
    const updateData: UpdateData = {}
    
    if (updates.email !== undefined) {
      // Check if new email is already taken
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', updates.email.toLowerCase())
        .neq('id', params.id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 409 }
        )
      }
      updateData.email = updates.email.toLowerCase()
    }

    if (updates.password !== undefined) {
      // Hash new password
      const saltRounds = 12
      updateData.password_hash = await bcrypt.hash(updates.password, saltRounds)
    }

    if (updates.fullName !== undefined) {
      updateData.full_name = updates.fullName
    }

    if (updates.phone !== undefined) {
      updateData.phone = updates.phone || null
    }

    if (updates.companyName !== undefined) {
      updateData.company_name = updates.companyName
    }

    if (updates.priceRatio !== undefined) {
      // Validate price ratio input
      if (updates.priceRatio < 0 || updates.priceRatio > 500) {
        return NextResponse.json(
          { error: 'Invalid price ratio. Must be between 0% and 500%' },
          { status: 400 }
        )
      }
      
      // Get current price ratio for logging
      const { data: currentCustomer } = await supabaseAdmin
        .from('users')
        .select('price_ratio, email, full_name')
        .eq('id', params.id)
        .single()
      
      const oldRatio = currentCustomer?.price_ratio || 0
      const newRatio = updates.priceRatio
      
      // Log price ratio change for audit trail (simplified)
      if (oldRatio !== newRatio) {
        console.log(`Price ratio changed for customer ${currentCustomer?.email}: ${oldRatio}% -> ${newRatio}%`)
      }
      
      updateData.price_ratio = newRatio
    }

    if (updates.bonusCredit !== undefined) {
      // Get current bonus credit to calculate difference
      const { data: currentCustomer } = await supabaseAdmin
        .from('users')
        .select('bonus_credit')
        .eq('id', params.id)
        .single()

      if (currentCustomer) {
        const creditDifference = updates.bonusCredit - (currentCustomer.bonus_credit || 0)
        
        // If there's a difference, create a balance transaction
        if (creditDifference !== 0) {
          await supabaseAdmin
            .from('balance_transactions')
            .insert([
              {
                user_id: params.id,
                amount: Math.abs(creditDifference),
                transaction_type: creditDifference > 0 ? 'credit' : 'adjustment',
                description: creditDifference > 0 ? 'Bonus credit adjustment (increase)' : 'Bonus credit adjustment (decrease)',
                status: 'completed',
                metadata: {
                  source: 'admin_update',
                  updated_by: user.id,
                  previous_amount: currentCustomer.bonus_credit,
                  new_amount: updates.bonusCredit
                }
              }
            ])
        }
      }
      
      updateData.bonus_credit = updates.bonusCredit
    }

    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive
    }

    // Update customer
    const { data: updatedCustomer, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_type', 'customer')
      .select('id, email, full_name, phone, company_name, bonus_credit, price_ratio, is_active, updated_at')
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update customer' },
        { status: 500 }
      )
    }

    if (!updatedCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Handle role assignment
    if (updates.roleId !== undefined) {
      // First, remove any existing role assignments
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', params.id)

      // If a new role is provided, assign it
      if (updates.roleId) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert([
            {
              user_id: params.id,
              role_id: updates.roleId,
              assigned_by: user.id
            }
          ])

        if (roleError) {
          console.error('Role assignment error:', roleError)
          // Don't fail the entire operation, just log the error
        }
      }
    }

    return NextResponse.json(
      { 
        message: 'Customer updated successfully',
        customer: updatedCustomer
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete customer (admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    // Get user from session
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    
    // Check if user is admin
    if (user.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .update({ is_active: false })
      .eq('id', params.id)
      .eq('user_type', 'customer')

    if (deleteError) {
      console.error('Database delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete customer' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Customer deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}