/**
 * Pricing utilities for supervisor-customer pricing system
 * Handles price calculations, markups, and customer-specific pricing
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Calculate customer price based on base price and price ratio
 * Formula: Customer Price = Base Price × (1 + price_ratio/100)
 * 
 * @param basePrice - The base price before markup
 * @param priceRatio - The markup percentage (e.g., 10 for 10% markup)
 * @returns The marked-up customer price
 */
export function calculateCustomerPrice(basePrice: number, priceRatio: number = 0): number {
  if (typeof basePrice !== 'number' || isNaN(basePrice) || basePrice < 0) {
    throw new Error('Base price must be a valid positive number');
  }
  
  if (typeof priceRatio !== 'number' || isNaN(priceRatio)) {
    throw new Error('Price ratio must be a valid number');
  }

  // Apply markup: customer pays base price + (base price * ratio/100)
  const customerPrice = basePrice * (1 + priceRatio / 100);
  
  // Round to 2 decimal places for currency precision
  return Math.round(customerPrice * 100) / 100;
}

/**
 * Calculate base price from customer price and price ratio
 * Formula: Base Price = Customer Price ÷ (1 + price_ratio/100)
 * 
 * @param customerPrice - The customer-facing price
 * @param priceRatio - The markup percentage
 * @returns The base price before markup
 */
export function calculateBasePrice(customerPrice: number, priceRatio: number = 0): number {
  if (typeof customerPrice !== 'number' || isNaN(customerPrice) || customerPrice < 0) {
    throw new Error('Customer price must be a valid positive number');
  }
  
  if (typeof priceRatio !== 'number' || isNaN(priceRatio)) {
    throw new Error('Price ratio must be a valid number');
  }

  if (priceRatio === -100) {
    throw new Error('Price ratio cannot be -100% as it would result in division by zero');
  }

  const basePrice = customerPrice / (1 + priceRatio / 100);
  
  // Round to 2 decimal places for currency precision
  return Math.round(basePrice * 100) / 100;
}

/**
 * Get price ratio for a user from their user object or database
 * Returns 0 for admin users (no markup), user's price_ratio for customers
 * 
 * @param userData - User object containing user_type and price_ratio
 * @returns The price ratio to apply for this user
 */
export function getPriceRatio(userData: { user_type?: string; price_ratio?: number }): number {
  // Admin users see base pricing (no markup)
  if (userData.user_type === 'admin') {
    return 0;
  }
  
  // Customer users get their configured price ratio
  if (userData.user_type === 'customer') {
    return userData.price_ratio || 0;
  }
  
  // Default to 0 for unknown user types
  return 0;
}

/**
 * Format price for display based on user type and price ratio
 * Admins see base prices, customers see marked-up prices
 * 
 * @param basePrice - The base price before markup
 * @param userType - User type ('admin' or 'customer')
 * @param priceRatio - Price ratio for customers (optional)
 * @returns Formatted price string
 */
export function formatPriceForUser(
  basePrice: number, 
  userType: string, 
  priceRatio?: number
): string {
  let displayPrice: number;
  
  if (userType === 'admin') {
    // Admins see base pricing
    displayPrice = basePrice;
  } else {
    // Customers see marked-up pricing
    displayPrice = calculateCustomerPrice(basePrice, priceRatio || 0);
  }
  
  // Format as currency with 2 decimal places
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(displayPrice);
}

/**
 * Calculate markup amount (difference between customer and base price)
 * 
 * @param basePrice - The base price before markup
 * @param priceRatio - The markup percentage
 * @returns The markup amount in dollars
 */
export function calculateMarkupAmount(basePrice: number, priceRatio: number = 0): number {
  const customerPrice = calculateCustomerPrice(basePrice, priceRatio);
  return Math.round((customerPrice - basePrice) * 100) / 100;
}

/**
 * Validate and normalize price ratio
 * Ensures price ratio is within reasonable bounds
 * 
 * @param priceRatio - Raw price ratio input
 * @returns Validated and normalized price ratio
 */
