import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { purchaseInsuranceQuote, type LoadsurePurchaseRequest } from "@/lib/loadsure-api"

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
    const { quoteToken, dbQuoteToken, orderId } = body // Accept both tokens

    console.log("=== INSURANCE PURCHASE API ===")
    console.log("User ID:", userId)
    console.log("Quote Token:", quoteToken?.substring(0, 50) + (quoteToken?.length > 50 ? "..." : ""))
    console.log("DB Quote Token:", dbQuoteToken)
    console.log("Order ID:", orderId)

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      )
    }
    
    // Use dbQuoteToken for database lookup if provided, otherwise use quoteToken
    const tokenForDbLookup = dbQuoteToken || quoteToken
    
    if (!tokenForDbLookup) {
      return NextResponse.json(
        { success: false, error: "Quote token is required" },
        { status: 400 }
      )
    }

    // First, let's check what quotes exist for this user
    console.log("Checking existing quotes for user:", userId)
    const { data: allQuotes, error: allQuotesError } = await supabaseAdmin
      .from("insurance_quotes")
      .select("id, quote_token, order_id, user_id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
    
    console.log(`Found ${allQuotes?.length || 0} recent quotes for user`)
    if (allQuotes && allQuotes.length > 0) {
      console.log("Recent quote tokens:", allQuotes.map(q => q.quote_token))
    }
    if (allQuotesError) {
      console.error("Error fetching all quotes:", allQuotesError)
    }

    // Fetch the specific quote - try multiple approaches
    console.log("Fetching quote with DB token:", tokenForDbLookup)
    console.log("Token type:", typeof tokenForDbLookup)
    console.log("Token length:", tokenForDbLookup?.length)
    
    // First try with both token and user_id
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("insurance_quotes")
      .select("*")
      .eq("quote_token", tokenForDbLookup)
      .eq("user_id", userId)
      .single()

    console.log("Quote fetch result:", {
      found: !!quote,
      error: quoteError,
      quote: quote ? {
        id: quote.id,
        quote_token: quote.quote_token,
        order_id: quote.order_id,
        user_id: quote.user_id,
        status: quote.status
      } : null
    })

    if (quoteError || !quote) {
      console.error("Error fetching quote:", quoteError)
      console.error("Error details:", JSON.stringify(quoteError, null, 2))
      
      // Try fetching without user_id constraint to see if the quote exists at all
      const { data: quoteWithoutUser, error: quoteWithoutUserError } = await supabaseAdmin
        .from("insurance_quotes")
        .select("id, quote_token, user_id, order_id")
        .eq("quote_token", quoteToken)
        .single()
      
      if (quoteWithoutUser) {
        console.log("Quote found but with different user_id:", quoteWithoutUser)
      } else {
        console.log("Quote not found at all in database")
      }
      
      return NextResponse.json(
        { success: false, error: "Quote not found or expired" },
        { status: 404 }
      )
    }

    // Check if quote is expired
    if (new Date(quote.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Quote has expired" },
        { status: 400 }
      )
    }

    console.log("=== PREPARING LOADSURE PURCHASE REQUEST ===")
    
    // Use the actual JWT token if provided, otherwise check if we have a real token
    const actualLoadsureToken = quoteToken || tokenForDbLookup
    const isRealLoadsureToken = actualLoadsureToken.startsWith("eyJ") // JWT tokens start with this
    
    if (!isRealLoadsureToken) {
      console.log("Not a real Loadsure JWT token, will use mock purchase")
      console.log("Token starts with:", actualLoadsureToken.substring(0, 10))
    } else {
      console.log("Real Loadsure JWT token detected")
      console.log("JWT starts with:", actualLoadsureToken.substring(0, 50) + "...")
    }
    
    let loadsureCertificate = null
    // Generate a shorter, more readable certificate number
    const randomPart = Math.random().toString(36).substr(2, 7).toUpperCase()
    let certificateNumber = `CERT-${randomPart}`
    
    // Try to purchase from Loadsure if we have a real token
    if (isRealLoadsureToken && process.env.LOADSURE_API_KEY) {
      try {
        const purchaseRequest: LoadsurePurchaseRequest = {
          quoteToken: actualLoadsureToken,
          sendEmailsTo: body.sendEmailsTo || ["USER"],
          poNumber: body.poNumber,
          additionalAuthorizedUsers: body.additionalAuthorizedUsers
        }
        
        console.log("Loadsure Purchase Request:", JSON.stringify(purchaseRequest, null, 2))
        
        loadsureCertificate = await purchaseInsuranceQuote(purchaseRequest)
        
        console.log("=== LOADSURE PURCHASE RESPONSE ===")
        console.log("Certificate Number:", loadsureCertificate.certificateNumber)
        console.log("Product:", loadsureCertificate.productName)
        console.log("Status:", loadsureCertificate.status)
        console.log("Premium:", loadsureCertificate.premium)
        console.log("Coverage Limit:", loadsureCertificate.limit)
        console.log("Certificate Link:", loadsureCertificate.certificateLink)
        console.log("Full Response:", JSON.stringify(loadsureCertificate, null, 2))
        
        // Use the real certificate number from Loadsure
        certificateNumber = loadsureCertificate.certificateNumber
        
      } catch (loadsureError) {
        console.error("Loadsure purchase failed, using mock certificate:", loadsureError)
        console.log("Proceeding with mock certificate generation")
      }
    } else {
      console.log("Using mock certificate (no real Loadsure token or API key)")
    }

    // Create insurance certificate in database
    const certificateData = {
      certificate_number: certificateNumber,
      quote_id: quote.id,
      order_id: orderId,
      user_id: userId,
      product_id: loadsureCertificate?.productId || quote.product_id,
      product_name: loadsureCertificate?.productName || quote.product_name,
      coverage_limit: loadsureCertificate?.limit || quote.coverage_limit,
      deductible: loadsureCertificate?.deductible || quote.deductible,
      premium: loadsureCertificate?.premium || quote.premium,
      service_fee: loadsureCertificate?.serviceFee || quote.service_fee || 0,
      tax: loadsureCertificate?.tax || quote.tax || 0,
      total_cost: loadsureCertificate ? 
        (loadsureCertificate.premium + (loadsureCertificate.serviceFee || 0) + (loadsureCertificate.tax || 0)) : 
        quote.total_cost,
      currency: loadsureCertificate?.currency || quote.currency,
      status: loadsureCertificate?.status || "ACTIVE",
      purchased_at: new Date().toISOString(),
      certificate_link: loadsureCertificate?.certificateLink || `https://loadsure.com/certificates/${certificateNumber}`,
      certificate_with_cover_link: loadsureCertificate?.certificateWithCoverPageLink || `https://loadsure.com/certificates/${certificateNumber}/with-cover`,
      terms_conditions_link: loadsureCertificate?.termsAndConditionsLink || "https://loadsure.com/terms",
      file_claim_link: loadsureCertificate?.fileClaimLink || "https://loadsure.com/claims/new"
    }
    
    console.log("=== SAVING CERTIFICATE TO DATABASE ===")
    console.log("Certificate Data:", JSON.stringify(certificateData, null, 2))
    
    const { data: certificate, error: certError } = await supabaseAdmin
      .from("insurance_certificates")
      .insert(certificateData)
      .select()
      .single()

    if (certError) {
      console.error("Error creating certificate:", certError)
      return NextResponse.json(
        { success: false, error: "Failed to create certificate" },
        { status: 500 }
      )
    }

    // Update order to indicate it has insurance
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        has_insurance: true,
        insurance_certificate_number: certificateNumber,
        insurance_amount: quote.total_cost
      })
      .eq("id", orderId)
      .eq("user_id", userId)

    if (orderUpdateError) {
      console.error("Error updating order:", orderUpdateError)
    }

    // Update quote status
    await supabaseAdmin
      .from("insurance_quotes")
      .update({ status: "purchased" })
      .eq("id", quote.id)

    // Create balance transaction for insurance payment
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .single()

    // Get the order number from the orders table
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("id", orderId)
      .single()

    const transactionNumber = `TXN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    
    await supabaseAdmin
      .from("balance_transactions")
      .insert({
        user_id: userId,
        transaction_id: transactionNumber,
        transaction_type: "debit",
        amount: -Math.abs(quote.total_cost), // Negative for debit
        description: `Insurance purchase for order`,
        reference_id: certificate.id,
        order_account: `ACC-${userId.substring(0, 8)}`,
        company_name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Rapiddeals",
        order_id: orderId,
        order_number: order?.order_number || `INS-${certificateNumber}`,
        status: "completed",
        user_email: user?.email || ""
      })

    const response = {
      success: true,
      certificate: {
        certificateNumber: certificate.certificate_number,
        ...certificate
      }
    }
    
    console.log("=== INSURANCE PURCHASE COMPLETED ===")
    console.log("Response:", JSON.stringify(response, null, 2))
    
    return NextResponse.json(response)

  } catch (error) {
    console.error("Error purchasing insurance:", error)
    return NextResponse.json(
      { success: false, error: "Failed to purchase insurance" },
      { status: 500 }
    )
  }
}