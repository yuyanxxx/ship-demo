import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('[API /api/roles] GET request received')
    
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    console.log('[API /api/roles] User authorized:', user.email)

    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select(`
        *,
        user_roles(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching roles:', error)
      // Check if it's a table not found error
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Roles table not found. Please run the database migration.', 
          roles: [] 
        }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 })
    }

    const rolesWithCount = roles.map(role => ({
      ...role,
      _count: {
        user_roles: role.user_roles[0]?.count || 0
      }
    }))

    return NextResponse.json(rolesWithCount)
  } catch (error) {
    console.error('Error in roles GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!

    const body = await request.json()
    const { name, description, permissions } = body

    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .insert({ name, description })
      .select()
      .single()

    if (roleError) {
      console.error('Error creating role:', roleError)
      return NextResponse.json({ error: 'Failed to create role' }, { status: 500 })
    }

    if (permissions && permissions.length > 0) {
      const permissionsData = permissions.map((perm: { menu_key: string; menu_title: string; parent_key: string | null; can_view: boolean }) => ({
        role_id: role.id,
        menu_key: perm.menu_key,
        menu_title: perm.menu_title,
        parent_key: perm.parent_key,
        can_view: perm.can_view
      }))

      const { error: permError } = await supabaseAdmin
        .from('role_permissions')
        .insert(permissionsData)

      if (permError) {
        console.error('Error creating permissions:', permError)
        await supabaseAdmin.from('roles').delete().eq('id', role.id)
        return NextResponse.json({ error: 'Failed to create permissions' }, { status: 500 })
      }
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error in roles POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}