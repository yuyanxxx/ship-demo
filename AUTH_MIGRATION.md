# Authentication System Migration Guide

## Overview

This document explains the changes made to fix the Edge Runtime compatibility issue with Vercel deployment.

## Problem

The original middleware was using Supabase directly, which contains Node.js APIs that are not supported in the Edge Runtime. This caused the deployment error:

```
Error: The Edge Function "middleware" is referencing unsupported modules:
- __vc__ns__/0/middleware.js: @/lib/auth-middleware
```

## Solution

We've restructured the authentication system to be Edge Runtime compatible:

1. **Simplified Middleware** (`middleware.ts`): Now only validates basic request structure and adds user ID to headers
2. **New Auth Utils** (`lib/auth-utils.ts`): Handles full authentication in API routes where Node.js APIs are supported
3. **Updated API Routes**: Now use the new authentication system

## How It Works

### 1. Middleware (Edge Runtime Compatible)

The middleware now:
- Only processes API routes
- Allows public routes without validation
- Checks for authorization header presence
- Extracts user ID and adds it to request headers
- Does NOT access database or use Node.js APIs

### 2. API Route Authentication

Each API route now:
- Uses `authorizeApiRequest()` from `lib/auth-utils.ts`
- Gets full user data and permissions
- Handles role-based access control
- Returns proper error responses

## Usage Examples

### Basic API Route with Authentication

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  // Authorize the request
  const authResult = await authorizeApiRequest(request)
  
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: authResult.status || 401 }
    )
  }

  // User is authenticated, access user data
  const user = authResult.user!
  
  // Your API logic here...
}
```

### Admin-Only Route

The route configuration automatically handles admin-only access:

```typescript
// This route is automatically restricted to admins based on ROUTE_CONFIGS
'/api/customers': { 
  requireAuth: true, 
  allowedRoles: ['admin'],
  requireActiveUser: true 
}
```

### Custom Permission Check

```typescript
import { userHasPermission, isAdmin } from '@/lib/auth-utils'

// Check specific permission
if (!userHasPermission(user, 'manage_customers')) {
  return NextResponse.json(
    { error: 'Insufficient permissions' },
    { status: 403 }
  )
}

// Check if user is admin
if (!isAdmin(user)) {
  return NextResponse.json(
    { error: 'Admin access required' },
    { status: 403 }
  )
}
```

## Migration Steps

### 1. Update Existing API Routes

Replace old authentication code:

```typescript
// OLD WAY
const userHeader = request.headers.get('x-user-data')
if (!userHeader) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const user = JSON.parse(userHeader)

// NEW WAY
const authResult = await authorizeApiRequest(request)
if (!authResult.authorized) {
  return NextResponse.json(
    { error: authResult.error || 'Unauthorized' },
    { status: authResult.status || 401 }
  )
}
const user = authResult.user!
```

### 2. Remove Manual Role Checks

The new system handles role checking automatically based on route configuration.

### 3. Update Error Handling

Use the status code from the auth result:

```typescript
return NextResponse.json(
  { error: authResult.error || 'Unauthorized' },
  { status: authResult.status || 401 }
)
```

## Benefits

1. **Edge Runtime Compatible**: Works with Vercel deployment
2. **Centralized Configuration**: All route permissions in one place
3. **Automatic Role Checking**: No need to manually check roles in each route
4. **Better Error Handling**: Consistent error responses
5. **Type Safety**: Full TypeScript support for user data

## Route Configuration

All route permissions are defined in `ROUTE_CONFIGS` in `lib/auth-utils.ts`. To add a new route:

```typescript
'/api/new-feature': { 
  requireAuth: true, 
  allowedRoles: ['admin', 'customer'],
  requireActiveUser: true,
  checkPermissions: ['feature_access'] // Optional
}
```

## Testing

1. **Local Development**: Test with your existing setup
2. **Vercel Deployment**: Should now work without Edge Runtime errors
3. **Authentication Flow**: Verify that protected routes require proper authorization

## Troubleshooting

### Common Issues

1. **Missing Authorization Header**: Ensure client sends `Authorization: Bearer <userId>` header
2. **Role Mismatch**: Check route configuration in `ROUTE_CONFIGS`
3. **Database Connection**: Verify Supabase environment variables are set

### Debug Mode

Enable debug logging by checking console output for `[Auth]` prefixed messages.

## Support

If you encounter issues:
1. Check the console logs for authentication details
2. Verify route configuration matches your requirements
3. Ensure all environment variables are properly set
