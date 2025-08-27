/**
 * NEXT.JS MIDDLEWARE - SINGLE POINT OF AUTHORIZATION
 * 
 * This middleware enforces authorization for ALL routes.
 * No more auth checks in components or API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest, createAuthenticatedResponse } from '@/lib/auth-middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  console.log(`[Middleware] Processing: ${pathname}`);
  
  // Run centralized authorization
  const authResult = await authorizeRequest(request);
  
  if (!authResult.authorized) {
    console.log(`[Middleware] Authorization failed: ${authResult.error}`);
    return authResult.response || NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // If authorized and we have user data, inject it into headers
  if (authResult.user) {
    console.log(`[Middleware] User authorized: ${authResult.user.email}`);
    return createAuthenticatedResponse(request, authResult.user);
  }
  
  // Public route or no user data needed
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};