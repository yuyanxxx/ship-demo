/**
 * NEXT.JS MIDDLEWARE - EDGE RUNTIME COMPATIBLE
 * 
 * This middleware provides basic request validation without database access.
 * Full authentication is handled in individual API routes.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  console.log(`[Middleware] Processing: ${pathname}`);
  
  // Public routes that don't need any validation
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register', 
    '/api/auth/forgot-password'
  ];
  
  if (publicRoutes.includes(pathname)) {
    console.log(`[Middleware] Public route, allowing access: ${pathname}`);
    return NextResponse.next();
  }
  
  // For all other API routes, check if authorization header exists
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[Middleware] Missing authorization header for: ${pathname}`);
    return NextResponse.json(
      { error: 'Unauthorized - Missing authorization header' },
      { status: 401 }
    );
  }
  
  const userId = authHeader.replace('Bearer ', '').trim();
  
  if (!userId) {
    console.log(`[Middleware] Empty user ID for: ${pathname}`);
    return NextResponse.json(
      { error: 'Unauthorized - Invalid user ID' },
      { status: 401 }
    );
  }
  
  // Add user ID to headers for API routes to use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId);
  
  console.log(`[Middleware] User authorized: ${userId} for ${pathname}`);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};