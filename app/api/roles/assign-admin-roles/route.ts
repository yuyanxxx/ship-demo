import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Only allow admin users to run this operation
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    console.log(`Auto-assigning Super Admin roles initiated by: ${userData.email}`)

    // Get the Super Admin role
    const { data: superAdminRole, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('name', 'Super Admin')
      .single()

    if (roleError || !superAdminRole) {
      console.error('Super Admin role not found:', roleError)
      return NextResponse.json({ error: 'Super Admin role not found. Please ensure default roles are created first.' }, { status: 404 })
    }

    console.log('Super Admin role found:', superAdminRole)

    // Get all admin users
    const { data: adminUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, user_type')
      .eq('user_type', 'admin')
      .eq('is_active', true)

    if (usersError) {
      console.error('Error fetching admin users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch admin users' }, { status: 500 })
    }

    if (!adminUsers || adminUsers.length === 0) {
      return NextResponse.json({ message: 'No admin users found' })
    }

    console.log(`Found ${adminUsers.length} admin users to process`)

    const results = []
    
    for (const user of adminUsers) {
      try {
        // Check if user already has Super Admin role
        const { data: existingAssignment, error: checkError } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role_id', superAdminRole.id)
          .single()

        if (existingAssignment && !checkError) {
          // User already has Super Admin role
          results.push({
            user_id: user.id,
            email: user.email,
            action: 'skipped',
            reason: 'Already has Super Admin role'
          })
          console.log(`Skipped ${user.email} - already has Super Admin role`)
          continue
        }

        // Assign Super Admin role to the user
        const { error: assignError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: user.id,
            role_id: superAdminRole.id,
            assigned_at: new Date().toISOString(),
            assigned_by: userData.id
          })

        if (assignError) {
          console.error(`Error assigning role to ${user.email}:`, assignError)
          results.push({
            user_id: user.id,
            email: user.email,
            action: 'failed',
            reason: assignError.message
          })
        } else {
          results.push({
            user_id: user.id,
            email: user.email,
            action: 'assigned',
            reason: 'Successfully assigned Super Admin role'
          })
          console.log(`Successfully assigned Super Admin role to ${user.email}`)
        }
      } catch (userError) {
        console.error(`Error processing user ${user.email}:`, userError)
        results.push({
          user_id: user.id,
          email: user.email,
          action: 'failed',
          reason: userError instanceof Error ? userError.message : 'Unknown error'
        })
      }
    }

    // Summary
    const assigned = results.filter(r => r.action === 'assigned').length
    const skipped = results.filter(r => r.action === 'skipped').length
    const failed = results.filter(r => r.action === 'failed').length

    console.log(`Auto-assignment completed: ${assigned} assigned, ${skipped} skipped, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: 'Admin role auto-assignment completed',
      summary: {
        total_admin_users: adminUsers.length,
        assigned_count: assigned,
        skipped_count: skipped,
        failed_count: failed
      },
      details: results,
      super_admin_role: superAdminRole,
      processed_by: userData.email,
      processed_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error during admin role auto-assignment:', error)
    return NextResponse.json({
      error: 'Internal server error during role assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}