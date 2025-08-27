// Order Placement API Integration
// Based on API documentation at /xxx-endpoint/下单/下单接口_3.md

interface OrderPlacementRequest {
  // Required - From quote response
  orderId: string
  rateId: string
  carrierSCAC: string
  carrierGuarantee: string
  
  // Payment info
  paymentMethod: number // 0: prepayment, 1: credit
  
  // Destination info
  destinationCityName: string
  destinationAddressLine1: string
  destinationAddressLine2?: string
  destinationCountry: string // Always "US"
  destinationContactEmail: string
  destinationContactName: string
  destinationContactPhone: string
  destinationLocationName: string
  destinationStateCode: string
  destinationType: string // BUSINESS, BUSINESSDOC, or RESIDENTIAL
  destinationZipCode: string
  destinationMemo?: string // Max 30 chars
  destinationExtraMemo?: string // Max 100 chars
  destinationTimeFrom?: string // Default "8:30"
  destinationTimeTo?: string // Default "17:30"
  
  // Origin info
  originAddressLine1: string
  originAddressLine2?: string
  originCityName: string
  originContactEmail: string
  originContactName: string
  originContactPhone: string
  originCountry: string // Always "US"
  originLocationName: string
  originStateCode: string
  originType: string // BUSINESS, BUSINESSDOC, or RESIDENTIAL
  originZipCode: string
  originDate: string // Format: "YYYY-MM-DD"
  originMemo?: string // Max 30 chars
  originExtraMemo?: string // Max 100 chars
  originTimeFrom?: string // Default "8:30"
  originTimeTo?: string // Default "17:30"
  
  // Shipment details
  palletQuantity: number // Max 0-6
  referenceNumber: string // Required but can be generated
  customerDump: number // 0: no self-unload, 1: self-unload required
  
  // Optional fields
  bolplNumber?: string // Customer order number
  pickupNumber?: string // System generated, don't send
  deliveryNumber?: string // System generated, don't send
  declaredValue?: number // Insurance amount, max 2 decimal places
  
  // FBA specific fields
  amzPoId?: string // FBA Amazon PO ID
  amzRefNumber?: string // FBA Amazon reference
}

interface OrderPlacementResponse {
  code: number
  success: boolean
  data: string // Success message like "Place an order successfully"
  msg: string
}

// Helper function to format phone numbers for API
function formatPhoneForAPI(phone: string | undefined): string {
  if (!phone) return '(000) 000-0000'
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length >= 10) {
    const areaCode = cleaned.substring(0, 3)
    const firstPart = cleaned.substring(3, 6)
    const secondPart = cleaned.substring(6, 10)
    return `(${areaCode}) ${firstPart}-${secondPart}`
  }
  
  return phone // Return original if can't format
}

// Helper function to determine address type
function getAddressType(classification?: string): string {
  if (classification === 'Residential') {
    return 'RESIDENTIAL'
  }
  // Default to BUSINESS for Commercial or Unknown
  return 'BUSINESS'
}

// Generate a reference number if not provided
function generateReferenceNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `REF-${timestamp}-${random}`
}

interface QuoteSubmissionData {
  orderId: string
  serviceType: string
  originAddress: {
    address_name?: string
    address_line1: string
    address_line2?: string
    city: string
    state?: string
    postal_code: string
    country: string
    address_classification?: string
  }
  destinationAddress?: {
    address_name?: string
    address_line1: string
    address_line2?: string
    city: string
    state?: string
    postal_code: string
    country: string
    address_classification?: string
  } | null
  destinationWarehouse?: {
    id: string
    name: string
    code: string
    address: string
    city?: string
    state: string
    postalCode?: string
  } | null
  pickupDate: string
  deliveryDate?: string | null
  deliveryAccessorials?: string[]
  packageItems: Array<{
    id: string
    packageName: string
    declaredValue: string
    totalPallet: string
    packageType: string
    totalPackage: string
    freightClass: string
    length: string
    width: string
    height: string
    weight: string
    nmfc?: string
    sub?: string
  }>
  palletQuantity: number
  timestamp: string
}

