/**
 * RapidDeals API Integration
 * This module handles all API calls to RapidDeals shipment services
 */

// Get API configuration from environment variables
const RAPIDDEALS_API_ID = process.env.RAPIDDEALS_API_ID
const RAPIDDEALS_API_KEY = process.env.RAPIDDEALS_API_KEY
const RAPIDDEALS_API_URL = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'

// Check if API credentials are configured
if (!RAPIDDEALS_API_ID && typeof window === 'undefined') {
  console.warn('RapidDeals API ID not configured. Please set RAPIDDEALS_API_ID in .env.local')
}

if (!RAPIDDEALS_API_KEY && typeof window === 'undefined') {
  console.warn('RapidDeals API key not configured. Please set RAPIDDEALS_API_KEY in .env.local')
}

/**
 * Base configuration for RapidDeals API requests
 */
export const rapidDealsConfig = {
  apiId: RAPIDDEALS_API_ID,
  apiKey: RAPIDDEALS_API_KEY,
  apiUrl: RAPIDDEALS_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-ID': RAPIDDEALS_API_ID || '',
    'X-API-KEY': RAPIDDEALS_API_KEY || '',
  }
}

/**
 * Generic function to make RapidDeals API calls
 * @param endpoint - API endpoint path (e.g., '/quotes', '/tracking')
 * @param options - Fetch options (method, body, etc.)
 * @returns Promise with API response
 */
export async function rapidDealsAPI<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!RAPIDDEALS_API_ID || !RAPIDDEALS_API_KEY) {
    throw new Error('RapidDeals API credentials not configured. Please set RAPIDDEALS_API_ID and RAPIDDEALS_API_KEY in .env.local')
  }

  // Construct full URL
  const url = `${RAPIDDEALS_API_URL}${endpoint}`
  
  // Make the API request with authentication headers
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-ID': RAPIDDEALS_API_ID,
      'X-API-KEY': RAPIDDEALS_API_KEY,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `RapidDeals API error: ${response.status}`
    
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = `RapidDeals API error: ${response.status} - ${errorJson.message || errorJson.error || errorText}`
    } catch {
      errorMessage = `RapidDeals API error: ${response.status} - ${errorText}`
    }
    
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Get shipping quotes from RapidDeals
 * @param quoteParams - Parameters for quote request
 * @returns Promise with quote data
 */
export async function getShippingQuote(quoteParams: {
  originAddress: string
  originZip?: string
  destinationAddress: string
  destinationZip?: string
  weight: number
  dimensions?: { length: number; width: number; height: number }
  palletCount?: number
  serviceType: 'FTL' | 'LTL' | 'FBA'
  pickupDate?: string
  deliveryDate?: string
  packageItems?: Array<{
    name: string
    quantity: number
    weight: number
    dimensions: { length: number; width: number; height: number }
  }>
}) {
  return rapidDealsAPI('/quotes', {
    method: 'POST',
    body: JSON.stringify(quoteParams),
  })
}

/**
 * Track shipment by tracking number
 * @param trackingNumber - Shipment tracking number
 * @returns Promise with tracking data
 */
export async function trackShipment(trackingNumber: string) {
  return rapidDealsAPI(`/tracking/${trackingNumber}`, {
    method: 'GET',
  })
}

/**
 * Create a new shipment
 * @param shipmentData - Shipment details
 * @returns Promise with created shipment data
 */
export async function createShipment(shipmentData: {
  quoteId: string
  originAddressId: string
  destinationAddressId: string
  serviceType: 'FTL' | 'LTL' | 'FBA'
  packages: Array<{
    weight: number
    dimensions: { length: number; width: number; height: number }
    quantity: number
    description?: string
  }>
  pickupDate: string
  deliveryDate?: string
  specialInstructions?: string
  insuranceRequired?: boolean
  insuranceValue?: number
}) {
  return rapidDealsAPI('/create', {
    method: 'POST',
    body: JSON.stringify(shipmentData),
  })
}

/**
 * Get list of FBA warehouses from RapidDeals
 * @returns Promise with FBA warehouse data
 */
export async function getFBAWarehouses() {
  return rapidDealsAPI('/warehouses/fba', {
    method: 'GET',
  })
}

/**
 * Validate an address with RapidDeals
 * @param address - Address to validate
 * @returns Promise with validation result
 */
export async function validateAddress(address: {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}) {
  return rapidDealsAPI('/address/validate', {
    method: 'POST',
    body: JSON.stringify(address),
  })
}

/**
 * Get insurance quote for shipment
 * @param insuranceParams - Insurance parameters
 * @returns Promise with insurance quote
 */
export async function getInsuranceQuote(insuranceParams: {
  shipmentValue: number
  originZip: string
  destinationZip: string
  serviceType: 'FTL' | 'LTL' | 'FBA'
  weight: number
}) {
  return rapidDealsAPI('/insurance/quote', {
    method: 'POST',
    body: JSON.stringify(insuranceParams),
  })
}

/**
 * Submit a claim for damaged/lost shipment
 * @param claimData - Claim details
 * @returns Promise with claim submission result
 */
export async function submitClaim(claimData: {
  shipmentId: string
  trackingNumber: string
  claimType: 'damage' | 'loss' | 'delay'
  description: string
  claimAmount: number
  incidentDate: string
  supportingDocuments?: string[]
}) {
  return rapidDealsAPI('/claims/submit', {
    method: 'POST',
    body: JSON.stringify(claimData),
  })
}

/**
 * Get shipment history for a user
 * @param userId - User ID
 * @param options - Query options
 * @returns Promise with shipment history
 */
export async function getShipmentHistory(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    status?: 'pending' | 'in_transit' | 'delivered' | 'cancelled'
    dateFrom?: string
    dateTo?: string
  }
) {
  const queryParams = new URLSearchParams()
  queryParams.append('userId', userId)
  
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, String(value))
      }
    })
  }
  
  return rapidDealsAPI(`/history?${queryParams.toString()}`, {
    method: 'GET',
  })
}

/**
 * Cancel a shipment
 * @param shipmentId - Shipment ID to cancel
 * @param reason - Cancellation reason
 * @returns Promise with cancellation result
 */
export async function cancelShipment(shipmentId: string, reason: string) {
  return rapidDealsAPI(`/cancel/${shipmentId}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/**
 * Get available service types for a route
 * @param origin - Origin zip code
 * @param destination - Destination zip code
 * @returns Promise with available services
 */
export async function getAvailableServices(origin: string, destination: string) {
  return rapidDealsAPI(`/services?origin=${origin}&destination=${destination}`, {
    method: 'GET',
  })
}

/**
 * Download shipping documents
 * @param shipmentId - Shipment ID
 * @param documentType - Type of document
 * @returns Promise with document URL or base64 data
 */
export async function downloadShipmentDocument(
  shipmentId: string,
  documentType: 'label' | 'invoice' | 'bol' | 'pod'
) {
  return rapidDealsAPI(`/documents/${shipmentId}/${documentType}`, {
    method: 'GET',
  })
}