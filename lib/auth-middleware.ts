/**
 * CENTRALIZED AUTHORIZATION MIDDLEWARE
 * 
 * This is THE authorization system. Stop checking auth in components.
 * Stop checking auth in API routes. This middleware handles it ALL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UserPricingData } from '@/lib/pricing-engine';

/**
 * Route authorization configuration
 */
export interface RouteConfig {
  requireAuth: boolean;
  allowedRoles?: ('admin' | 'customer')[];
  requireActiveUser?: boolean;
  checkPermissions?: string[];
}

/**
 * Route configurations - THE source of truth for authorization
 */
const ROUTE_CONFIGS: Record<string, RouteConfig> = {
  // Public routes - no auth required
  '/api/auth/login': { requireAuth: false },
  '/api/auth/register': { requireAuth: false },
  '/api/auth/forgot-password': { requireAuth: false },
  
  // Admin-only routes
  '/api/customers': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/customers/[id]': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/roles': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/roles/assign-admin-roles': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/roles/debug': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/roles/initialize': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/admin/migrate': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  
  // Customer and Admin routes
  '/api/quotes/ltl': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/quotes/tl': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/quotes/results': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/orders/place': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/orders/[id]': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/balance/transactions': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/users/permissions': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  
  // Top-up related routes
  '/api/top-up/countries': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/top-up/payment-configs': { 
    requireAuth: true, 
    allowedRoles: ['admin', 'customer'],
    requireActiveUser: true 
  },
  '/api/top-up/submit': { 
    requireAuth: true, 
    allowedRoles: ['customer'],
    requireActiveUser: true 
  },
  
  // Admin top-up routes
  '/api/admin/payment-config': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/admin/top-up/review': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/admin/clear-topup-requests': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  '/api/admin/reset-system': { 
    requireAuth: true, 
    allowedRoles: ['admin'],
    requireActiveUser: true 
  },
  
  // Default for unspecified routes
  '/api/*': { 
    requireAuth: true,
    requireActiveUser: true 
  }
};

/**
 * Enhanced user data with all necessary fields
 */
export interface AuthenticatedUser extends UserPricingData {
  email: string;
  full_name: string;
  is_active: boolean;
  created_at?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Get route configuration for a path
 */
function getRouteConfig(pathname: string): RouteConfig {
  // Try exact match first
  if (ROUTE_CONFIGS[pathname]) {
    return ROUTE_CONFIGS[pathname];
  }
  
  // Try pattern match (for dynamic routes)
  for (const [pattern, config] of Object.entries(ROUTE_CONFIGS)) {
    if (pattern.includes('[') && pattern.includes(']')) {
      // Convert pattern to regex (e.g., /api/customers/[id] -> /api/customers/.+)
      const regex = new RegExp('^' + pattern.replace(/\[.*?\]/g, '[^/]+') + '$');
      if (regex.test(pathname)) {
        return config;
      }
    }
  }
  
  // Check for wildcard patterns
  const pathSegments = pathname.split('/');
  for (let i = pathSegments.length; i > 0; i--) {
    const wildcardPath = pathSegments.slice(0, i).join('/') + '/*';
    if (ROUTE_CONFIGS[wildcardPath]) {
      return ROUTE_CONFIGS[wildcardPath];
    }
  }
  
  // Default: require auth
  return { requireAuth: true, requireActiveUser: true };
}

/**
 * Main authorization middleware
 */
export async function authorizeRequest(request: NextRequest): Promise<{
  authorized: boolean;
  user?: AuthenticatedUser;
  error?: string;
  response?: NextResponse;
}> {
  const pathname = request.nextUrl.pathname;
  const config = getRouteConfig(pathname);
  
  console.log(`[Auth] Processing ${pathname}`, config);
  
  // Public routes - no auth needed
  if (!config.requireAuth) {
    console.log('[Auth] Public route, allowing access');
    return { authorized: true };
  }
  
  // Get authorization header
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth] Missing or invalid authorization header');
    return {
      authorized: false,
      error: 'Unauthorized - No valid authorization header',
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }
  
  const userId = authHeader.replace('Bearer ', '').trim();
  