export async function placeOrder(params: {
  orderId: string
  rateId: string
  carrierSCAC: string
  carrierGuarantee: string
  customerDump: number
  quoteSubmissionData: QuoteSubmissionData
  contactInfo: {
    name: string
    email: string
    phone: string
    companyName?: string
    // Address-specific contacts
    originName?: string
    originEmail?: string
    originPhone?: string
    destinationName?: string
    destinationEmail?: string
    destinationPhone?: string
  }
  paymentMethod?: number // Default to 0 (prepayment)
  declaredValue?: number // Insurance amount
  referenceNumber?: string
  bolplNumber?: string // Customer's order number
  originMemo?: string
  destinationMemo?: string
  originExtraMemo?: string // Additional pickup memo
  destinationExtraMemo?: string // Additional delivery memo
  originTimeFrom?: string // Pickup time from
  originTimeTo?: string // Pickup time to
  destinationTimeFrom?: string // Delivery time from
  destinationTimeTo?: string // Delivery time to
  amzPoId?: string // For FBA orders
  amzRefNumber?: string // For FBA orders
}): Promise<OrderPlacementResponse> {
  const apiUrl = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'
  const apiId = process.env.RAPIDDEALS_API_ID
  const apiKey = process.env.RAPIDDEALS_API_KEY

  console.log('\n=== RAPIDDEALS ORDER PLACEMENT API: Configuration ===')
  console.log('API URL:', apiUrl)
  console.log('API ID configured:', !!apiId)
  console.log('API Key configured:', !!apiKey)

  if (!apiId || !apiKey) {
    throw new Error('RapidDeals API credentials not configured')
  }

  const { quoteSubmissionData, contactInfo } = params
  
  // Extract addresses based on service type
  const originAddr = quoteSubmissionData.originAddress
  const destAddr = quoteSubmissionData.serviceType === 'FBA' 
    ? quoteSubmissionData.destinationWarehouse 
    : quoteSubmissionData.destinationAddress

  if (!originAddr || !destAddr) {
    throw new Error('Missing address information from quote submission')
  }

  // Debug log the destination address data
  console.log('\n=== DEBUG: Destination Address Data ===')
  console.log('Service Type:', quoteSubmissionData.serviceType)
  console.log('Destination Address Object:', JSON.stringify(destAddr, null, 2))
  console.log('Has postal_code:', 'postal_code' in destAddr)
  console.log('Has postalCode:', 'postalCode' in destAddr)
  if ('postal_code' in destAddr) {
    console.log('postal_code value:', destAddr.postal_code)
  }
  if ('postalCode' in destAddr) {
    console.log('postalCode value:', (destAddr as {postalCode?: string}).postalCode)
  }

  // Build request body according to API specification
  const requestBody: OrderPlacementRequest = {
    // Quote identifiers
    orderId: params.orderId,
    rateId: params.rateId,
    carrierSCAC: params.carrierSCAC,
    carrierGuarantee: params.carrierGuarantee,
    
    // Payment
    paymentMethod: params.paymentMethod ?? 0, // Default to prepayment
    
    // Destination info
    destinationCityName: destAddr.city || '',
    destinationAddressLine1: 'address_line1' in destAddr 
      ? destAddr.address_line1 
      : destAddr.address || '',
    destinationAddressLine2: 'address_line2' in destAddr ? destAddr.address_line2 : undefined,
    destinationCountry: 'US', // Always US per requirements
    destinationContactEmail: contactInfo.destinationEmail || contactInfo.email,
    destinationContactName: contactInfo.destinationName || contactInfo.name,
    destinationContactPhone: formatPhoneForAPI(contactInfo.destinationPhone || contactInfo.phone),
    destinationLocationName: quoteSubmissionData.serviceType === 'FBA' && 'name' in destAddr
      ? destAddr.name // FBA warehouse name
      : ('address_name' in destAddr && destAddr.address_name 
          ? destAddr.address_name 
          : (contactInfo.companyName || contactInfo.destinationName || contactInfo.name)),
    destinationStateCode: destAddr.state || '',
    destinationType: quoteSubmissionData.serviceType === 'FBA'
      ? 'BUSINESS' // FBA warehouses are always business
      : getAddressType('address_classification' in destAddr ? destAddr.address_classification : undefined),
    destinationZipCode: 'postal_code' in destAddr 
      ? String(destAddr.postal_code || '').trim()
      : ('postalCode' in destAddr ? String(destAddr.postalCode || '').trim() : ''),
    destinationMemo: params.destinationMemo ? params.destinationMemo.substring(0, 30) : '',
    destinationExtraMemo: params.destinationExtraMemo ? params.destinationExtraMemo.substring(0, 100) : '',
    destinationTimeFrom: params.destinationTimeFrom || '8:30',
    destinationTimeTo: params.destinationTimeTo || '17:30',
    
    // Origin info
    originAddressLine1: originAddr.address_line1,
    originAddressLine2: originAddr.address_line2,
    originCityName: originAddr.city,
    originContactEmail: contactInfo.originEmail || contactInfo.email,
    originContactName: contactInfo.originName || contactInfo.name,
    originContactPhone: formatPhoneForAPI(contactInfo.originPhone || contactInfo.phone),
    originCountry: 'US', // Always US per requirements
    originLocationName: originAddr.address_name || contactInfo.companyName || contactInfo.originName || contactInfo.name,
    originStateCode: originAddr.state || '',
    originType: getAddressType(originAddr.address_classification),
    originZipCode: String(originAddr.postal_code || '').trim(),
    originDate: quoteSubmissionData.pickupDate, // Already in YYYY-MM-DD format
    originMemo: params.originMemo ? params.originMemo.substring(0, 30) : '',
    originExtraMemo: params.originExtraMemo ? params.originExtraMemo.substring(0, 100) : '',
    originTimeFrom: params.originTimeFrom || '8:30',
    originTimeTo: params.originTimeTo || '17:30',
    
    // Shipment details
    palletQuantity: quoteSubmissionData.palletQuantity || 1,
    referenceNumber: params.referenceNumber || generateReferenceNumber(),
    customerDump: params.customerDump,
    
    // Optional fields
    bolplNumber: params.bolplNumber,
    declaredValue: params.declaredValue,
    
    // FBA specific fields
    amzPoId: params.amzPoId,
    amzRefNumber: params.amzRefNumber
  }

  console.log('\n=== RAPIDDEALS ORDER PLACEMENT API: Request Body ===')
  console.log('CRITICAL - Destination ZIP Code Debug:')
  console.log('  - Service Type:', quoteSubmissionData.serviceType)
  console.log('  - FBA Warehouse:', quoteSubmissionData.serviceType === 'FBA' ? JSON.stringify(quoteSubmissionData.destinationWarehouse) : 'N/A')
  console.log('  - Destination Address:', quoteSubmissionData.serviceType !== 'FBA' ? JSON.stringify(destAddr) : 'N/A')
  console.log('  - ZIP being sent:', requestBody.destinationZipCode)
  console.log('  - Original Rate ID:', params.rateId)
  console.log('Full Request:', JSON.stringify(requestBody, null, 2))
  console.log('\n=== RAPIDDEALS ORDER PLACEMENT API: Sending Request ===')
  console.log('Endpoint:', `${apiUrl}/shipmentOrder`)
  console.log('Method: POST')
  console.log('Headers: Content-Type: application/json, api_Id: [HIDDEN], user_key: [HIDDEN]')

  // Add retry logic for network errors
  let retries = 3
  let lastError: Error | null = null
  
  while (retries > 0) {
    try {
      const response = await fetch(`${apiUrl}/shipmentOrder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_Id': apiId,
          'user_key': apiKey
        },
        body: JSON.stringify(requestBody)
      })

      console.log('\n=== RAPIDDEALS ORDER PLACEMENT API: Response Received ===')
      console.log('Status Code:', response.status)
      console.log('Status Text:', response.statusText)
      console.log('OK:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error Response Body:', errorText)
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as OrderPlacementResponse
      console.log('Success Response:', JSON.stringify(result, null, 2))
      
      // Check for successful response: code=200 or success=true
      if (result.code === 200 || result.success) {
        return {
          ...result,
          success: true // Ensure success flag is set
        }
      } else {
        throw new Error(result.msg || 'Failed to place order')
      }
    } catch (error) {
      lastError = error as Error
      retries--
      
      console.error(`\n=== RAPIDDEALS ORDER PLACEMENT API: Error (${3 - retries}/3) ===`)
      console.error('Error:', error)
      
      if (retries > 0) {
        console.log(`Retrying in 2 seconds... (${retries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }
  
  // All retries failed
  console.error('\n=== RAPIDDEALS ORDER PLACEMENT API: All Retries Failed ===')
  console.error('Final error:', lastError)
  throw lastError || new Error('Failed to place order after 3 attempts')
}