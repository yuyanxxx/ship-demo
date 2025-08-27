/**
 * Loadsure Insurance API Integration
 * 
 * This module provides integration with the Loadsure API for freight insurance
 * including quoting, purchasing, and certificate management.
 */

// API Configuration
const LOADSURE_API_URL = process.env.LOADSURE_API_URL || 'https://api.loadsure.com'
const LOADSURE_API_KEY = process.env.LOADSURE_API_KEY || ''

// Type definitions based on Loadsure API documentation
export interface LoadsureUser {
  id: string
  email: string
  name?: string
  phone?: string
}

export interface LoadsureAddress {
  address1: string
  address2?: string
  city: string
  state: string
  postal: string
  country: string // ISO 3166-1 Alpha-3 (e.g., "USA")
}

export interface LoadsureAssured {
  name: string
  email: string
  phone?: string
  address: LoadsureAddress
  ein?: string
  type?: 'BUYER' | 'SELLER' | 'RECIPIENT' | 'SHIPPER'
}

export interface LoadsureMonetaryValue {
  currency: string // ISO 4217 (e.g., "USD")
  value: number
}

export interface LoadsureWeight {
  unit: 'lbs' | 'kgs'
  value: number
}

export interface LoadsureTemperatureRange {
  unit: 'C' | 'F'
  minimum?: number
  maximum?: number
}

export interface LoadsureCargo {
  cargoValue: LoadsureMonetaryValue
  commodity?: number | number[]
  otherCommodity?: string // Required if commodity is 1 (Miscellaneous)
  hsCodes?: string[]
  weight?: LoadsureWeight
  freightClass?: string | string[]
  nmfcNumber?: string
  usedGoods?: boolean
  containerization?: 'FULL_CONTAINER' | 'LESS_THAN_CONTAINER' | 'BULK' | 'BREAK_BULK'
  packaging?: string | string[]
  truckload?: 'FULL' | 'LTL' | 'PARTIAL'
  temperatureRange?: LoadsureTemperatureRange
  storedPast30days?: boolean
  termsOfSale?: string
  notes?: string
  marksAndNumbers?: string
  fullDescriptionOfCargo?: string
}

export interface LoadsureCarrierIdentifier {
  type: 'USDOT' | 'MCMXFF' | 'SCAC' | 'IMO'
  value: string
}

export interface LoadsureCarrier {
  mode: 'ROAD' | 'RAIL' | 'MARINE' | 'AIR'
  name: string
  email?: string
  phone?: string
  carrierId?: LoadsureCarrierIdentifier
  address?: LoadsureAddress
  equipmentType?: number // For ROAD mode
  otherEquipmentType?: string
  leg?: number
}

export interface LoadsureStop {
  stopType: 'PICKUP' | 'DELIVERY' | 'ADDITIONAL' | 'PORT_OF_LOADING' | 'PORT_OF_DISCHARGE'
  stopId?: string
  stopNumber?: number
  date?: string // ISO date format
  address?: LoadsureAddress
  name?: string // For port stops
  country?: string // For port stops
  locode?: string // For port stops
}

export interface LoadsureShipment {
  version: '2'
  freightId: string // BOL or freight ID
  poNumber?: string
  pickupDate: string // ISO date format
  deliveryDate: string // ISO date format
  shipper?: LoadsureAssured
  recipient?: LoadsureAssured
  cargo: LoadsureCargo
  carriers: LoadsureCarrier[]
  stops: LoadsureStop[]
}

export interface LoadsureQuoteRequest {
  strictChecking?: boolean
  accountId?: string
  customFields?: Record<string, string | number>
  user: LoadsureUser
  assured: LoadsureAssured
  shipment: LoadsureShipment
  coverageLimit?: LoadsureMonetaryValue
  additionalAuthorizedUsers?: string[]
}

export interface LoadsureInsuranceProduct {
  id: string
  name: string
  description: string
  limit: number
  deductible: number
  premium: number
  serviceFee?: number
  tax: number
  currency: string
  commodityExclusions: string[]
  termsAndConditionsLink: string
  statementOfFact?: string
}

export interface LoadsureQuoteResponse {
  insuranceProduct: LoadsureInsuranceProduct
  quoteToken: string
  paymentMethodType: 'INVOICE' | 'CREDIT_CARD'
  storedPaymentMethods?: Array<{
    id: string
    maskedCardNumber: string
    expirationDate: string
    cardHolderName: string
  }>
  expiresIn: number // seconds
}

