import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { calculateCustomerPrice, getPriceRatio } from "@/lib/pricing-utils"

const RAPIDDEALS_API_URL = process.env.RAPIDDEALS_API_URL || "https://ship.rapiddeals.com/api/shipment"
const RAPIDDEALS_API_ID = process.env.RAPIDDEALS_API_ID
const RAPIDDEALS_API_KEY = process.env.RAPIDDEALS_API_KEY

export async function POST(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "User not authenticated" },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userId = user.id
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Get price ratio for this user
    const priceRatio = getPriceRatio(user)
    
    console.log("=== RAPIDDEALS INSURANCE QUOTE API ===")
    console.log("User ID:", userId)
    console.log("User Type:", user.user_type)
    console.log("Price Ratio:", priceRatio)
    console.log("Request Body:", JSON.stringify(body, null, 2))
    console.log("Environment Variables Check:")
    console.log("RAPIDDEALS_API_URL:", RAPIDDEALS_API_URL)
    console.log("RAPIDDEALS_API_ID:", RAPIDDEALS_API_ID ? "***CONFIGURED***" : "NOT CONFIGURED")
    console.log("RAPIDDEALS_API_KEY:", RAPIDDEALS_API_KEY ? "***CONFIGURED***" : "NOT CONFIGURED")

    // Validate required fields
    const requiredFields = [
      'quoteOrderId', 'originPickDateYmd', 'originUserName', 'originEmail', 
      'originPhone', 'originAddress1', 'originCity', 'originProvince', 
      'originZipCode', 'originCountry', 'destinationUserName', 'destinationEmail',
      'destinationPhone', 'destinationAddress1', 'destinationCity', 
      'destinationProvince', 'destinationZipCode', 'destinationCountry',
      'shipmentType', 'declaredValue'
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Prepare RapidDeals API request body (without credentials)
    const rapidDealsRequest = {
      quoteOrderId: body.quoteOrderId,
      originPickDateYmd: body.originPickDateYmd,
      originUserName: body.originUserName,
      originEmail: body.originEmail,
      originPhone: body.originPhone,
      originAddress1: body.originAddress1,
      originAddress2: body.originAddress2 || "",
      originCity: body.originCity,
      originProvince: body.originProvince,
      originZipCode: body.originZipCode,
      originCountry: body.originCountry,
      destinationUserName: body.destinationUserName,
      destinationEmail: body.destinationEmail,
      destinationPhone: body.destinationPhone,
      destinationAddress1: body.destinationAddress1,
      destinationAddress2: body.destinationAddress2 || "",
      destinationCity: body.destinationCity,
      destinationProvince: body.destinationProvince,
      destinationZipCode: body.destinationZipCode,
      destinationCountry: body.destinationCountry,
      shipmentType: body.shipmentType,
      declaredValue: body.declaredValue
    }

    console.log("=== CALLING RAPIDDEALS API ===")
    console.log("API URL:", `${RAPIDDEALS_API_URL}/apiInsuredAmount`)
    console.log("Request Body:", JSON.stringify(rapidDealsRequest, null, 2))
    console.log("Headers: api_Id: [CONFIGURED], user_key: [CONFIGURED]")

    // Call RapidDeals API
    try {
      const response = await fetch(`${RAPIDDEALS_API_URL}/apiInsuredAmount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api_Id": RAPIDDEALS_API_ID!,
          "user_key": RAPIDDEALS_API_KEY!
        },
        body: JSON.stringify(rapidDealsRequest)
      })

      const data = await response.json()
      
      console.log("=== RAPIDDEALS API RESPONSE ===")
      console.log("Status:", response.status)
      console.log("Response:", JSON.stringify(data, null, 2))

      if (!response.ok || data.code !== 200 || !data.success) {
        throw new Error(data.msg || "Failed to get insurance quote from RapidDeals")
      }

      // Apply pricing based on user type
      const baseInsuranceAmount = parseFloat(data.data.insuranceAmount)
      const customerInsuranceAmount = user.user_type === 'admin' 
        ? baseInsuranceAmount 
        : calculateCustomerPrice(baseInsuranceAmount, priceRatio)
      
      console.log(`Insurance pricing - Base: ${baseInsuranceAmount}, Customer: ${customerInsuranceAmount}, Ratio: ${priceRatio}%`)
      
      // Return the insurance quote data with appropriate pricing
      return NextResponse.json({
        success: true,
        data: {
          insuranceAmount: customerInsuranceAmount.toFixed(2),
          baseInsuranceAmount: baseInsuranceAmount.toFixed(2), // Include base amount for reference
          compensationCeiling: data.data.compensationCeiling,
          priceRatio: priceRatio
        }
      })

    } catch (apiError) {
      console.error("RapidDeals API Error:", apiError)
      
      // If API fails or is not configured, return mock data for development
      if (!RAPIDDEALS_API_ID || !RAPIDDEALS_API_KEY) {
        console.log("Using mock insurance quote data (API credentials not configured)")
        
        // Calculate mock insurance based on declared value
        const declaredValueNum = parseFloat(body.declaredValue)
        const insuranceRate = 0.003 // 0.3% of declared value
        const baseInsuranceAmount = Math.max(20, declaredValueNum * insuranceRate) // Minimum $20
        
        // Apply pricing for mock data too
        const customerInsuranceAmount = user.user_type === 'admin' 
          ? baseInsuranceAmount 
          : calculateCustomerPrice(baseInsuranceAmount, priceRatio)
        
        console.log(`Mock insurance pricing - Base: ${baseInsuranceAmount}, Customer: ${customerInsuranceAmount}, Ratio: ${priceRatio}%`)
        
        return NextResponse.json({
          success: true,
          data: {
            insuranceAmount: customerInsuranceAmount.toFixed(2),
            baseInsuranceAmount: baseInsuranceAmount.toFixed(2),
            compensationCeiling: body.declaredValue,
            priceRatio: priceRatio
          }
        })
      }
      
      throw apiError
    }

  } catch (error) {
    console.error("=== INSURANCE QUOTE API ERROR ===")
    console.error("Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get insurance quote" },
      { status: 500 }
    )
  }
}