  if (!userId) {
    console.log('[Auth] Empty user ID in authorization header');
    return {
      authorized: false,
      error: 'Unauthorized - Invalid user ID',
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }
  
  // Fetch user from database
  console.log('[Auth] Fetching user:', userId);
  console.log('[Auth] Environment:', process.env.NODE_ENV);
  console.log('[Auth] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[Auth] Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  let user = null;
  let error = null;
  
  try {
    const response = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        user_type,
        price_ratio,
        is_active,
        created_at
      `)
      .eq('id', userId)
      .single();
    
    user = response.data;
    error = response.error;
    
    console.log('[Auth] Supabase response:', { user: !!user, error: error?.message });
  } catch (fetchError) {
    console.log('[Auth] Supabase fetch error:', {
      message: fetchError instanceof Error ? fetchError.message : String(fetchError),
      details: String(fetchError),
      hint: typeof fetchError === 'object' && fetchError !== null && 'hint' in fetchError ? String(fetchError.hint) : '',
      code: typeof fetchError === 'object' && fetchError !== null && 'code' in fetchError ? String(fetchError.code) : ''
    });
    error = fetchError;
  }
  
  if (error || !user) {
    console.log('[Auth] User not found:', {
      message: error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error),
      details: String(error),
      hint: typeof error === 'object' && error !== null && 'hint' in error ? String(error.hint) : '',
      code: typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    });
    
    // In development, if we're having connection issues, create a mock admin user
    // This is a temporary workaround for development only
    if (process.env.NODE_ENV === 'development' && 
        (String(error).includes('fetch failed') || 
         (error instanceof Error && error.message?.includes('fetch failed')) ||
         (typeof error === 'object' && error !== null && 'message' in error && String(error.message).includes('fetch failed')))) {
      console.log('[Auth] Development mode: Creating mock user due to connection issues');
      const mockUser: AuthenticatedUser = {
        id: userId,
        email: 'admin@example.com',
        full_name: 'Development Admin',
        user_type: 'admin',
        price_ratio: 1.0,
        is_active: true,
        created_at: new Date().toISOString(),
        roles: [],
        permissions: []
      };
      
      return {
        authorized: true,
        user: mockUser
      };
    }
    
    return {
      authorized: false,
      error: 'Unauthorized - User not found',
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }
  
  // Check if user is active
  if (config.requireActiveUser && !user.is_active) {
    console.log('[Auth] User is inactive');
    return {
      authorized: false,
      error: 'Forbidden - Account is inactive',
      response: NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      )
    };
  }
  
  // Check role-based access
  if (config.allowedRoles && config.allowedRoles.length > 0) {
    if (!config.allowedRoles.includes(user.user_type as 'admin' | 'customer')) {
      console.log('[Auth] User role not allowed:', user.user_type);
      return {
        authorized: false,
        error: `Forbidden - Required role: ${config.allowedRoles.join(' or ')}`,
        response: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      };
    }
  }
  
  // Fetch user roles and permissions if needed
  let roles: string[] = [];
  let permissions: string[] = [];
  
  if (config.checkPermissions) {
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);
    
    if (userRoles && userRoles.length > 0) {
      const roleIds = userRoles.map(ur => ur.role_id);
      
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('name')
        .in('id', roleIds);
      
      if (roleData) {
        roles = roleData.map(r => r.name);
      }
      
      const { data: permData } = await supabaseAdmin
        .from('role_permissions')
        .select('permission_key')
        .in('role_id', roleIds);
      
      if (permData) {
        permissions = [...new Set(permData.map(p => p.permission_key))];
      }
    }
    
    // Check specific permissions
    const hasRequiredPermissions = config.checkPermissions.every(
      perm => permissions.includes(perm)
    );
    
    if (!hasRequiredPermissions) {
      console.log('[Auth] Missing required permissions');
      return {
        authorized: false,
        error: 'Forbidden - Missing required permissions',
        response: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      };
    }
  }
  
  // Build authenticated user object
  const authenticatedUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    user_type: user.user_type as 'admin' | 'customer',
    price_ratio: user.price_ratio || 0,
    is_active: user.is_active,
    created_at: user.created_at,
    roles,
    permissions
  };
  
  console.log('[Auth] User authorized:', {
    id: authenticatedUser.id,
    email: authenticatedUser.email,
    type: authenticatedUser.user_type,
    priceRatio: authenticatedUser.price_ratio
  });
  
  return {
    authorized: true,
    user: authenticatedUser
  };
}

/**
 * Create response with user data in headers
 */
export function createAuthenticatedResponse(
  request: NextRequest,
  user: AuthenticatedUser
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-data', JSON.stringify(user));
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Helper to check if user has permission
 */
export function userHasPermission(
  user: AuthenticatedUser,
  permission: string
): boolean {
  return user.permissions?.includes(permission) || false;
}

/**
 * Helper to check if user has role
 */
export function userHasRole(
  user: AuthenticatedUser,
  role: string
): boolean {
  return user.roles?.includes(role) || false;
}

/**
 * Helper to check if user is admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.user_type === 'admin';
}

/**
 * Helper to check if user is customer
 */
export function isCustomer(user: AuthenticatedUser): boolean {
  return user.user_type === 'customer';
}