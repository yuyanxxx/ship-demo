/**
 * Authorization utilities for supervisor-customer pricing system
 * Handles role-based access control and pricing authorization
 */

/**
 * Check if user has admin privileges
 * 
 * @param userData - User object from middleware
 * @returns True if user is an admin
 */
export function isAdmin(userData: Record<string, unknown> | null): boolean {
  return userData?.user_type === 'admin';
}

/**
 * Check if user has supervisor privileges (admin)
 * Alias for isAdmin for clarity in pricing context
 * 
 * @param userData - User object from middleware  
 * @returns True if user is a supervisor (admin)
 */
export function isSupervisor(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Check if user is a customer
 * 
 * @param userData - User object from middleware
 * @returns True if user is a customer
 */
export function isCustomer(userData: Record<string, unknown> | null): boolean {
  return userData?.user_type === 'customer';
}

/**
 * Check if user can view base pricing
 * Only admins/supervisors can see base pricing
 * 
 * @param userData - User object from middleware
 * @returns True if user can view base pricing
 */
export function canViewBasePricing(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Check if user can modify price ratios
 * Only admins can modify customer price ratios
 * 
 * @param userData - User object from middleware
 * @returns True if user can modify price ratios
 */
export function canModifyPriceRatios(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Check if user can create dual transactions
 * Only admins can create dual transactions
 * 
 * @param userData - User object from middleware
 * @returns True if user can create dual transactions
 */
export function canCreateDualTransactions(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Check if user can view all transactions
 * Admins can view all transactions, customers only their own
 * 
 * @param userData - User object from middleware
 * @returns True if user can view all transactions
 */
export function canViewAllTransactions(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Check if user can manage customers
 * Only admins can create, edit, delete customers
 * 
 * @param userData - User object from middleware
 * @returns True if user can manage customers
 */
export function canManageCustomers(userData: Record<string, unknown> | null): boolean {
  return isAdmin(userData);
}

/**
 * Authorize request based on required permission
 * Returns authorization result with error message if unauthorized
 * 
 * @param userData - User object from middleware
 * @param permission - Required permission
 * @returns Authorization result
 */
export function authorizeRequest(
  userData: Record<string, unknown> | null, 
  permission: 'admin' | 'customer' | 'viewBasePricing' | 'modifyPriceRatios' | 'createDualTransactions' | 'viewAllTransactions' | 'manageCustomers'
): { authorized: boolean; error?: string } {
  if (!userData) {
    return { authorized: false, error: 'User not authenticated' };
  }

  if (!userData.is_active) {
    return { authorized: false, error: 'User account is inactive' };
  }

  switch (permission) {
    case 'admin':
      return isAdmin(userData) 
        ? { authorized: true }
        : { authorized: false, error: 'Admin privileges required' };
        
    case 'customer':
      return isCustomer(userData) 
        ? { authorized: true }
        : { authorized: false, error: 'Customer account required' };
        
    case 'viewBasePricing':
      return canViewBasePricing(userData)
        ? { authorized: true }
        : { authorized: false, error: 'Insufficient privileges to view base pricing' };
        
    case 'modifyPriceRatios':
      return canModifyPriceRatios(userData)
        ? { authorized: true }
        : { authorized: false, error: 'Insufficient privileges to modify price ratios' };
        
    case 'createDualTransactions':
      return canCreateDualTransactions(userData)
        ? { authorized: true }
        : { authorized: false, error: 'Insufficient privileges to create dual transactions' };
        
    case 'viewAllTransactions':
      return canViewAllTransactions(userData)
        ? { authorized: true }
        : { authorized: false, error: 'Insufficient privileges to view all transactions' };
        
    case 'manageCustomers':
      return canManageCustomers(userData)
        ? { authorized: true }
        : { authorized: false, error: 'Insufficient privileges to manage customers' };
        
    default:
      return { authorized: false, error: 'Unknown permission requested' };
  }
}

/**
 * Middleware helper to extract and validate user data from request headers
 * 
 * @param request - Next.js request object
 * @returns User data object or null if not found
 */
export function extractUserData(request: Request): Record<string, unknown> | null {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return null;
    }
    
    const userData = JSON.parse(userDataHeader);
    
    // Validate required fields
    if (!userData.id || !userData.user_type) {
      console.warn('Invalid user data in request headers:', userData);
      return null;
    }
    
    return userData;
  } catch (error) {
    console.error('Error parsing user data from headers:', error);
    return null;
  }
}

/**
 * Create standardized authorization error response
 * 
 * @param error - Error message
 * @param status - HTTP status code (default: 403)
 * @returns NextResponse with error
 */
export function createAuthErrorResponse(error: string, status: number = 403) {
  return Response.json(
    { success: false, error },
    { status }
  );
}

/**
 * Validate and sanitize price ratio input
 * Ensures price ratio is within acceptable bounds
 * 
 * @param priceRatio - Raw price ratio input
 * @param allowNegative - Whether negative ratios are allowed (default: false)
 * @returns Validated price ratio or null if invalid
 */
export function validatePriceRatioInput(priceRatio: string | number | null | undefined, allowNegative: boolean = false): number | null {
  if (priceRatio === null || priceRatio === undefined) {
    return null;
  }
  const ratio = parseFloat(String(priceRatio));
  
  if (isNaN(ratio)) {
    return null;
  }
  
  // Set reasonable bounds
  const minRatio = allowNegative ? -50 : 0;
  const maxRatio = 500; // 500% markup maximum
  
  if (ratio < minRatio || ratio > maxRatio) {
    return null;
  }
  
  return ratio;
}

/**
 * Log pricing-related actions for audit trail
 * 
 * @param action - Action performed
 * @param userData - User performing the action
 * @param details - Additional details
 */
export function logPricingAction(action: string, userData: Record<string, unknown> | null, details: Record<string, unknown> = {}) {
  console.log(`[PRICING AUDIT] ${action}`, {
    timestamp: new Date().toISOString(),
    userId: userData?.id,
    userType: userData?.user_type,
    userEmail: userData?.email,
    action,
    details
  });
}

/**
 * Mask sensitive pricing information from logs
 * 
 * @param data - Data object to mask
 * @returns Masked data object
 */
export function maskSensitivePricingData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const masked = { ...data };
  
  // Mask sensitive fields
  const sensitiveFields = ['base_amount', 'basePrice', 'supervisorAmount', 'markup_amount'];
  
  sensitiveFields.forEach(field => {
    if (masked[field] !== undefined) {
      masked[field] = '[MASKED]';
    }
  });
  
  return masked;
}