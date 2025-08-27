import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateBasePrice, getPriceRatio } from '@/lib/pricing-utils'
import { authorizeApiRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Use new authentication system
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userId = user.id
    
    console.log('Fetching orders for user:', userId, 'User type:', user?.user_type)

    // Build query based on user type
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        origin_location_name,
        origin_address_line1,
        origin_address_line2,
        origin_city,
        origin_state,
        origin_zip_code,
        origin_country,
        origin_contact_name,
        origin_contact_phone,
        origin_contact_email,
        destination_location_name,
        destination_address_line1,
        destination_address_line2,
        destination_city,
        destination_state,
        destination_zip_code,
        destination_country,
        destination_contact_name,
        destination_contact_phone,
        destination_contact_email,
        pickup_date,
        origin_time_from,
        origin_time_to,
        estimated_delivery_date,
        destination_time_from,
        destination_time_to,
        service_type,
        carrier_name,
        carrier_logo_url,
        order_amount,
        created_at,
        order_date,
        has_insurance,
        insurance_certificate_number,
        insurance_amount,
        user_id,
        user_email,
        company_name,
        order_items (
          id,
          declared_value,
          quantity
        )
      `)
    
    // Filter orders based on user type
    if (user?.user_type === 'admin') {
      // Admins can see all orders
      ordersQuery = ordersQuery.order('created_at', { ascending: false })
    } else {
      // Customers can only see their own orders
      ordersQuery = ordersQuery.eq('user_id', userId).order('created_at', { ascending: false })
    }

    const { data: orders, error } = await ordersQuery

    if (error) {
      console.error('Error fetching orders from database:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { success: false, error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    console.log('API - Database query results:', {
      userType: user?.user_type,
      userId: userId,
      orderCount: orders?.length || 0,
      orders: orders?.map(o => ({ 
        order_number: o.order_number, 
        status: o.status,
        user_id: o.user_id,
        user_email: o.user_email 
      }))
    })
    
    // Format orders for the frontend
    const formattedOrders = await Promise.all(orders?.map(async order => {
      // Calculate total declared value from order_items
      const totalDeclaredValue = order.order_items?.reduce((total: number, item: { declared_value?: number; quantity?: number }) => {
        return total + (item.declared_value || 0) * (item.quantity || 1)
      }, 0) || 0

      // Calculate the correct amounts based on who is viewing
      const originalAmount = order.order_amount; // This is the customer's amount (with markup)
      let displayAmount = originalAmount;
      let baseAmount = originalAmount;
      
      if (user?.user_type === 'admin') {
        // Admin should see base prices (no markup)
        // Get the actual customer's price_ratio from the database
        const { data: customerData, error: customerError } = await supabaseAdmin
          .from('users')
          .select('price_ratio')
          .eq('id', order.user_id)
          .single();

        let customerPriceRatio = 20; // Default fallback
        if (!customerError && customerData?.price_ratio) {
          customerPriceRatio = customerData.price_ratio;
        }

        baseAmount = calculateBasePrice(originalAmount, customerPriceRatio);
        displayAmount = baseAmount; // Admin sees base amount
      } else {
        // Customer sees their original amount (with markup)
        displayAmount = originalAmount;
        // For customers viewing their own orders, we could use their actual price_ratio
        // but for simplicity, we'll use a default for base calculation
        const customerPriceRatio = 20; // Standard customer markup percentage
        baseAmount = calculateBasePrice(originalAmount, customerPriceRatio);
      }

      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        origin_company: order.origin_location_name || 'N/A',
        origin_address: `${order.origin_city}, ${order.origin_state} ${order.origin_zip_code}`,
        origin_city: order.origin_city,
        origin_state: order.origin_state,
        origin_zip_code: order.origin_zip_code,
        origin_country: order.origin_country,
        origin_address_line1: order.origin_address_line1,
        origin_address_line2: order.origin_address_line2,
        origin_contact_name: order.origin_contact_name,
        origin_contact_phone: order.origin_contact_phone,
        origin_contact_email: order.origin_contact_email,
        destination_company: order.destination_location_name || 'N/A',
        destination_address: `${order.destination_city}, ${order.destination_state} ${order.destination_zip_code}`,
        destination_city: order.destination_city,
        destination_state: order.destination_state,
        destination_zip_code: order.destination_zip_code,
        destination_country: order.destination_country,
        destination_address_line1: order.destination_address_line1,
        destination_address_line2: order.destination_address_line2,
        destination_contact_name: order.destination_contact_name,
        destination_contact_phone: order.destination_contact_phone,
        destination_contact_email: order.destination_contact_email,
        pickup_date: order.pickup_date, // Keep raw date for insurance quote
        pickup_date_formatted: formatDate(order.pickup_date),
        pickup_time: formatTimeRange(order.origin_time_from, order.origin_time_to),
        delivery_date: order.estimated_delivery_date, // Keep raw date
        delivery_date_formatted: formatDate(order.estimated_delivery_date),
        delivery_status: 'estimated' as const,
        mode: order.service_type as 'LTL' | 'TL' | 'FBA',
        carrier_name: order.carrier_name,
        carrier_logo: order.carrier_logo_url,
        cost: displayAmount, // The amount to display (base for admin, customer for users)
        order_amount: originalAmount, // Original customer amount (always stored value)
        base_amount: baseAmount, // Calculated base amount
        customer_amount: originalAmount, // Customer amount (with markup)
        declared_value: totalDeclaredValue, // Add the calculated declared value
        created_at: order.created_at,
        order_date: order.order_date,
        has_insurance: order.has_insurance,
        insurance_certificate_number: order.insurance_certificate_number,
        insurance_amount: order.insurance_amount,
        user_id: order.user_id,
        user_email: order.user_email,
        company_name: order.company_name
      }
    }) || [])

    return NextResponse.json({ 
      success: true, 
      orders: formattedOrders 
    })

  } catch (error) {
    console.error('Error in orders list API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to format date
function formatDate(dateString: string): string {
  if (!dateString) return 'N/A'
  
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }
  
  return date.toLocaleDateString('en-US', options)
}

// Helper function to format time range
function formatTimeRange(timeFrom: string | null, timeTo: string | null): string {
  if (!timeFrom || !timeTo) return '9:00 AM - 5:00 PM' // Default
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }
  
  return `${formatTime(timeFrom)} - ${formatTime(timeTo)}`
}