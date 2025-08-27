/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
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

    console.log(`Fetching permissions for user: ${userData.email} (${userData.user_type})`)

    // Get user's roles
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        roles (
          id,
          name
        )
      `)
      .eq('user_id', userId)

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError)
      return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 })
    }

    console.log(`User has ${userRoles?.length || 0} roles:`, userRoles?.map(r => (r.roles as any)?.name))

    // If user has no roles, return empty permissions
    if (!userRoles || userRoles.length === 0) {
      console.log('User has no roles assigned')
      return NextResponse.json({ 
        permissions: [],
        roles: [],
        message: 'No roles assigned to user'
      })
    }

    // Get permissions for all user's roles
    const roleIds = userRoles.map(ur => ur.role_id)
    
    const { data: rolePermissions, error: permissionsError } = await supabaseAdmin
      .from('role_permissions')
      .select('menu_key')
      .in('role_id', roleIds)
      .eq('can_view', true)

    if (permissionsError) {
      console.error('Error fetching role permissions:', permissionsError)
      return NextResponse.json({ error: 'Failed to fetch role permissions' }, { status: 500 })
    }

    console.log(`Found ${rolePermissions?.length || 0} permissions for user roles`)

    // Extract unique permissions
    const permissions = [...new Set(rolePermissions?.map(p => p.menu_key) || [])]
    
    const roleNames = userRoles.map(ur => (ur.roles as any)?.name).filter(Boolean)

    console.log(`Final permissions for ${userData.email}:`, permissions)

    return NextResponse.json({
      permissions,
      roles: roleNames,
      user_type: userData.user_type
    })

  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}