export function validatePriceRatio(priceRatio: string | number): number {
  const ratio = parseFloat(String(priceRatio));
  
  if (isNaN(ratio)) {
    return 0;
  }
  
  // Reasonable bounds: -50% to +500% markup
  const minRatio = -50;
  const maxRatio = 500;
  
  if (ratio < minRatio) {
    console.warn(`Price ratio ${ratio}% is below minimum ${minRatio}%. Using ${minRatio}%.`);
    return minRatio;
  }
  
  if (ratio > maxRatio) {
    console.warn(`Price ratio ${ratio}% exceeds maximum ${maxRatio}%. Using ${maxRatio}%.`);
    return maxRatio;
  }
  
  return ratio;
}

/**
 * Apply price ratio to quote object
 * Transforms base prices in a quote to customer prices based on user type
 * 
 * @param quote - Quote object with NUMERIC price fields
 * @param userType - User type
 * @param priceRatio - Price ratio for customers
 * @returns Quote object with prices adjusted for user type
 */
export function applyPriceRatioToQuote<T extends Record<string, unknown>>(
  quote: T, 
  userType: string, 
  priceRatio: number = 0
): T {
  if (userType === 'admin') {
    // Admins see base pricing - no changes needed
    return quote;
  }
  
  // For customers, apply markup to all price fields
  const updatedQuote: Record<string, unknown> = { ...quote };
  
  // Common price fields in quotes - these MUST be numbers
  const priceFields = [
    'totalCharge',
    'lineCharge', 
    'fuelCharge',
    'accessorialCharge',
    'insuranceCharge',
    'rate',
    'cost',
    'price'
  ];
  
  priceFields.forEach(field => {
    const value = updatedQuote[field];
    // Handle both number and string price values from RapidDeals API
    if (value !== undefined && value !== null) {
      const numValue = typeof value === 'string' ? parseFloat(value) : 
                       typeof value === 'number' ? value : 0;
      if (!isNaN(numValue) && numValue > 0) {
        const newPrice = calculateCustomerPrice(numValue, priceRatio);
        // Preserve original type (string or number)
        updatedQuote[field] = typeof value === 'string' ? newPrice.toFixed(2) : newPrice;
      }
    }
  });
  
  // Handle nested price objects (like in LTL quotes)
  if (updatedQuote.charges && typeof updatedQuote.charges === 'object') {
    const charges = updatedQuote.charges as Record<string, unknown>;
    Object.keys(charges).forEach(chargeKey => {
      const charge = charges[chargeKey];
      const numValue = typeof charge === 'string' ? parseFloat(charge as string) : 
                       typeof charge === 'number' ? charge as number : 0;
      if (!isNaN(numValue) && numValue > 0) {
        const newPrice = calculateCustomerPrice(numValue, priceRatio);
        charges[chargeKey] = typeof charge === 'string' ? newPrice.toFixed(2) : newPrice;
      }
    });
    updatedQuote.charges = charges;
  }
  
  // Handle accessorial list items (array of charges)
  if (updatedQuote.accesoriesList && Array.isArray(updatedQuote.accesoriesList)) {
    updatedQuote.accesoriesList = (updatedQuote.accesoriesList as Array<Record<string, unknown>>).map(item => {
      const chargeValue = item.chargeAmount;
      const numValue = typeof chargeValue === 'string' ? parseFloat(chargeValue as string) : 
                       typeof chargeValue === 'number' ? chargeValue as number : 0;
      if (!isNaN(numValue) && numValue > 0) {
        const newPrice = calculateCustomerPrice(numValue, priceRatio);
        return {
          ...item,
          chargeAmount: typeof chargeValue === 'string' ? newPrice.toFixed(2) : newPrice
        };
      }
      return item;
    });
  }
  
  return updatedQuote as T;
}

/**
 * Get supervisor user ID for dual transactions
 * Returns the first admin user found in the system
 * 
 * @param supabaseAdmin - Supabase admin client
 * @returns Promise resolving to supervisor user ID
 */
export async function getSupervisorUserId(supabaseAdmin: SupabaseClient): Promise<string | null> {
  try {
    const { data: adminUsers, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('user_type', 'admin')
      .limit(1)
      .single();
    
    if (error || !adminUsers) {
      console.error('Failed to find supervisor user:', error);
      return null;
    }
    
    return adminUsers.id;
  } catch (error) {
    console.error('Error fetching supervisor user:', error);
    return null;
  }
}