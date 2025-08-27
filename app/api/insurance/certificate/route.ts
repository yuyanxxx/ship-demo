import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cancelCertificate, type LoadsureCancellationRequest } from "@/lib/loadsure-api"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const certificateNumber = searchParams.get("certificateNumber")
    const action = searchParams.get("action")

    if (!certificateNumber) {
      return NextResponse.json(
        { success: false, error: "Certificate number is required" },
        { status: 400 }
      )
    }

    // Fetch certificate
    const { data: certificate, error } = await supabaseAdmin
      .from("insurance_certificates")
      .select("*")
      .eq("certificate_number", certificateNumber)
      .eq("user_id", userId)
      .single()

    if (error || !certificate) {
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 }
      )
    }

    if (action === "url") {
      // Return the certificate URL
      return NextResponse.json({
        success: true,
        url: certificate.certificate_link || `https://loadsure.com/certificates/${certificateNumber}`
      })
    }

    return NextResponse.json({
      success: true,
      certificate
    })

  } catch (error) {
    console.error("Error fetching certificate:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch certificate" },
      { status: 500 }
    )
  }
}

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
    const { certificateNumber, cancellationReason, cancellationAdditionalInfo, emailAssured } = body

    console.log("=== INSURANCE CERTIFICATE CANCELLATION ===")
    console.log("User ID:", userId)
    console.log("Certificate Number:", certificateNumber)
    console.log("Cancellation Reason:", cancellationReason)
    console.log("Additional Info:", cancellationAdditionalInfo)
    console.log("Email Assured:", emailAssured)
    console.log("Request Body:", JSON.stringify(body, null, 2))

    if (!certificateNumber || !cancellationReason) {
      return NextResponse.json(
        { success: false, error: "Certificate number and cancellation reason are required" },
        { status: 400 }
      )
    }

    // Fetch certificate
    console.log("Fetching certificate from database...")
    const { data: certificate, error: fetchError } = await supabaseAdmin
      .from("insurance_certificates")
      .select("*")
      .eq("certificate_number", certificateNumber)
      .eq("user_id", userId)
      .single()

    if (fetchError || !certificate) {
      console.error("Certificate not found:", fetchError)
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 }
      )
    }

    console.log("Certificate found:", {
      id: certificate.id,
      certificate_number: certificate.certificate_number,
      status: certificate.status,
      coverage_limit: certificate.coverage_limit,
      premium: certificate.premium,
      purchased_at: certificate.purchased_at
    })

    if (certificate.status?.toUpperCase() !== "ACTIVE") {
      console.log("Certificate is not active, current status:", certificate.status)
      return NextResponse.json(
        { success: false, error: "Certificate is not active" },
        { status: 400 }
      )
    }

    let loadsureCancellation = null
    
    // Try to cancel with Loadsure if we have API key and it's a real certificate
    // Real Loadsure certificates are UUIDs, mock certificates start with CERT-
    const isRealCertificate = !certificateNumber.startsWith("CERT-")
    
    if (process.env.LOADSURE_API_KEY && isRealCertificate) {
      try {
        const cancellationRequest: LoadsureCancellationRequest = {
          userId: userId,
          certificateNumber: certificateNumber,
          cancellationReason: cancellationReason,
          cancellationAdditionalInfo: cancellationAdditionalInfo || "N/A", // Loadsure doesn't allow empty string
          emailAssured: emailAssured || false
        }
        
        console.log("=== CALLING LOADSURE CANCELLATION API ===")
        console.log("Request:", JSON.stringify(cancellationRequest, null, 2))
        
        loadsureCancellation = await cancelCertificate(cancellationRequest)
        
        console.log("=== LOADSURE CANCELLATION SUCCESS ===")
        console.log("Certificate Number:", loadsureCancellation.certificateNumber)
        console.log("Status:", loadsureCancellation.status)
        console.log("Cancelled By:", loadsureCancellation.canceledBy)
        console.log("Cancelled Date:", loadsureCancellation.canceledDate)
        console.log("Cancellation Reason:", loadsureCancellation.cancellationReason)
        console.log("Full Response:", JSON.stringify(loadsureCancellation, null, 2))
        
      } catch (loadsureError) {
        console.error("=== LOADSURE CANCELLATION FAILED ===")
        console.error("Error:", loadsureError)
        
        // If it's a real certificate and Loadsure cancellation failed, we should not proceed
        if (isRealCertificate) {
          const errorMessage = loadsureError instanceof Error ? loadsureError.message : "Failed to cancel with Loadsure"
          return NextResponse.json(
            { success: false, error: `Failed to cancel certificate with insurance provider: ${errorMessage}` },
            { status: 400 }
          )
        }
      }
    } else {
      if (!process.env.LOADSURE_API_KEY) {
        console.log("No Loadsure API key configured, proceeding with local cancellation")
      } else if (!isRealCertificate) {
        console.log("Mock certificate detected, proceeding with local cancellation")
      }
    }

    // Only update local database if:
    // 1. It's a mock certificate (CERT-xxx), OR
    // 2. Loadsure cancellation was successful
    if (!isRealCertificate || loadsureCancellation) {
      // Update certificate status in database
      console.log("=== UPDATING CERTIFICATE IN DATABASE ===")
      const updateData = {
        status: "CANCELLED",
        cancelled_at: loadsureCancellation?.canceledDate || new Date().toISOString(),
        cancellation_reason: cancellationReason,
        cancellation_additional_info: cancellationAdditionalInfo || "N/A"
      }
      
      console.log("Update Data:", JSON.stringify(updateData, null, 2))
      
      const { error: updateError } = await supabaseAdmin
        .from("insurance_certificates")
        .update(updateData)
        .eq("id", certificate.id)

      if (updateError) {
        console.error("Error updating certificate:", updateError)
        return NextResponse.json(
          { success: false, error: "Failed to cancel certificate" },
          { status: 500 }
        )
      }

      console.log("Certificate updated successfully in database")

      // Update order to remove insurance
      if (certificate.order_id) {
        console.log("Updating order to remove insurance...")
        const { error: orderError } = await supabaseAdmin
          .from("orders")
          .update({
            has_insurance: false,
            insurance_certificate_number: null
          })
          .eq("id", certificate.order_id)
          .eq("user_id", userId)
        
        if (orderError) {
          console.error("Error updating order:", orderError)
        } else {
          console.log("Order updated successfully")
        }
      }

      // Create refund transaction (within 24 hours of purchase)
      const purchaseDate = new Date(certificate.purchased_at)
      const now = new Date()
      const hoursSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60)
      
      console.log(`Hours since purchase: ${hoursSincePurchase}`)
      
      let refundAmount = 0
      if (hoursSincePurchase <= 24) {
        console.log("Creating refund transaction (within 24-hour window)...")
        
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("email")
          .eq("id", userId)
          .single()

        const transactionNumber = `TXN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
        
        // Full refund within 24 hours
        refundAmount = certificate.total_cost
        
        const { data: refundTransaction, error: refundError } = await supabaseAdmin
          .from("balance_transactions")
          .insert({
            user_id: userId,
            transaction_id: transactionNumber,
            transaction_type: "refund",
            amount: refundAmount,
            description: `Insurance refund for cancelled certificate ${certificateNumber}`,
            reference_id: certificate.id,
            order_account: `ACC-${userId.substring(0, 8)}`,
            company_name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Rapiddeals",
            status: "completed",
            user_email: user?.email || ""
          })
          .select()
          .single()
        
        if (refundError) {
          console.error("Error creating refund transaction:", refundError)
        } else {
          console.log("Refund transaction created:", {
            transaction_number: refundTransaction.transaction_id,
            amount: refundTransaction.amount
          })
        }
      } else {
        console.log("No refund - outside 24-hour refund window")
      }

      const response = {
        success: true,
        message: "Certificate cancelled successfully",
        refundAmount: refundAmount,
        wasLoadsureCancelled: !!loadsureCancellation
      }
      
      console.log("=== CERTIFICATE CANCELLATION COMPLETED ===")
      console.log("Response:", JSON.stringify(response, null, 2))

      return NextResponse.json(response)
    }
    
    // If we reach here, it means we couldn't cancel (shouldn't happen)
    return NextResponse.json(
      { success: false, error: "Unable to process cancellation" },
      { status: 400 }
    )

  } catch (error) {
    console.error("=== CERTIFICATE CANCELLATION ERROR ===")
    console.error("Error cancelling certificate:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cancel certificate" },
      { status: 500 }
    )
  }
}