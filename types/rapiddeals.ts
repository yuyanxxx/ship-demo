/**
 * RapidDeals API Type Definitions
 * NO MORE STRING NUMBERS. EVER.
 */

// Raw API response types (what RapidDeals actually sends)
export interface RapidDealsRawQuote {
  orderId: string;
  rateId: string;
  carrierName: string;
  carrierSCAC: string;
  // These come as strings from their garbage API
  totalCharge: string;
  lineCharge: string;
  fuelCharge: string;
  accessorialCharge: string;
  transitDays: string;
}

// Clean internal types (what we actually use)
export interface RapidDealsQuote {
  orderId: string;
  rateId: string;
  carrierName: string;
  carrierSCAC: string;
  // These are NUMBERS, as God intended
  totalCharge: number;
  lineCharge: number;
  fuelCharge: number;
  accessorialCharge: number;
  transitDays: number;
}

// Transform function - ONE place for this conversion
export function parseRapidDealsQuote(raw: RapidDealsRawQuote): RapidDealsQuote {
  return {
    orderId: raw.orderId,
    rateId: raw.rateId,
    carrierName: raw.carrierName,
    carrierSCAC: raw.carrierSCAC,
    // Parse once, use everywhere
    totalCharge: parseFloat(raw.totalCharge) || 0,
    lineCharge: parseFloat(raw.lineCharge) || 0,
    fuelCharge: parseFloat(raw.fuelCharge) || 0,
    accessorialCharge: parseFloat(raw.accessorialCharge) || 0,
    transitDays: parseInt(raw.transitDays) || 0
  };
}

// Order placement types
export interface RapidDealsOrderRequest {
  orderId: string;
  rateId: string;
  carrierSCAC: string;
  carrierGuarantee: string;
  customerDump: number;
  paymentMethod: number;
  referenceNumber?: string;
  orderNumber?: string;
  // Add other fields as needed
}

export interface RapidDealsOrderResponse {
  code: number;
  success: boolean;
  msg: string;
  data?: {
    orderId: string;
    trackingNumber?: string;
    auditRemark?: string;
  };
}