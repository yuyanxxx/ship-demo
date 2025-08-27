import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_PERMISSIONS = {
  'Super Admin': [
    { menu_key: 'dashboard', menu_title: 'Dashboard', parent_key: null },
    { menu_key: 'get-quote', menu_title: 'Get Quote', parent_key: null },
    { menu_key: 'orders', menu_title: 'Orders', parent_key: null },
    { menu_key: 'balance', menu_title: 'Balance', parent_key: null },
    { menu_key: 'saved-addresses', menu_title: 'Saved Addresses', parent_key: null },
    { menu_key: 'insurance', menu_title: 'Insurance', parent_key: null },
    { menu_key: 'insurance-quotes', menu_title: 'Get Quote', parent_key: 'insurance' },
    { menu_key: 'insurance-certificates', menu_title: 'Certificates', parent_key: 'insurance' },
    { menu_key: 'customers', menu_title: 'Customers', parent_key: null },
    { menu_key: 'roles', menu_title: 'Roles', parent_key: null },
    { menu_key: 'payment-config', menu_title: 'Payment Config', parent_key: null },
    { menu_key: 'recharge-review', menu_title: 'Recharge Review', parent_key: null },
    { menu_key: 'top-up-history', menu_title: 'Top-up History', parent_key: null },
    { menu_key: 'support', menu_title: 'Support', parent_key: null },
  ],
  'Customer': [
    { menu_key: 'dashboard', menu_title: 'Dashboard', parent_key: null },
    { menu_key: 'get-quote', menu_title: 'Get Quote', parent_key: null },
    { menu_key: 'orders', menu_title: 'Orders', parent_key: null },
    { menu_key: 'balance', menu_title: 'Balance', parent_key: null },
    { menu_key: 'saved-addresses', menu_title: 'Saved Addresses', parent_key: null },
    { menu_key: 'insurance', menu_title: 'Insurance', parent_key: null },
    { menu_key: 'insurance-quotes', menu_title: 'Get Quote', parent_key: 'insurance' },
    { menu_key: 'insurance-certificates', menu_title: 'Certificates', parent_key: 'insurance' },
    { menu_key: 'support', menu_title: 'Support', parent_key: null },
  ]
}

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

    // Only allow admin users
    if (user.user_type !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    console.log(`Roles system initialization started by: ${user.email}`)

    const operations = []

    // 1. Create default roles if they don't exist
    console.log('Step 1: Creating default roles...')
    
    for (const roleName of ['Super Admin', 'Customer']) {
      const { data: existingRole } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', roleName)
        .single()

      if (!existingRole) {
        const description = roleName === 'Super Admin' 
          ? 'Full access to all system features and settings'
          : 'Standard customer access with limited permissions'

        const { data: newRole, error: roleError } = await supabaseAdmin
          .from('roles')
          .insert({
            name: roleName,
            description: description,
            is_active: true
          })
          .select()
          .single()

        if (roleError) {
          console.error(`Error creating ${roleName} role:`, roleError)
          operations.push(`❌ Failed to create ${roleName} role: ${roleError.message}`)
        } else {
          console.log(`✅ Created ${roleName} role`)
          operations.push(`✅ Created ${roleName} role`)
        }
      } else {
        console.log(`${roleName} role already exists`)
        operations.push(`ℹ️ ${roleName} role already exists`)
      }
    }

    // 2. Get the created roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .in('name', ['Super Admin', 'Customer'])

    if (rolesError || !roles) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json({ error: 'Failed to fetch roles after creation' }, { status: 500 })
    }

    // 3. Create permissions for each role
    console.log('Step 2: Creating role permissions...')
    
    for (const role of roles) {
      const permissions = DEFAULT_PERMISSIONS[role.name as keyof typeof DEFAULT_PERMISSIONS]
      
      if (permissions) {
        // Delete existing permissions for this role
        await supabaseAdmin
          .from('role_permissions')
          .delete()
          .eq('role_id', role.id)

        // Insert new permissions
        const permissionsData = permissions.map(perm => ({
          role_id: role.id,
          menu_key: perm.menu_key,
          menu_title: perm.menu_title,
          parent_key: perm.parent_key,
          can_view: true
        }))

        const { error: permError } = await supabaseAdmin
          .from('role_permissions')
          .insert(permissionsData)

        if (permError) {
          console.error(`Error creating permissions for ${role.name}:`, permError)
          operations.push(`❌ Failed to create permissions for ${role.name}: ${permError.message}`)
        } else {
          console.log(`✅ Created ${permissions.length} permissions for ${role.name}`)
          operations.push(`✅ Created ${permissions.length} permissions for ${role.name}`)
        }
      }
    }

    // 4. Assign Super Admin role to all admin users
    console.log('Step 3: Assigning Super Admin roles to admin users...')
    
    const superAdminRole = roles.find(r => r.name === 'Super Admin')
    if (!superAdminRole) {
      return NextResponse.json({ error: 'Super Admin role not found after creation' }, { status: 500 })
    }

    // Get all admin users
    const { data: adminUsers, error: adminUsersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('user_type', 'admin')
      .eq('is_active', true)

    if (adminUsersError) {
      console.error('Error fetching admin users:', adminUsersError)
      operations.push(`❌ Failed to fetch admin users: ${adminUsersError.message}`)
    } else if (adminUsers && adminUsers.length > 0) {
      for (const user of adminUsers) {
        // Check if user already has Super Admin role
        const { data: existingAssignment } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role_id', superAdminRole.id)
          .single()

        if (!existingAssignment) {
          const { error: assignError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: user.id,
              role_id: superAdminRole.id,
              assigned_at: new Date().toISOString(),
              assigned_by: user.id
            })

          if (assignError) {
            console.error(`Error assigning Super Admin role to ${user.email}:`, assignError)
            operations.push(`❌ Failed to assign Super Admin role to ${user.email}`)
          } else {
            console.log(`✅ Assigned Super Admin role to ${user.email}`)
            operations.push(`✅ Assigned Super Admin role to ${user.email}`)
          }
        } else {
          console.log(`${user.email} already has Super Admin role`)
          operations.push(`ℹ️ ${user.email} already has Super Admin role`)
        }
      }
    } else {
      operations.push(`ℹ️ No admin users found`)
    }

    console.log('Roles system initialization completed')

    return NextResponse.json({
      success: true,
      message: 'Roles system initialized successfully',
      operations: operations,
      summary: {
        roles_created: operations.filter(op => op.includes('Created') && op.includes('role')).length,
        permissions_created: operations.filter(op => op.includes('permissions')).length,
        users_assigned: operations.filter(op => op.includes('Assigned Super Admin role')).length
      },
      initialized_by: user.email,
      initialized_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error during roles system initialization:', error)
    return NextResponse.json({
      error: 'Internal server error during initialization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}