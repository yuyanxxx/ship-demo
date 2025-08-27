/**
 * SINGLE SOURCE OF TRUTH FOR ALL PRICING CALCULATIONS
 * 
 * This is THE ONLY place where pricing logic should exist.
 * All components, APIs, and services MUST use this module.
 * 
 * If you're calculating prices anywhere else, YOU'RE DOING IT WRONG.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Core pricing configuration
 */
export const PRICING_CONFIG = {
  MIN_RATIO: -50,    // Maximum 50% discount
  MAX_RATIO: 500,    // Maximum 500% markup
  PRECISION: 2,      // Decimal places for currency
  DEFAULT_RATIO: 0,  // No markup by default
} as const;

/**
 * User pricing data structure
 */
export interface UserPricingData {
  id: string;
  user_type: 'admin' | 'customer';
  price_ratio: number;
}

/**
 * Price calculation result
 */
export interface PriceCalculation {
  basePrice: number;
  customerPrice: number;
  markup: number;
  markupPercentage: number;
  priceRatio: number;
}

/**
 * THE pricing engine - singleton pattern to ensure consistency
 */
export class PricingEngine {
  private static instance: PricingEngine;
  
  private constructor() {}
  
  public static getInstance(): PricingEngine {
    if (!PricingEngine.instance) {
      PricingEngine.instance = new PricingEngine();
    }
    return PricingEngine.instance;
  }

  /**
   * Calculate customer price from base price
   * This is THE function. Use it everywhere.
   */
  public calculateCustomerPrice(
    basePrice: number,
    priceRatio: number = PRICING_CONFIG.DEFAULT_RATIO
  ): number {
    // Input validation
    if (typeof basePrice !== 'number' || isNaN(basePrice) || basePrice < 0) {
      throw new Error(`Invalid base price: ${basePrice}`);
    }
    
    // Normalize and clamp ratio
    const normalizedRatio = this.normalizeRatio(priceRatio);
    
    // Calculate price: basePrice * (1 + ratio/100)
    const customerPrice = basePrice * (1 + normalizedRatio / 100);
    
    // Return with proper precision
    return this.roundToPrecision(customerPrice);
  }

  /**
   * Calculate base price from customer price
   * Inverse operation of calculateCustomerPrice
   */
  public calculateBasePrice(
    customerPrice: number,
    priceRatio: number = PRICING_CONFIG.DEFAULT_RATIO
  ): number {
    // Input validation
    if (typeof customerPrice !== 'number' || isNaN(customerPrice) || customerPrice < 0) {
      throw new Error(`Invalid customer price: ${customerPrice}`);
    }
    
    const normalizedRatio = this.normalizeRatio(priceRatio);
    
    // Prevent division by zero
    if (normalizedRatio === -100) {
      throw new Error('Cannot calculate base price with -100% ratio');
    }
    
    // Calculate: customerPrice / (1 + ratio/100)
    const basePrice = customerPrice / (1 + normalizedRatio / 100);
    
    return this.roundToPrecision(basePrice);
  }

  /**
   * Get complete price calculation details
   */
  public calculatePriceDetails(
    basePrice: number,
    priceRatio: number = PRICING_CONFIG.DEFAULT_RATIO
  ): PriceCalculation {
    const normalizedRatio = this.normalizeRatio(priceRatio);
    const customerPrice = this.calculateCustomerPrice(basePrice, normalizedRatio);
    const markup = customerPrice - basePrice;
    
    return {
      basePrice: this.roundToPrecision(basePrice),
      customerPrice,
      markup: this.roundToPrecision(markup),
      markupPercentage: normalizedRatio,
      priceRatio: normalizedRatio,
    };
  }

  /**
   * Apply pricing to a quote object (handles both numbers and strings)
   * This replaces the mess in applyPriceRatioToQuote
   */
  public applyPricingToQuote<T extends Record<string, unknown>>(
    quote: T,
    user: UserPricingData
  ): T {
    // Admins see base prices - no changes needed
    if (user.user_type === 'admin') {
      return quote;
    }
    
    const priceRatio = user.price_ratio || PRICING_CONFIG.DEFAULT_RATIO;
    const processedQuote: Record<string, unknown> = { ...quote };
    
    // Price fields that need adjustment
    const priceFields = [
      'totalCharge', 'lineCharge', 'fuelCharge', 'accessorialCharge',
      'insuranceCharge', 'rate', 'cost', 'price', 'amount',
      'baseRate', 'totalRate', 'netCharge'
    ];
    
    // Process each field
    priceFields.forEach(field => {
      if (field in processedQuote) {
        const value = processedQuote[field];
        const processedValue = this.processPriceValue(value, priceRatio);
        if (processedValue !== null) {
          processedQuote[field] = processedValue;
        }
      }
    });
    
    // Handle nested structures
    this.processNestedPricing(processedQuote, priceRatio);
    
    return processedQuote as T;
  }

