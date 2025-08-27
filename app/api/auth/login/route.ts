import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    console.log('[Login API] Login attempt for email:', email)

    // Validate input
    if (!email || !password) {
      console.log('[Login API] Missing email or password')
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user in database
    console.log('[Login API] Searching for user with email:', email.toLowerCase())
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, full_name, phone, user_type, company_name, price_ratio, is_active')
      .eq('email', email.toLowerCase())
      .single()

    console.log('[Login API] User query result:', { userFound: !!user, error: userError })
    
    if (userError || !user) {
      console.log('[Login API] User not found or error:', userError)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if account is active
    console.log('[Login API] User found:', { id: user.id, email: user.email, is_active: user.is_active, user_type: user.user_type })
    
    if (!user.is_active) {
      console.log('[Login API] Account is deactivated')
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 }
      )
    }

    // Verify password
    console.log('[Login API] Verifying password...')
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    console.log('[Login API] Password valid:', isPasswordValid)

    if (!isPasswordValid) {
      console.log('[Login API] Invalid password')
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login timestamp (optional)
    await supabaseAdmin
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)

    // Extract role and permissions (optional - won't break login if tables don't exist)
    let role = null
    let permissions: string[] = []
    
    try {
      console.log('[Login API] Fetching user roles for user:', user.id)
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select(`
          role_id,
          roles (
            id,
            name,
            is_active,
            role_permissions (
              menu_key,
              menu_title,
              parent_key,
              can_view
            )
          )
        `)
        .eq('user_id', user.id)
        .single()
      
      console.log('[Login API] User roles query result:', { userRoles, error: rolesError })
      
      if (userRoles && userRoles.roles) {
        // Handle both single object and array responses from Supabase
        const roleData = Array.isArray(userRoles.roles) ? userRoles.roles[0] : userRoles.roles
        
        if (roleData && roleData.is_active) {
          role = {
            id: roleData.id,
            name: roleData.name
          }
          
          if (roleData.role_permissions) {
            permissions = roleData.role_permissions
              .filter((perm: { can_view: boolean }) => perm.can_view)
              .map((perm: { menu_key: string }) => perm.menu_key)
          }
        }
      }
    } catch (roleError) {
      // If role tables don't exist or user has no role, continue without role/permissions
      console.log('No role assigned or role tables not set up:', roleError)
    }

    // Return success response (without password)
    const responseUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      user_type: user.user_type || 'customer',
      company_name: user.company_name,
      price_ratio: user.price_ratio || 1.0,
      role: role,
      permissions: permissions
    }
    
    console.log('[Login API] Login successful, returning user:', responseUser)
    
    return NextResponse.json(
      { 
        message: 'Login successful',
        user: responseUser
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}