export interface LoadsurePurchaseRequest {
  quoteToken: string
  sendEmailsTo?: ('USER' | 'ASSURED')[]
  poNumber?: string
  additionalAuthorizedUsers?: string[]
  paymentMethod?: {
    id?: string // For stored payment method
    paymentToken?: string // For new payment method
    cardHolderName?: string
    store?: boolean
    setAsDefault?: boolean
  }
  updates?: {
    shipment?: Partial<LoadsureShipment>
  }
}

export interface LoadsurePurchaseResponse {
  certificateNumber: string
  productId: string
  productName: string
  status: 'ACTIVE' | 'CANCELLED'
  limit: number
  deductible: number
  premium: number
  serviceFee?: number
  tax: number
  currency: string
  certificateLink: string
  certificateWithCoverPageLink?: string
  termsAndConditionsLink: string
  fileClaimLink?: string
  otherFiles?: Record<string, string>
}

export interface LoadsureCertificateRequest {
  userId: string
  certificateNumber: string
}

export interface LoadsureCancellationRequest extends LoadsureCertificateRequest {
  cancellationReason: 
    | 'CANASD' // Assured Changed
    | 'CANNLN' // Insurance Certificate no longer needed
    | 'CANPIE' // Certificate purchased in error
    | 'CANCHP' // Cheaper insurance found elsewhere
    | 'CANVAL' // Insured value changed
    | 'CANREQ' // Insurance was not required by the shipper
    | 'CANCOP' // Shipment lost to competition
    | 'CANREP' // Origin/Destination/Commodity Changed
    | 'CANOTH' // Other
  cancellationAdditionalInfo?: string // Required if reason is CANOTH
  emailAssured?: boolean
}

// Helper function to make API requests with retry logic
async function makeLoadsureRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  retryCount = 0
): Promise<T> {
  const url = `${LOADSURE_API_URL}${endpoint}`
  const maxRetries = 3
  
  console.log(`[Loadsure API] ${method} ${url}`)
  console.log(`[Loadsure API] Using API Key: ${LOADSURE_API_KEY ? 'Yes (length: ' + LOADSURE_API_KEY.length + ')' : 'No'}`)
  if (retryCount > 0) {
    console.log(`[Loadsure API] Retry attempt ${retryCount} of ${maxRetries}`)
  }
  if (body) {
    console.log('[Loadsure API] Request body:', JSON.stringify(body, null, 2))
  }

  try {
    // Use https module for better control over TLS
    const https = await import('https')
    const agent = new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
      timeout: 30000,
      // Force TLS 1.2 or higher
      secureProtocol: 'TLSv1_2_method'
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${LOADSURE_API_KEY}`,
        'User-Agent': 'Ship2025/1.0',
        'Connection': 'keep-alive'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // @ts-expect-error - agent is not in fetch types but is supported in Node.js
      agent: url.startsWith('https') ? agent : undefined
    })

    clearTimeout(timeoutId)

    const responseText = await response.text()
    let responseData: unknown
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      console.error('[Loadsure API] Failed to parse response:', responseText)
      throw new Error(`Invalid JSON response from Loadsure API: ${responseText.substring(0, 200)}`)
    }
    
    if (!response.ok) {
      console.error('[Loadsure API] Error response:', responseData)
      const errorData = responseData as { error?: string; message?: string; errors?: Array<{ errorCode: string; message: string }> }
      throw new Error(errorData.error || errorData.message || `Loadsure API error: ${response.status}`)
    }

    // Check if the response has a success field set to false (Loadsure specific error format)
    const apiResponse = responseData as { success?: boolean; errors?: Array<{ errorCode: string; message: string; path?: string }> }
    if (apiResponse.success === false && apiResponse.errors) {
      console.error('[Loadsure API] API returned success:false with errors:', apiResponse.errors)
      const errorMessages = apiResponse.errors.map((e) => e.message || e.errorCode).join(', ')
      throw new Error(`Loadsure API validation error: ${errorMessages}`)
    }

    console.log('[Loadsure API] Success response:', JSON.stringify(responseData, null, 2))
    return responseData as T
  } catch (error) {
    console.error('[Loadsure API] Request failed:', error)
    if (error instanceof Error && error.cause) {
      console.error('[Loadsure API] Error cause:', error.cause)
    }
    
    // Retry logic for connection errors
    const isConnectionError = error instanceof Error && (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed') ||
      error.message.includes('socket disconnected')
    )
    
    if (isConnectionError && retryCount < maxRetries) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000) // Exponential backoff with max 5s
      console.log(`[Loadsure API] Connection error detected. Retrying in ${backoffDelay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
      
      // Retry the request
      return makeLoadsureRequest<T>(endpoint, method, body, retryCount + 1)
    }
    
    throw error
  }
}