  /**
   * Get pricing for a user (with caching consideration)
   */
  public getUserPricing(userData: Partial<UserPricingData>): number {
    // Admin users always get base pricing (0% markup)
    if (userData.user_type === 'admin') {
      return PRICING_CONFIG.DEFAULT_RATIO;
    }
    
    // Customer users get their configured ratio
    if (userData.user_type === 'customer') {
      return this.normalizeRatio(userData.price_ratio || PRICING_CONFIG.DEFAULT_RATIO);
    }
    
    // Unknown user type - default to no markup for safety
    return PRICING_CONFIG.DEFAULT_RATIO;
  }


  /**
   * Batch process multiple quotes
   */
  public processBatchQuotes<T extends Record<string, unknown>>(
    quotes: T[],
    user: UserPricingData
  ): T[] {
    return quotes.map(quote => this.applyPricingToQuote(quote, user));
  }

  // ===== PRIVATE HELPER METHODS =====

  private normalizeRatio(ratio: unknown): number {
    const numRatio = this.parseNumber(ratio);
    
    if (isNaN(numRatio)) {
      console.warn(`Invalid price ratio: ${ratio}, using default`);
      return PRICING_CONFIG.DEFAULT_RATIO;
    }
    
    // Clamp to valid range
    if (numRatio < PRICING_CONFIG.MIN_RATIO) {
      console.warn(`Ratio ${numRatio} below minimum, using ${PRICING_CONFIG.MIN_RATIO}`);
      return PRICING_CONFIG.MIN_RATIO;
    }
    
    if (numRatio > PRICING_CONFIG.MAX_RATIO) {
      console.warn(`Ratio ${numRatio} above maximum, using ${PRICING_CONFIG.MAX_RATIO}`);
      return PRICING_CONFIG.MAX_RATIO;
    }
    
    return numRatio;
  }

  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return NaN;
  }

  private roundToPrecision(value: number): number {
    const factor = Math.pow(10, PRICING_CONFIG.PRECISION);
    return Math.round(value * factor) / factor;
  }

  private processPriceValue(
    value: unknown,
    priceRatio: number
  ): string | number | null {
    if (value === null || value === undefined) return null;
    
    const numValue = this.parseNumber(value);
    if (isNaN(numValue) || numValue <= 0) return null;
    
    const newPrice = this.calculateCustomerPrice(numValue, priceRatio);
    
    // Preserve original type
    return typeof value === 'string' ? newPrice.toFixed(2) : newPrice;
  }

  private processNestedPricing(obj: Record<string, unknown>, priceRatio: number): void {
    // Handle charges object
    if (obj.charges && typeof obj.charges === 'object') {
      const charges = obj.charges as Record<string, unknown>;
      Object.keys(charges).forEach(key => {
        const processedValue = this.processPriceValue(charges[key], priceRatio);
        if (processedValue !== null) {
          charges[key] = processedValue;
        }
      });
    }
    
    // Handle accessorial list
    if (Array.isArray(obj.accessorialsList)) {
      obj.accessorialsList = obj.accessorialsList.map(item => {
        if (typeof item === 'object' && item !== null && 'chargeAmount' in item) {
          const processedCharge = this.processPriceValue(
            (item as Record<string, unknown>).chargeAmount,
            priceRatio
          );
          if (processedCharge !== null) {
            return { ...item, chargeAmount: processedCharge };
          }
        }
        return item;
      });
    }
    
    // Handle rates array
    if (Array.isArray(obj.rates)) {
      obj.rates = this.processBatchQuotes(
        obj.rates as Record<string, unknown>[],
        { 
          id: '', 
          user_type: 'customer', 
          price_ratio: priceRatio 
        }
      );
    }
  }
}

// Export singleton instance
export const pricingEngine = PricingEngine.getInstance();

// Export convenience functions that use the singleton
export const calculateCustomerPrice = (basePrice: number, priceRatio?: number) =>
  pricingEngine.calculateCustomerPrice(basePrice, priceRatio);

export const calculateBasePrice = (customerPrice: number, priceRatio?: number) =>
  pricingEngine.calculateBasePrice(customerPrice, priceRatio);

export const applyPricingToQuote = <T extends Record<string, unknown>>(
  quote: T,
  user: UserPricingData
) => pricingEngine.applyPricingToQuote(quote, user);

export const getUserPricing = (userData: Partial<UserPricingData>) =>
  pricingEngine.getUserPricing(userData);

export const getPriceRatio = (userData: Partial<UserPricingData>) =>
  pricingEngine.getUserPricing(userData);

/**
 * Get supervisor user ID (first admin user)
 * This is a utility function for dual transactions
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