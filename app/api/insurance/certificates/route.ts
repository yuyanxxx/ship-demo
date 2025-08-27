import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    // Fetch all certificates for the user with order information
    const { data: certificates, error } = await supabaseAdmin
      .from("insurance_certificates")
      .select(`
        *,
        orders:order_id (
          order_number
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching certificates:", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch certificates" },
        { status: 500 }
      )
    }

    // Format the response to include order_number at the top level
    const formattedCertificates = certificates?.map(cert => ({
      ...cert,
      order_number: cert.orders?.order_number || null,
      orders: undefined // Remove the nested orders object
    })) || []

    return NextResponse.json({
      success: true,
      certificates: formattedCertificates
    })

  } catch (error) {
    console.error("Error in certificates API:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch certificates" },
      { status: 500 }
    )
  }
}