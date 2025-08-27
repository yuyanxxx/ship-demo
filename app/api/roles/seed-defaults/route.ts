import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
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
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    if (user.user_type !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get existing roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .in('name', ['Super Admin', 'Customer'])

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
    }

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'Default roles not found' }, { status: 404 })
    }

    // Seed permissions for each role
    for (const role of roles) {
      const permissions = DEFAULT_PERMISSIONS[role.name as keyof typeof DEFAULT_PERMISSIONS]
      
      if (permissions) {
        // Delete existing permissions
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

        const { error: insertError } = await supabaseAdmin
          .from('role_permissions')
          .insert(permissionsData)

        if (insertError) {
          console.error(`Error inserting permissions for ${role.name}:`, insertError)
        }
      }
    }

    return NextResponse.json({ message: 'Default permissions seeded successfully' })
  } catch (error) {
    console.error('Error seeding permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}