// FBA (Fulfillment by Amazon) Quote API Integration
// Based on LTL API with modifications for FBA requirements

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

interface FBAWarehouse {
  id: string
  name: string
  code: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  country: string
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

interface FBAQuoteRequest {
  originAddress: Address
  destinationWarehouse: FBAWarehouse  // FBA warehouse instead of regular address
  pickupDate: string // YYYY-MM-DD format
  deliveryDate: string // YYYY-MM-DD format - Final Destination Target Delivery Date
  packageItems: PackageItem[]
}

// Package type mapping (same as LTL)
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

export async function submitFBAQuote(request: FBAQuoteRequest) {
  const apiUrl = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'
  const apiId = process.env.RAPIDDEALS_API_ID
  const apiKey = process.env.RAPIDDEALS_API_KEY

  console.log('\n=== RAPIDDEALS FBA API: Configuration ===');
  console.log('API URL:', apiUrl);
  console.log('API ID configured:', !!apiId);
  console.log('API Key configured:', !!apiKey);

  if (!apiId || !apiKey) {
    throw new Error('RapidDeals API credentials not configured')
  }

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
    
    console.log(`\n=== FBA Package ${index + 1} Mapping ===`);
    console.log('Input Package Type:', item.packageType);
    console.log('Mapped Package Type ID:', mapped.packageTypeId);
    console.log('Freight Class:', mapped.aclass || 'Auto-calculated');
    
    return mapped;
  })

  // Calculate total pallet quantity (sum of all handlingUnits)
  const palletQuantity = commodityList.reduce((sum, item) => {
    return sum + (parseInt(item.handlingUnits) || 0)
  }, 0)
  
  console.log('\n=== RAPIDDEALS FBA API: Calculated Values ===');
  console.log('Total Pallet Quantity:', palletQuantity);
  console.log('Delivery Date:', request.deliveryDate);

  // Build API request body for FBA
  const requestBody = {
    // Origin address fields
    originAddressLine1: request.originAddress.address_line1,
    originCityName: request.originAddress.city,
    originStateCode: request.originAddress.state,
    originZipCode: request.originAddress.postal_code,
    originCountry: 'US', // Always US per requirements
    originType: 'BUSINESS', // FBA shipments typically from business locations
    originDate: request.pickupDate, // YYYY-MM-DD format
    
    // Destination FBA warehouse fields
    destinationAddressLine1: request.destinationWarehouse.address_line1,
    destinationCityName: request.destinationWarehouse.city,
    destinationStateCode: request.destinationWarehouse.state,
    destinationZipCode: request.destinationWarehouse.postal_code,
    destinationCountry: 'US', // Always US for FBA warehouses
    destinationType: 'BUSINESS', // FBA warehouses are always business locations
    
    // FBA-specific fields
    deliveryDate: request.deliveryDate, // Final Destination Target Delivery Date
    destinationLocationName: request.destinationWarehouse.name, // FBA warehouse name
    destinationLocationCode: request.destinationWarehouse.code, // FBA warehouse code
    
    // Cargo details
    commodityList,
    palletQuantity,
    
    // Quote type - IMPORTANT: 1 for FBA
    selectMode: 'LTL', // Still uses LTL mode for transport
    quoteType: '1' // 1 for FBA quotes (0 for standard LTL)
  }

  console.log('\n=== RAPIDDEALS FBA API: Final Request Body ===');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n=== RAPIDDEALS FBA API: Sending Request ===');
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

      console.log('\n=== RAPIDDEALS FBA API: Response Received ===');
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
      
      return {
        success: true,
        quoteNumber: result.data,
        message: result.msg
      }
    } catch (error) {
      lastError = error as Error
      retries--
      
      console.error(`\n=== RAPIDDEALS FBA API: Error (${3 - retries}/3) ===`);
      console.error('Error:', error);
      
      if (retries > 0) {
        console.log(`Retrying in 2 seconds... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }
  
  // All retries failed
  console.error('\n=== RAPIDDEALS FBA API: All Retries Failed ===');
  console.error('Final error:', lastError);
  throw lastError || new Error('Failed to submit FBA quote after 3 attempts')
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