import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cancelCertificate, type LoadsureCancellationRequest } from "@/lib/loadsure-api"

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
    const { 
      certificateNumber, 
      cancellationReason, 
      cancellationAdditionalInfo,
      emailAssured 
    } = body

    console.log("=== INSURANCE CANCELLATION API ===")
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

    // Fetch the certificate from database
    console.log("Fetching certificate from database...")
    const { data: certificate, error: certError } = await supabaseAdmin
      .from("insurance_certificates")
      .select("*")
      .eq("certificate_number", certificateNumber)
      .eq("user_id", userId)
      .single()

    if (certError || !certificate) {
      console.error("Certificate not found:", certError)
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 }
      )
    }

    console.log("Certificate found:", {
      id: certificate.id,
      certificate_number: certificate.certificate_number,
      status: certificate.status,
      order_id: certificate.order_id,
      coverage_limit: certificate.coverage_limit,
      premium: certificate.premium
    })

    // Check if certificate is already cancelled
    if (certificate.status === "CANCELLED") {
      console.log("Certificate is already cancelled")
      return NextResponse.json(
        { success: false, error: "Certificate is already cancelled" },
        { status: 400 }
      )
    }

    let loadsureCancellation = null
    
    // Try to cancel with Loadsure if we have API key
    if (process.env.LOADSURE_API_KEY) {
      try {
        const cancellationRequest: LoadsureCancellationRequest = {
          userId: userId,
          certificateNumber: certificateNumber,
          cancellationReason: cancellationReason,
          cancellationAdditionalInfo: cancellationAdditionalInfo,
          emailAssured: emailAssured || false
        }
        
        console.log("=== LOADSURE CANCELLATION REQUEST ===")
        console.log("Request:", JSON.stringify(cancellationRequest, null, 2))
        
        loadsureCancellation = await cancelCertificate(cancellationRequest)
        
        console.log("=== LOADSURE CANCELLATION RESPONSE ===")
        console.log("Certificate Number:", loadsureCancellation.certificateNumber)
        console.log("Status:", loadsureCancellation.status)
        console.log("Cancelled By:", loadsureCancellation.canceledBy)
        console.log("Cancelled Date:", loadsureCancellation.canceledDate)
        console.log("Cancellation Reason:", loadsureCancellation.cancellationReason)
        console.log("Full Response:", JSON.stringify(loadsureCancellation, null, 2))
        
      } catch (loadsureError) {
        console.error("Loadsure cancellation failed:", loadsureError)
        console.log("Proceeding with local cancellation only")
      }
    } else {
      console.log("No Loadsure API key, proceeding with local cancellation")
    }

    // Update certificate status in database
    console.log("=== UPDATING CERTIFICATE IN DATABASE ===")
    const updateData = {
      status: "CANCELLED",
      cancelled_at: loadsureCancellation?.canceledDate || new Date().toISOString(),
      cancellation_reason: cancellationReason,
      cancellation_additional_info: cancellationAdditionalInfo
    }
    
    console.log("Update Data:", JSON.stringify(updateData, null, 2))
    
    const { data: updatedCertificate, error: updateError } = await supabaseAdmin
      .from("insurance_certificates")
      .update(updateData)
      .eq("id", certificate.id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating certificate:", updateError)
      return NextResponse.json(
        { success: false, error: "Failed to update certificate" },
        { status: 500 }
      )
    }

    console.log("Certificate updated successfully")

    // Create refund transaction if within refund window (e.g., 24 hours)
    const purchaseDate = new Date(certificate.purchased_at)
    const now = new Date()
    const hoursSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60)
    
    console.log(`Hours since purchase: ${hoursSincePurchase}`)
    
    if (hoursSincePurchase <= 24) {
      console.log("Creating refund transaction...")
      
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", userId)
        .single()

      // Get the order number from the orders table
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("order_number")
        .eq("id", certificate.order_id)
        .single()

      const transactionNumber = `TXN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      
      const refundAmount = certificate.total_cost
      
      const { data: refundTransaction, error: refundError } = await supabaseAdmin
        .from("balance_transactions")
        .insert({
          user_id: userId,
          transaction_id: transactionNumber,
          transaction_type: "refund",
          amount: Math.abs(refundAmount), // Positive for refund
          description: `Insurance refund for cancelled`,
          reference_id: certificate.id,
          order_account: `ACC-${userId.substring(0, 8)}`,
          company_name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Rapiddeals",
          order_id: certificate.order_id,
          order_number: order?.order_number || `INS-${certificateNumber}`,
          status: "completed",
          user_email: user?.email || ""
        })
        .select()
        .single()

      if (refundError) {
        console.error("Error creating refund transaction:", refundError)
      } else {
        console.log("Refund transaction created:", {
          transaction_number: refundTransaction.transaction_number,
          amount: refundTransaction.amount
        })
      }
      
      // Update order to remove insurance
      const { error: orderUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          has_insurance: false,
          insurance_certificate_number: null,
          insurance_amount: 0
        })
        .eq("id", certificate.order_id)
        .eq("user_id", userId)

      if (orderUpdateError) {
        console.error("Error updating order:", orderUpdateError)
      } else {
        console.log("Order updated to remove insurance")
      }
    } else {
      console.log("No refund - outside 24-hour refund window")
    }

    const response = {
      success: true,
      certificate: {
        certificateNumber: updatedCertificate.certificate_number,
        status: updatedCertificate.status,
        cancelledAt: updatedCertificate.cancelled_at,
        cancellationReason: updatedCertificate.cancellation_reason,
        refunded: hoursSincePurchase <= 24
      }
    }
    
    console.log("=== INSURANCE CANCELLATION COMPLETED ===")
    console.log("Response:", JSON.stringify(response, null, 2))
    
    return NextResponse.json(response)

  } catch (error) {
    console.error("=== INSURANCE CANCELLATION ERROR ===")
    console.error("Error cancelling insurance:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cancel insurance" },
      { status: 500 }
    )
  }
}