/**
 * Get an insurance quote for a shipment
 */
export async function getInsuranceQuote(
  request: LoadsureQuoteRequest
): Promise<LoadsureQuoteResponse> {
  return makeLoadsureRequest<LoadsureQuoteResponse>(
    '/api/insureLoad/quote',
    'POST',
    request
  )
}

/**
 * Purchase an insurance quote
 */
export async function purchaseInsuranceQuote(
  request: LoadsurePurchaseRequest
): Promise<LoadsurePurchaseResponse> {
  return makeLoadsureRequest<LoadsurePurchaseResponse>(
    '/api/insureLoad/purchaseQuote',
    'POST',
    request
  )
}

/**
 * Get a certificate URL
 */
export async function getCertificateUrl(
  request: LoadsureCertificateRequest
): Promise<{ url: string }> {
  return makeLoadsureRequest<{ url: string }>(
    '/api/insureLoad/certificateUrl',
    'POST',
    request
  )
}

/**
 * Get certificate details
 */
export async function getCertificateDetails(
  request: LoadsureCertificateRequest
): Promise<LoadsurePurchaseResponse> {
  return makeLoadsureRequest<LoadsurePurchaseResponse>(
    '/api/insureLoad/certificateSummary',
    'POST',
    request
  )
}

/**
 * Cancel a certificate
 */
export async function cancelCertificate(
  request: LoadsureCancellationRequest
): Promise<{
  certificateNumber: string
  status: 'CANCELLED'
  canceledBy: string
  canceledDate: string
  cancellationReason: string
}> {
  return makeLoadsureRequest(
    '/api/insureLoad/cancelCertificate',
    'POST',
    request
  )
}

/**
 * Get list of commodities
 */
export async function getCommodities(): Promise<Array<{ id: number; name: string }>> {
  return makeLoadsureRequest('/api/commodities', 'GET')
}

/**
 * Get list of commodity exclusions
 */
export async function getCommodityExclusions(): Promise<Array<{
  id: string
  name: string
  descriptions: string
}>> {
  return makeLoadsureRequest('/api/commodityExclusions', 'GET')
}

/**
 * Get list of equipment types
 */
export async function getEquipmentTypes(): Promise<Array<{ id: number; name: string }>> {
  return makeLoadsureRequest('/api/equipmentTypes', 'GET')
}

/**
 * Get list of load types
 */
export async function getLoadTypes(): Promise<Array<{ id: string; name: string }>> {
  return makeLoadsureRequest('/api/loadTypes', 'GET')
}

/**
 * Get list of freight classes
 */
export async function getFreightClasses(): Promise<Array<{ id: string; name: string }>> {
  return makeLoadsureRequest('/api/freightClasses', 'GET')
}

/**
 * Get list of terms of sale
 */
export async function getTermsOfSale(): Promise<string[]> {
  return makeLoadsureRequest('/api/termsOfSales', 'GET')
}

// Define types for quote data
interface PackageItem {
  packageName?: string
  productName?: string
  description?: string
  packageType?: string
  packagingType?: string
  length?: string | number
  width?: string | number
  height?: string | number
  weight?: string | number
  quantity?: string | number
  totalPackage?: string | number
  totalPallet?: string | number
  palletQuantity?: string | number
  declaredValue?: string | number
  freightClass?: string
}

interface QuoteAddress {
  address_line1?: string
  address1?: string
  address_line2?: string
  address2?: string
  city?: string
  state?: string
  postal_code?: string
  postal?: string
}

interface QuoteData {
  orderNumber?: string
  referenceNumber?: string
  pickupDate?: string
  deliveryDate?: string
  originAddress?: QuoteAddress
  destinationAddress?: QuoteAddress
  destinationWarehouse?: QuoteAddress & { name?: string; code?: string }
  packageItems?: PackageItem[]
  cargo?: PackageItem[]
  totalWeight?: string | number
  freightClass?: string
  serviceType?: string
  selectedQuote?: {
    carrierName?: string
    carrierSCAC?: string
  }
}

/**
 * Transform our quote data to Loadsure format
 */
