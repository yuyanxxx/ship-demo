import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const { data: role, error } = await supabaseAdmin
      .from('roles')
      .select(`
        *,
        role_permissions(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching role:', error)
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error in role GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { name, description, is_active, permissions } = body

    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .update({ name, description, is_active })
      .eq('id', id)
      .select()
      .single()

    if (roleError) {
      console.error('Error updating role:', roleError)
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    if (permissions !== undefined) {
      await supabaseAdmin
        .from('role_permissions')
        .delete()
        .eq('role_id', id)

      if (permissions.length > 0) {
        const permissionsData = permissions.map((perm: { menu_key: string; menu_title: string; parent_key: string | null; can_view: boolean }) => ({
          role_id: id,
          menu_key: perm.menu_key,
          menu_title: perm.menu_title,
          parent_key: perm.parent_key,
          can_view: perm.can_view
        }))

        const { error: permError } = await supabaseAdmin
          .from('role_permissions')
          .insert(permissionsData)

        if (permError) {
          console.error('Error updating permissions:', {
            message: permError.message,
            details: permError.details || permError,
            hint: permError.hint || '',
            code: permError.code || ''
          })
          return NextResponse.json({ 
            error: 'Failed to update permissions',
            details: permError.message || 'Unknown error'
          }, { status: 500 })
        }
      }
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error in role PUT:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', id)
      .single()

    if (role?.name === 'Super Admin' || role?.name === 'Customer') {
      return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting role:', error)
      return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in role DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}