// LTL Quote API Integration
// Based on API documentation at /xxx-endpoint/报价/请求报价（LTL）_5.md

interface Address {
  id: string
  user_id: string
  address_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  postal_code: string
  country: string
  address_type: 'origin' | 'destination' | 'both'
  address_classification?: 'Commercial' | 'Residential' | 'Unknown'
  created_at: string
  updated_at: string
}

interface PackageItem {
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
  nmfc: string
  sub: string
}

interface LTLQuoteRequest {
  originAddress: Address
  destinationAddress: Address
  pickupDate: string // YYYY-MM-DD format
  deliveryAccessorials: string[]
  packageItems: PackageItem[]
}

// Package type mapping
const PACKAGE_TYPE_MAP: Record<string, string> = {
  'Bag': '1',
  'Box': '2',
  'Carton': '3',
  'Case': '4',
  'Drum': '5',
  'Keg': '6',
  'Reel': '7',
  'Roll': '8',
  'Tote': '9',
  'Tube': '10',
  'Pallet': '11',
  'Piece': '12',
  'Cylinder': '13',
  'Crate': '14'
}

// Delivery accessorials mapping
const ACCESSORIAL_MAP: Record<string, string> = {
  'Inside Delivery': '3',
  'Lift-Gate Delivery': '4',
  'Appointment Delivery': '5',
  'Guaranteed Delivery': '6',
  'Room of Choice with Signature': 'ROC',
  'White Glove Delivery': 'WGD',
  'No Signature Required': 'NSR'
}

export async function submitLTLQuote(request: LTLQuoteRequest) {
  const apiUrl = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'
  const apiId = process.env.RAPIDDEALS_API_ID
  const apiKey = process.env.RAPIDDEALS_API_KEY

  console.log('\n=== RAPIDDEALS API: Configuration ===');
  console.log('API URL:', apiUrl);
  console.log('API ID configured:', !!apiId);
  console.log('API Key configured:', !!apiKey);

  if (!apiId || !apiKey) {
    throw new Error('RapidDeals API credentials not configured')
  }

  // Map delivery accessorials
  const destinationSpecificIds = request.deliveryAccessorials
    .map(accessorial => ACCESSORIAL_MAP[accessorial])
    .filter(Boolean)
    .join(',')
  
  console.log('\n=== RAPIDDEALS API: Accessorial Mapping ===');
  console.log('Input Accessorials:', request.deliveryAccessorials);
  console.log('Mapped to IDs:', destinationSpecificIds);

  // Build commodity list from package items
  const commodityList = request.packageItems.map((item, index) => {
    const mapped = {
      commodity: item.packageName,
      declaredValue: parseInt(item.declaredValue) || 0,
      handlingUnits: item.totalPallet,
      quantity: parseInt(item.totalPackage) || 1,
      length: parseInt(item.length) || 0,
      width: parseInt(item.width) || 0,
      height: parseInt(item.height) || 0,
      weight: parseInt(item.weight) || 0,
      packageTypeId: PACKAGE_TYPE_MAP[item.packageType] || '11', // Default to PALLETS
      unitTypeId: '3', // Default to PALLETS
      isHazmat: 0, // Default to non-hazardous
      nmfcNumber: item.nmfc ? parseInt(item.nmfc) : undefined,
      nmfcSub: item.sub ? parseInt(item.sub) : undefined,
      aclass: item.freightClass || undefined
    };
    
    console.log(`\n=== Package ${index + 1} Mapping ===`);
    console.log('Input Package Type:', item.packageType);
    console.log('Mapped Package Type ID:', mapped.packageTypeId);
    console.log('Freight Class:', mapped.aclass || 'Auto-calculated');
    
    return mapped;
  })

  // Calculate total pallet quantity (sum of all handlingUnits)
  const palletQuantity = commodityList.reduce((sum, item) => {
    return sum + (parseInt(item.handlingUnits) || 0)
  }, 0)
  
  console.log('\n=== RAPIDDEALS API: Calculated Values ===');
  console.log('Total Pallet Quantity:', palletQuantity);

  // Build API request body
  const requestBody = {
    // Origin address fields
    originAddressLine1: request.originAddress.address_line1,
    originCityName: request.originAddress.city,
    originStateCode: request.originAddress.state,
    originZipCode: request.originAddress.postal_code,
    originCountry: 'US', // Always US per requirements
    originType: 'BUSINESS', // Default, can be enhanced later
    originDate: request.pickupDate, // YYYY-MM-DD format
    
    // Destination address fields
    destinationAddressLine1: request.destinationAddress.address_line1,
    destinationCityName: request.destinationAddress.city,
    destinationStateCode: request.destinationAddress.state,
    destinationZipCode: request.destinationAddress.postal_code,
    destinationCountry: 'US', // Always US per requirements
    destinationType: request.destinationAddress.address_classification === 'Residential' 
      ? 'RESIDENTIAL' 
      : 'BUSINESS', // Set based on address classification
    destinationSpecificIds: destinationSpecificIds || undefined,
    
    // Cargo details
    commodityList,
    palletQuantity,
    
    // Quote type
    selectMode: 'LTL',
    quoteType: '0' // Default LTL quote
  }

  console.log('\n=== RAPIDDEALS API: Final Request Body ===');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n=== RAPIDDEALS API: Sending Request ===');
  console.log('Endpoint:', `${apiUrl}/rates`);
  console.log('Method: POST');
  console.log('Headers: Content-Type: application/json, api_Id: [HIDDEN], user_key: [HIDDEN]');

  // Add retry logic for network errors
  let retries = 3
  let lastError: Error | null = null
  
  while (retries > 0) {
    try {
      const response = await fetch(`${apiUrl}/rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_Id': apiId,
          'user_key': apiKey
        },
        body: JSON.stringify(requestBody)
      })

      console.log('\n=== RAPIDDEALS API: Response Received ===');
      console.log('Status Code:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error Response Body:', errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Success Response:', JSON.stringify(result, null, 2));
      
      // Check if we actually got a quote number
      // RapidDeals returns data as empty object {} when there's a validation error
      if (!result.data || (typeof result.data === 'object' && Object.keys(result.data).length === 0)) {
        // This is actually an error response
        throw new Error(result.msg || 'Failed to get quote number from RapidDeals')
      }
      
      return {
        success: true,
        quoteNumber: result.data,
        message: result.msg
      }
    } catch (error) {
      lastError = error as Error
      retries--
      
      console.error(`\n=== RAPIDDEALS API: Error (${3 - retries}/3) ===`);
      console.error('Error:', error);
      
      if (retries > 0) {
        console.log(`Retrying in 2 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }
  
  // All retries failed
  console.error('\n=== RAPIDDEALS API: All Retries Failed ===');
  console.error('Final error:', lastError);
  throw lastError || new Error('Failed to submit quote after 3 attempts')
}

// Helper function to format date to YYYY-MM-DD
export function formatDateForAPI(dateString: string): string {
  if (!dateString) return ''
  
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  
  // Parse and format the date
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}