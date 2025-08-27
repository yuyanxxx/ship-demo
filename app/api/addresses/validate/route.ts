import { NextRequest, NextResponse } from 'next/server'
import { validateAddressWithFedEx } from '@/lib/fedex-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const { address_line1, city, state, postal_code } = body
    
    if (!address_line1 || !city || !state || !postal_code) {
      return NextResponse.json(
        { error: 'Missing required address fields' },
        { status: 400 }
      )
    }

    // Prepare request for FedEx API
    const validationRequest = {
      address1: address_line1,
      address2: body.address_line2 || '',
      city: city,
      stateCode: state,
      zipCode: postal_code
    }

    console.log('Validating address:', validationRequest)

    // Call FedEx validation API
    const validationResponse = await validateAddressWithFedEx(validationRequest)
    
    console.log('Validation response:', validationResponse)
    
    // Return the validation result
    return NextResponse.json({
      success: validationResponse.success,
      validated: validationResponse.validated,
      classification: validationResponse.classification,
      matchedAddress: validationResponse.matchedAddress ? {
        addressLine1: validationResponse.matchedAddress.streetLines[0] || '',
        addressLine2: validationResponse.matchedAddress.streetLines[1] || '',
        city: validationResponse.matchedAddress.city,
        state: validationResponse.matchedAddress.state,
        postalCode: validationResponse.matchedAddress.postalCode,
        country: validationResponse.matchedAddress.country
      } : null,
      originalAddress: {
        addressLine1: address_line1,
        addressLine2: body.address_line2 || '',
        city: city,
        state: state,
        postalCode: postal_code,
        country: body.country || 'United States'
      },
      errors: validationResponse.errors
    })
  } catch (error) {
    console.error('Address validation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to validate address',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}