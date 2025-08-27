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

    // Only allow admin users
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    console.log('Debug: Checking roles system state...')

    // 1. Check roles table
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true })

    console.log('Roles table:', roles, 'Error:', rolesError)

    // 2. Check user_roles table
    const { data: userRoles, error: userRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('*')

    console.log('User roles table:', userRoles, 'Error:', userRolesError)

    // 3. Check role_permissions table
    const { data: rolePermissions, error: rolePermissionsError } = await supabaseAdmin
      .from('role_permissions')
      .select('*')

    console.log('Role permissions table:', rolePermissions, 'Error:', rolePermissionsError)

    // 4. Get all admin users
    const { data: adminUsers, error: adminUsersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, user_type')
      .eq('user_type', 'admin')

    console.log('Admin users:', adminUsers, 'Error:', adminUsersError)

    // 5. Check if Super Admin role exists
    const superAdminRole = roles?.find(role => role.name === 'Super Admin')
    
    return NextResponse.json({
      summary: {
        total_roles: roles?.length || 0,
        total_user_roles: userRoles?.length || 0,
        total_role_permissions: rolePermissions?.length || 0,
        admin_users_count: adminUsers?.length || 0,
        super_admin_role_exists: !!superAdminRole
      },
      data: {
        roles: roles || [],
        user_roles: userRoles || [],
        role_permissions: rolePermissions || [],
        admin_users: adminUsers || [],
        super_admin_role: superAdminRole || null
      },
      issues: {
        no_roles: !roles || roles.length === 0,
        no_super_admin_role: !superAdminRole,
        no_user_role_assignments: !userRoles || userRoles.length === 0,
        no_role_permissions: !rolePermissions || rolePermissions.length === 0,
        admin_users_without_roles: adminUsers ? adminUsers.filter(user => 
          !userRoles?.some(ur => ur.user_id === user.id)
        ) : []
      }
    })

  } catch (error) {
    console.error('Error in roles debug:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}