export function transformQuoteToLoadsureFormat(
  quoteData: QuoteData,
  userData: { id: string; email: string; full_name: string; phone?: string }
): LoadsureQuoteRequest {
  // Map commodity based on cargo type
  const getCommodityId = (cargoDescription: string): number => {
    // This is a simplified mapping - you'd want to expand this based on actual commodity types
    const commodityMap: Record<string, number> = {
      'general': 1, // Miscellaneous
      'electronics': 16, // Medical Equipment / Medical Supplies
      'furniture': 1,
      'machinery': 1,
      'food': 1,
      'chemicals': 1,
      'textiles': 1,
      'metals': 1,
      'paper': 1,
      'plastics': 1
    }
    
    const lowerDesc = cargoDescription?.toLowerCase() || 'general'
    for (const [key, value] of Object.entries(commodityMap)) {
      if (lowerDesc.includes(key)) return value
    }
    return 1 // Default to Miscellaneous
  }

  // Calculate cargo value from items
  const calculateCargoValue = (items: PackageItem[]): number => {
    if (!items || items.length === 0) return 0
    return items.reduce((total, item) => {
      const value = parseFloat(String(item.declaredValue || '0'))
      const quantity = parseInt(String(item.quantity || item.totalPackage || '1'))
      return total + (value * quantity)
    }, 0)
  }

  // Get carrier info
  const getCarrierInfo = (quote: { carrierName?: string; carrierSCAC?: string }): LoadsureCarrier => {
    const carrier: LoadsureCarrier = {
      mode: 'ROAD',
      name: quote.carrierName || 'Unknown Carrier',
      carrierId: quote.carrierSCAC ? {
        type: 'SCAC',
        value: quote.carrierSCAC
      } : undefined,
      equipmentType: 2 // Dry van (default)
    }
    
    return carrier
  }

  // Transform address format
  const transformAddress = (addr: QuoteAddress): LoadsureAddress => ({
    address1: addr.address_line1 || addr.address1 || '',
    address2: addr.address_line2 || addr.address2 || undefined,
    city: addr.city || '',
    state: addr.state || '',
    postal: addr.postal_code || addr.postal || '',
    country: 'USA' // Default to USA
  })

  // Get stops from addresses
  const getStops = (quoteData: QuoteData): LoadsureStop[] => {
    const stops: LoadsureStop[] = []
    
    // Pickup stop
    if (quoteData.originAddress) {
      stops.push({
        stopType: 'PICKUP',
        stopId: 'STOP-001',
        stopNumber: 1,
        date: quoteData.pickupDate,
        address: transformAddress(quoteData.originAddress)
      })
    }
    
    // Delivery stop
    if (quoteData.destinationAddress || quoteData.destinationWarehouse) {
      const addr = quoteData.destinationAddress || quoteData.destinationWarehouse
      if (addr) {
        stops.push({
          stopType: 'DELIVERY',
          stopId: 'STOP-002',
          stopNumber: 2,
          date: quoteData.deliveryDate || quoteData.pickupDate, // Use pickup date if no delivery date
          address: transformAddress(addr)
        })
      }
    }
    
    return stops
  }

  const cargoValue = calculateCargoValue(quoteData.packageItems || quoteData.cargo || [])
  const commodityId = getCommodityId(quoteData.packageItems?.[0]?.packageName || '')

  return {
    strictChecking: false, // Allow partial data for quotes
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.full_name,
      phone: userData.phone
    },
    assured: {
      name: userData.full_name || 'Unknown',
      email: userData.email,
      phone: userData.phone,
      address: quoteData.originAddress ? transformAddress(quoteData.originAddress) : {
        address1: '123 Main St',
        city: 'Unknown',
        state: 'XX',
        postal: '00000',
        country: 'USA'
      },
      type: 'SHIPPER'
    },
    shipment: {
      version: '2',
      freightId: quoteData.orderNumber || `QUOTE-${Date.now()}`,
      poNumber: quoteData.referenceNumber,
      pickupDate: quoteData.pickupDate || new Date().toISOString().split('T')[0],
      deliveryDate: quoteData.deliveryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cargo: {
        cargoValue: {
          currency: 'USD',
          value: cargoValue || 1000 // Default minimum value
        },
        commodity: commodityId,
        otherCommodity: commodityId === 1 ? (quoteData.packageItems?.[0]?.packageName || 'General Merchandise') : undefined,
        weight: quoteData.totalWeight ? {
          unit: 'lbs',
          value: parseFloat(String(quoteData.totalWeight))
        } : undefined,
        freightClass: quoteData.freightClass,
        truckload: quoteData.serviceType === 'TL' ? 'FULL' : 'LTL',
        fullDescriptionOfCargo: quoteData.packageItems?.map((item) => 
          `${item.packageName || 'Item'} (${item.quantity || 1} units)`
        ).join(', ')
      },
      carriers: quoteData.selectedQuote ? [getCarrierInfo(quoteData.selectedQuote)] : [],
      stops: getStops(quoteData)
    },
    coverageLimit: cargoValue ? {
      currency: 'USD',
      value: cargoValue
    } : undefined
  }
}