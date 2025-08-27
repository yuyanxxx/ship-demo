/**
 * CLIENT-SIDE API UTILITY
 * 
 * Handles authentication headers for all API calls.
 * Use this instead of raw fetch() for authenticated endpoints.
 */

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Get current user from localStorage
 */
function getCurrentUser(): { id: string; email: string } | null {
  if (typeof window === 'undefined') return null;
  
  const storedUser = localStorage.getItem('user');
  if (!storedUser) return null;
  
  try {
    return JSON.parse(storedUser);
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API call
 * Automatically adds Authorization header with user ID
 */
export async function apiClient(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options;
  
  // Get current user for auth
  const user = getCurrentUser();
  
  // If auth is required but no user, throw error
  if (requireAuth && !user) {
    throw new Error('Authentication required. Please log in.');
  }
  
  // Build headers
  const headers = new Headers(fetchOptions.headers);
  
  // Add auth header if user exists
  if (user) {
    headers.set('Authorization', `Bearer ${user.id}`);
  }
  
  // Add default content type if not set and body exists
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Make the request
  return fetch(url, {
    ...fetchOptions,
    headers
  });
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  /**
   * GET request
   */
  get: (url: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiClient(url, { ...options, method: 'GET' }),
  
  /**
   * POST request
   */
  post: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiClient(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    }),
  
  /**
   * PUT request
   */
  put: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiClient(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    }),
  
  /**
   * PATCH request
   */
  patch: (url: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
    apiClient(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    }),
  
  /**
   * DELETE request
   */
  delete: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    apiClient(url, { ...options, method: 'DELETE' })
};

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  const user = getCurrentUser();
  return user?.id || null;
}

/**
 * Clear authentication (logout)
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
}