/**
 * FedEx API Integration
 * Handles OAuth authentication and address validation
 */

interface FedExToken {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  expires_at?: number
}

interface FedExAddressValidationRequest {
  addressesToValidate: Array<{
    address: {
      streetLines: string[]
      city?: string
      stateOrProvinceCode?: string
      postalCode?: string
      countryCode: string
    }
  }>
}

interface FedExAddressValidationResponse {
  transactionId: string
  output: {
    resolvedAddresses?: Array<{
      streetLinesToken: string[]
      cityToken: string[]
      stateOrProvinceCodeToken: string
      postalCodeToken: string
      countryCode: string
      classification?: 'UNKNOWN' | 'BUSINESS' | 'RESIDENTIAL' | 'MIXED'
      businessResidentialIndicator?: 'BUSINESS' | 'RESIDENTIAL' | 'UNKNOWN'
      attributes?: {
        DPV?: boolean
        POBox?: boolean
        ResolutionMethod?: string
      }
    }>
    alerts?: Array<{
      code: string
      message: string
      alertType: string
    }>
  }
}

// Cache for OAuth token
let cachedToken: FedExToken | null = null

/**
 * Get FedEx OAuth token
 * Caches token and refreshes when expired
 */
export async function getFedExToken(): Promise<string> {
  const clientId = process.env.FEDEX_CLIENT_ID
  const clientSecret = process.env.FEDEX_CLIENT_SECRET
  const apiUrl = process.env.FEDEX_API_URL || 'https://apis.fedex.com'

  if (!clientId || !clientSecret) {
    throw new Error('FedEx API credentials not configured')
  }

  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires_at && cachedToken.expires_at > Date.now()) {
    console.log('Using cached FedEx token')
    return cachedToken.access_token
  }

  console.log('Fetching new FedEx OAuth token...')
  
  try {
    const response = await fetch(`${apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FedEx OAuth error:', errorText)
      throw new Error(`Failed to get FedEx token: ${response.status}`)
    }

    const token: FedExToken = await response.json()
    
    // Add expiration timestamp (subtract 60 seconds for safety)
    token.expires_at = Date.now() + (token.expires_in - 60) * 1000
    
    // Cache the token
    cachedToken = token
    
    console.log('FedEx token obtained successfully')
    return token.access_token
  } catch (error) {
    console.error('Error getting FedEx token:', error)
    throw error
  }
}

/**
 * Validate address using FedEx API
 */
export async function validateAddressWithFedEx(
  address: {
    address1: string
    address2?: string
    city: string
    stateCode: string
    zipCode: string
  }
): Promise<{
  success: boolean
  classification: 'Commercial' | 'Residential' | 'Unknown'
  validated: boolean
  matchedAddress?: {
    streetLines: string[]
    city: string
    state: string
    postalCode: string
    country: string
  }
  errors?: string[]
}> {
  const apiUrl = process.env.FEDEX_API_URL || 'https://apis.fedex.com'
  
  try {
    // Get OAuth token
    const token = await getFedExToken()
    
    // Prepare request
    const streetLines = [address.address1]
    if (address.address2) {
      streetLines.push(address.address2)
    }
    
    const requestBody: FedExAddressValidationRequest = {
      addressesToValidate: [{
        address: {
          streetLines,
          city: address.city,
          stateOrProvinceCode: address.stateCode,
          postalCode: address.zipCode,
          countryCode: 'US'
        }
      }]
    }
    
    console.log('FedEx Address Validation Request:', JSON.stringify(requestBody, null, 2))
    
    // Make validation request
    const response = await fetch(`${apiUrl}/address/v1/addresses/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-locale': 'en_US',
        'X-customer-transaction-id': `FTK-${Date.now()}`
      },
      body: JSON.stringify(requestBody)
    })
    
    const responseText = await response.text()
    console.log('FedEx Response Status:', response.status)
    console.log('FedEx Response:', responseText)
    
    if (!response.ok) {
      console.error('FedEx API error:', responseText)
      return {
        success: false,
        classification: 'Unknown',
        validated: false,
        errors: [`FedEx API error: ${response.status}`]
      }
    }
    
    const data: FedExAddressValidationResponse = JSON.parse(responseText)
    
    // Extract classification and validated address
    if (data.output?.resolvedAddresses && data.output.resolvedAddresses.length > 0) {
      const resolvedAddress = data.output.resolvedAddresses[0]
      
      // Determine classification
      let classification: 'Commercial' | 'Residential' | 'Unknown' = 'Unknown'
      
      // Check both classification and businessResidentialIndicator fields
      if (resolvedAddress.classification === 'BUSINESS' || 
          resolvedAddress.businessResidentialIndicator === 'BUSINESS') {
        classification = 'Commercial'
      } else if (resolvedAddress.classification === 'RESIDENTIAL' || 
                 resolvedAddress.businessResidentialIndicator === 'RESIDENTIAL') {
        classification = 'Residential'
      } else if (resolvedAddress.classification === 'MIXED') {
        // For mixed, default to Commercial
        classification = 'Commercial'
      }
      
      console.log('Address Classification:', classification)
      console.log('Raw Classification:', resolvedAddress.classification)
      console.log('Business/Residential Indicator:', resolvedAddress.businessResidentialIndicator)
      
      return {
        success: true,
        classification,
        validated: true,
        matchedAddress: {
          streetLines: resolvedAddress.streetLinesToken || [],
          city: resolvedAddress.cityToken?.join(' ') || address.city,
          state: resolvedAddress.stateOrProvinceCodeToken || address.stateCode,
          postalCode: resolvedAddress.postalCodeToken || address.zipCode,
          country: 'US'
        }
      }
    }
    
    // No resolved address found
    return {
      success: true,
      classification: 'Unknown',
      validated: false,
      errors: data.output?.alerts?.map(a => a.message)
    }
    
  } catch (error) {
    console.error('FedEx address validation error:', error)
    return {
      success: false,
      classification: 'Unknown',
      validated: false,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}