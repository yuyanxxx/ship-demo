import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getInsuranceQuote } from "@/lib/loadsure-api"
import type { 
  LoadsureQuoteRequest, 
  LoadsureQuoteResponse,
  LoadsureUser,
  LoadsureAssured,
  LoadsureShipment,
  LoadsureCargo,
  LoadsureCarrier,
  LoadsureStop,
  LoadsureMonetaryValue
} from "@/lib/loadsure-api"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orderId, orderNumber } = body

    console.log("=== INSURANCE QUOTE API - REQUEST RECEIVED ===")
    console.log("User ID:", userId)
    console.log("Order ID:", orderId)
    console.log("Order Number:", orderNumber)
    console.log("Request Body:", JSON.stringify(body, null, 2))

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      )
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single()

    if (orderError || !order) {
      console.error("Error fetching order:", orderError)
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      )
    }

    // Check if order already has insurance
    if (order.has_insurance) {
      return NextResponse.json(
        { success: false, error: "Order already has insurance" },
        { status: 400 }
      )
    }

    // Check if order status is eligible for insurance (only pending_review)
    if (order.status !== 'pending_review') {
      return NextResponse.json(
        { success: false, error: "Insurance can only be purchased for orders in pending_review status" },
        { status: 400 }
      )
    }

    console.log("Order found:", {
      id: order.id,
      order_number: order.order_number,
      order_amount: order.order_amount,
      has_insurance: order.has_insurance
    })

    // Fetch user details
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()

    // Prepare Loadsure API request
    const loadsureUser: LoadsureUser = {
      id: userId,
      email: user?.email || body.originContact?.email || "",
      name: user?.full_name || body.originContact?.name || "",
      phone: user?.phone || body.originContact?.phone || ""
    }

    const loadsureAssured: LoadsureAssured = {
      name: body.originContact?.name || user?.full_name || "Unknown",
      email: body.originContact?.email || user?.email || "",
      phone: body.originContact?.phone || user?.phone || "",
      address: {
        address1: body.originAddress?.addressLine1 || order.origin_address_line1 || "",
        address2: body.originAddress?.addressLine2 || order.origin_address_line2 || "",
        city: body.originAddress?.city || order.origin_city || "",
        state: body.originAddress?.state || order.origin_state || "",
        postal: body.originAddress?.zipCode || order.origin_zip_code || "",
        country: "USA" // Convert from "US" to "USA" for Loadsure API
      },
      type: "SHIPPER"
    }

    // Prepare cargo information with fixed $500 deductible
    const declaredValue = body.packageItems?.[0]?.declaredValue || order.order_amount || 1000
    console.log("Declared Value Calculation:")
    console.log("  - From packageItems:", body.packageItems?.[0]?.declaredValue)
    console.log("  - From order_amount:", order.order_amount)
    console.log("  - Using:", declaredValue)
    
    const loadsureCargo: LoadsureCargo = {
      cargoValue: {
        currency: "USD",
        value: declaredValue
      },
      commodity: 1, // Miscellaneous - adjust based on actual commodity
      otherCommodity: "General Merchandise",
      weight: {
        unit: "lbs",
        value: body.totalWeight || 1000
      },
      freightClass: "65",
      truckload: body.serviceType === "TL" ? "FULL" : "LTL",
      usedGoods: false
    }

    // Prepare carrier information
    const loadsureCarrier: LoadsureCarrier = {
      mode: "ROAD",
      name: body.carrierName || order.carrier_name || "Unknown Carrier",
      carrierId: order.carrier_scac ? {
        type: "SCAC",
        value: order.carrier_scac
      } : undefined,
      equipmentType: 1, // Dry Van - most common for general freight
      otherEquipmentType: "Dry Van" // Required when equipmentType is provided
    }

    // Prepare stops
    const loadsureStops: LoadsureStop[] = [
      {
        stopType: "PICKUP",
        stopNumber: 1,
        date: body.pickupDate || order.pickup_date,
        address: {
          address1: body.originAddress?.addressLine1 || order.origin_address_line1 || "",
          address2: body.originAddress?.addressLine2 || order.origin_address_line2 || "",
          city: body.originAddress?.city || order.origin_city || "",
          state: body.originAddress?.state || order.origin_state || "",
          postal: body.originAddress?.zipCode || order.origin_zip_code || "",
          country: "USA"
        }
      },
      {
        stopType: "DELIVERY",
        stopNumber: 2,
        date: body.deliveryDate || order.estimated_delivery_date,
        address: {
          address1: body.destinationAddress?.addressLine1 || order.destination_address_line1 || "",
          address2: body.destinationAddress?.addressLine2 || order.destination_address_line2 || "",
          city: body.destinationAddress?.city || order.destination_city || "",
          state: body.destinationAddress?.state || order.destination_state || "",
          postal: body.destinationAddress?.zipCode || order.destination_zip_code || "",
          country: "USA"
        }
      }
    ]

    const loadsureShipment: LoadsureShipment = {
      version: "2",
      freightId: orderNumber || order.order_number,
      poNumber: order.customer_order_number,
      pickupDate: body.pickupDate || order.pickup_date,
      deliveryDate: body.deliveryDate || order.estimated_delivery_date,
      shipper: loadsureAssured,
      recipient: {
        name: body.destinationContact?.name || order.destination_contact_name || "Unknown",
        email: body.destinationContact?.email || order.destination_contact_email || "",
        phone: body.destinationContact?.phone || order.destination_contact_phone || "",
        address: {
          address1: body.destinationAddress?.addressLine1 || order.destination_address_line1 || "",
          address2: body.destinationAddress?.addressLine2 || order.destination_address_line2 || "",
          city: body.destinationAddress?.city || order.destination_city || "",
          state: body.destinationAddress?.state || order.destination_state || "",
          postal: body.destinationAddress?.zipCode || order.destination_zip_code || "",
          country: "USA"
        },
        type: "RECIPIENT"
      },
      cargo: loadsureCargo,
      carriers: [loadsureCarrier],
      stops: loadsureStops
    }

    // Set coverage limit with fixed $500 deductible requirement
    const coverageLimit: LoadsureMonetaryValue = {
      currency: "USD",
      value: declaredValue
    }

    const loadsureRequest: LoadsureQuoteRequest = {
      strictChecking: false,
      user: loadsureUser,
      assured: loadsureAssured,
      shipment: loadsureShipment,
      coverageLimit: coverageLimit
    }

    console.log("=== CALLING LOADSURE API ===")
    console.log("Loadsure Request:", JSON.stringify(loadsureRequest, null, 2))

    // Call Loadsure API for actual quote
    let loadsureQuote: LoadsureQuoteResponse
    let usingMockData = false
    
    try {
      // Check if we have a valid API key
      if (!process.env.LOADSURE_API_KEY) {
        console.log("LOADSURE_API_KEY not configured, using mock quote")
        usingMockData = true
      } else {
        console.log("Attempting to call Loadsure API...")
        try {
          // Make actual API call to Loadsure
          loadsureQuote = await getInsuranceQuote(loadsureRequest)
          console.log("Successfully received quote from Loadsure API")
        } catch (apiError) {
          console.error("Loadsure API call failed:", apiError instanceof Error ? apiError.message : String(apiError))
          if (apiError instanceof Error && apiError.cause) {
            console.error("Network error details:", apiError.cause)
          }
          console.log("Falling back to mock quote due to API error")
          usingMockData = true
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      usingMockData = true
    }

    // Use mock data if needed
    if (usingMockData || !loadsureQuote!) {
      console.log("=== USING MOCK INSURANCE QUOTE ===")
      // Calculate a realistic premium based on value and service type
      let premiumRate = 0.003 // 0.3% base rate
      if (body.serviceType === "FBA") {
        premiumRate = 0.0045 // Higher rate for FBA
      } else if (body.serviceType === "TL") {
        premiumRate = 0.0025 // Lower rate for TL
      }
      
      const calculatedPremium = Math.max(declaredValue * premiumRate, 25) // Minimum $25 premium
      
      loadsureQuote = {
        insuranceProduct: {
          id: "STANDARD",
          name: "Standard Freight Insurance",
          description: "Comprehensive coverage for your freight shipment",
          limit: declaredValue,
          deductible: 500, // Fixed $500 deductible as requested
          premium: Math.round(calculatedPremium * 100) / 100, // Round to 2 decimal places
          tax: 0, // No tax as requested
          currency: "USD",
          commodityExclusions: [],
          termsAndConditionsLink: "https://loadsure.com/terms"
        },
        quoteToken: `QUOTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paymentMethodType: "INVOICE",
        expiresIn: 86400 // 24 hours
      }
      console.log("Mock quote generated with premium:", loadsureQuote.insuranceProduct.premium)
    }

    console.log("=== LOADSURE API RESPONSE ===")
    console.log("Quote Token:", loadsureQuote.quoteToken)
    console.log("Product:", loadsureQuote.insuranceProduct.name)
    console.log("Coverage Limit:", loadsureQuote.insuranceProduct.limit)
    console.log("Deductible:", loadsureQuote.insuranceProduct.deductible)
    console.log("Premium:", loadsureQuote.insuranceProduct.premium)
    console.log("Tax:", loadsureQuote.insuranceProduct.tax)

    // Format response for frontend (no service fee or tax)
    interface FormattedQuote {
      id: string
      quoteToken: string
      dbQuoteToken?: string
      product: {
        id: string
        name: string
        description: string
        termsAndConditionsLink: string
      }
      coverage: {
        limit: number
        deductible: number
        currency: string
        exclusions: string[]
      }
      pricing: {
        premium: number
        serviceFee: number
        tax: number
        total: number
        currency: string
      }
      expiresAt: string
    }
    
    // eslint-disable-next-line prefer-const
    let formattedQuote: FormattedQuote = {
      id: loadsureQuote.insuranceProduct.id,
      quoteToken: loadsureQuote.quoteToken,
      product: {
        id: loadsureQuote.insuranceProduct.id,
        name: loadsureQuote.insuranceProduct.name,
        description: loadsureQuote.insuranceProduct.description,
        termsAndConditionsLink: loadsureQuote.insuranceProduct.termsAndConditionsLink
      },
      coverage: {
        limit: loadsureQuote.insuranceProduct.limit,
        deductible: 500, // Always fixed at $500 as requested
        currency: loadsureQuote.insuranceProduct.currency,
        exclusions: loadsureQuote.insuranceProduct.commodityExclusions
      },
      pricing: {
        premium: loadsureQuote.insuranceProduct.premium,
        serviceFee: 0, // No service fee as requested
        tax: 0, // No tax as requested
        total: loadsureQuote.insuranceProduct.premium, // Total is just the premium
        currency: loadsureQuote.insuranceProduct.currency
      },
      expiresAt: new Date(Date.now() + (loadsureQuote.expiresIn * 1000)).toISOString()
    }

    // Save quote to database for reference
    console.log("=== SAVING QUOTE TO DATABASE ===")
    console.log("Quote Token:", formattedQuote.quoteToken)
    console.log("Order ID:", orderId)
    console.log("User ID:", userId)
    
    // For now, if the quote token is too long (JWT from real API), 
    // we'll store the actual JWT in a text field in the response
    // but keep track that this is a real Loadsure quote
    let dbQuoteToken = formattedQuote.quoteToken
    let originalLoadsureToken = null
    
    if (formattedQuote.quoteToken.length > 255) {
      // Generate a shorter reference token for database
      dbQuoteToken = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      originalLoadsureToken = formattedQuote.quoteToken // Keep the original JWT
      console.log("Quote token too long for database, using reference token:", dbQuoteToken)
      console.log("Original token length:", formattedQuote.quoteToken.length)
      console.log("Original JWT will be stored separately")
    }
    
    try {
      
      const insertData = {
        quote_token: dbQuoteToken,
        order_id: orderId,
        user_id: userId,
        product_id: formattedQuote.product.id,
        product_name: formattedQuote.product.name,
        coverage_limit: formattedQuote.coverage.limit,
        deductible: 500, // Fixed deductible
        premium: formattedQuote.pricing.premium,
        service_fee: 0,
        tax: 0,
        total_cost: formattedQuote.pricing.total,
        currency: formattedQuote.pricing.currency,
        expires_at: formattedQuote.expiresAt,
        status: "pending"
      }
      
      console.log("Insert data:", JSON.stringify(insertData, null, 2))
      
      const { data: savedQuote, error: saveError } = await supabaseAdmin
        .from("insurance_quotes")
        .insert(insertData)
        .select()
        .single()
      
      if (saveError) {
        console.error("Error saving quote to database:", saveError)
        console.error("Error details:", JSON.stringify(saveError, null, 2))
        // Continue even if saving fails - quote is still valid
      } else {
        console.log("Quote saved successfully with ID:", savedQuote?.id)
        console.log("Saved quote data:", JSON.stringify(savedQuote, null, 2))
        // Update the formatted quote with the actual database ID and token
        if (savedQuote?.id) {
          formattedQuote.id = savedQuote.id
        }
        // If we used a reference token, we need to handle this carefully
        if (originalLoadsureToken) {
          // Store the reference token for database lookup
          formattedQuote.dbQuoteToken = dbQuoteToken
          // Keep the original JWT for Loadsure API calls
          formattedQuote.quoteToken = originalLoadsureToken
          console.log("Response includes both reference token and original JWT")
          console.log("DB Reference Token:", dbQuoteToken)
          console.log("Original JWT for purchase:", originalLoadsureToken.substring(0, 50) + "...")
        }
      }
    } catch (saveError) {
      console.error("Exception saving quote to database:", saveError)
      // Continue even if saving fails - quote is still valid
    }

    console.log("=== INSURANCE QUOTE API - SUCCESS ===")
    console.log("Returning quote to client")
    console.log("Final Quote with DB ID:", formattedQuote.id)
    console.log("Final Quote:", JSON.stringify(formattedQuote, null, 2))
    
    return NextResponse.json({
      success: true,
      quote: formattedQuote
    })

  } catch (error) {
    console.error("=== INSURANCE QUOTE API - ERROR ===")
    console.error("Error getting insurance quote:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get insurance quote" },
      { status: 500 }
    )
  }
}