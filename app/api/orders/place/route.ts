import { NextRequest, NextResponse } from 'next/server'
import { placeOrder } from '@/lib/rapiddeals-order-api'
import { supabaseAdmin } from '@/lib/supabase'
import { pricingEngine, type UserPricingData } from '@/lib/pricing-engine'
import { authorizeApiRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('\n=== ORDER PLACEMENT API ROUTE ===')
    console.log('Received request body:', JSON.stringify(body, null, 2))
    
    // Validate required fields
    const requiredFields = [
      'orderId', 
      'rateId', 
      'carrierSCAC', 
      'carrierGuarantee',
      'customerDump',
      'quoteSubmissionData',
      'contactInfo'
    ]
    
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
    
    // Validate contact info
    if (!body.contactInfo.name || !body.contactInfo.email || !body.contactInfo.phone) {
      throw new Error('Missing required contact information (name, email, or phone)')
    }
    
    // Use new authentication system
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    const userData = user
    
    console.log('User from auth:', user.email, 'Type:', user.user_type, 'Price Ratio:', user.price_ratio)

    // Place the order with RapidDeals API
    const result = await placeOrder({
      orderId: body.orderId,
      rateId: body.rateId,
      carrierSCAC: body.carrierSCAC,
      carrierGuarantee: body.carrierGuarantee,
      customerDump: body.customerDump,
      quoteSubmissionData: body.quoteSubmissionData,
      contactInfo: body.contactInfo,
      paymentMethod: body.paymentMethod,
      declaredValue: body.declaredValue,
      referenceNumber: body.referenceNumber,
      bolplNumber: body.orderNumber || body.bolplNumber,
      originMemo: body.originMemo,
      destinationMemo: body.destinationMemo,
      originExtraMemo: body.pickupAdditionalMemo,
      destinationExtraMemo: body.deliveryAdditionalMemo,
      originTimeFrom: body.originTimeFrom,
      originTimeTo: body.originTimeTo,
      destinationTimeFrom: body.destinationTimeFrom,
      destinationTimeTo: body.destinationTimeTo,
      amzPoId: body.amzPoId,
      amzRefNumber: body.amzRefNumber
    })
    
    console.log('Order placement result:', JSON.stringify(result, null, 2))
    
    // Check for successful response: code=200 and data contains success message
    if (result.code !== 200 && !result.success) {
      throw new Error(result.msg || 'Failed to place order with carrier')
    }
    
    // Order was placed successfully with RapidDeals
    console.log('Order placed successfully with RapidDeals, now saving to database...')
    
    // Now save the order to our database
    const quoteData = body.quoteSubmissionData
    const selectedQuote = body.selectedQuoteData || {}
    
    // Calculate delivery date
    const pickupDate = new Date(quoteData.pickupDate)
    const transitDays = parseInt(body.carrierGuarantee) || 3
    const deliveryDate = new Date(pickupDate)
    deliveryDate.setDate(deliveryDate.getDate() + transitDays)
    
    // Prepare order data for database
    const orderData = {
      // Order identification
      order_number: body.orderId,
      rapiddeals_order_id: body.orderId,
      rapiddeals_rate_id: body.rateId,
      quote_id: body.orderId,
      
      // Financial information
      order_amount: selectedQuote.totalCharge || 0,
      line_charge: selectedQuote.lineCharge || 0,
      fuel_charge: selectedQuote.fuelCharge || 0,
      accessorial_charge: selectedQuote.accessorialCharge || 0,
      insurance_amount: body.declaredValue || 0,
      
      // Dates
      order_date: new Date().toISOString().split('T')[0],
      pickup_date: quoteData.pickupDate,
      estimated_delivery_date: deliveryDate.toISOString().split('T')[0],
      
      // Origin information
      origin_location_name: quoteData.originAddress?.address_name || user.full_name,
      origin_contact_name: body.contactInfo.originName || body.contactInfo.name,
      origin_contact_phone: body.contactInfo.originPhone || body.contactInfo.phone,
      origin_contact_email: body.contactInfo.originEmail || body.contactInfo.email,
      origin_address_line1: quoteData.originAddress?.address_line1 || '',
      origin_address_line2: quoteData.originAddress?.address_line2 || null,
      origin_city: quoteData.originAddress?.city || '',
      origin_state: quoteData.originAddress?.state || '',
      origin_zip_code: quoteData.originAddress?.postal_code || '',
      origin_country: 'US', // Always use 2-letter code
      origin_type: quoteData.originAddress?.address_classification === 'Residential' ? 'RESIDENTIAL' : 'BUSINESS',
      
      // Destination information
      destination_location_name: quoteData.serviceType === 'FBA' 
        ? quoteData.destinationWarehouse?.name 
        : (quoteData.destinationAddress?.address_name || 'Destination'),
      destination_contact_name: body.contactInfo.destinationName || body.contactInfo.name,
      destination_contact_phone: body.contactInfo.destinationPhone || body.contactInfo.phone,
      destination_contact_email: body.contactInfo.destinationEmail || body.contactInfo.email,
      destination_address_line1: quoteData.serviceType === 'FBA'
        ? quoteData.destinationWarehouse?.address_line1
        : quoteData.destinationAddress?.address_line1 || '',
      destination_address_line2: quoteData.serviceType === 'FBA'
        ? null
        : quoteData.destinationAddress?.address_line2 || null,
      destination_city: quoteData.serviceType === 'FBA'
        ? quoteData.destinationWarehouse?.city
        : quoteData.destinationAddress?.city || '',
      destination_state: quoteData.serviceType === 'FBA'
        ? quoteData.destinationWarehouse?.state
        : quoteData.destinationAddress?.state || '',
      destination_zip_code: quoteData.serviceType === 'FBA'
        ? quoteData.destinationWarehouse?.postal_code
        : quoteData.destinationAddress?.postal_code || '',
      destination_country: 'US', // Always use 2-letter code
      destination_type: quoteData.serviceType === 'FBA' 
        ? 'BUSINESS'
        : (quoteData.destinationAddress?.address_classification === 'Residential' ? 'RESIDENTIAL' : 'BUSINESS'),
      
      // Carrier information
      carrier_name: selectedQuote.carrierName || '',
      carrier_scac: body.carrierSCAC,
      carrier_guarantee: body.carrierGuarantee,
      carrier_transit_days: transitDays,
      
      // Shipment details
      service_type: quoteData.serviceType || 'LTL',
      // freight_class is stored in order_items table, not orders table
      // commodity_type is not used in the application
      special_instructions: body.pickupAdditionalMemo || null,
      
      // Accessorials
      delivery_accessorials: quoteData.serviceType === 'LTL' 
        ? (quoteData.deliveryAccessorials || [])
        : [],
      
      // Reference numbers
      reference_number: body.referenceNumber,
      bol_number: body.orderNumber || null,
      customer_order_number: body.orderNumber || null,
      
      // Time windows
      origin_time_from: body.originTimeFrom ? `${body.originTimeFrom}:00` : '08:30:00',
      origin_time_to: body.originTimeTo ? `${body.originTimeTo}:00` : '17:30:00',
      destination_time_from: body.destinationTimeFrom ? `${body.destinationTimeFrom}:00` : '08:30:00',
      destination_time_to: body.destinationTimeTo ? `${body.destinationTimeTo}:00` : '17:30:00',
      
      // Memos and remarks are different:
      // - memo fields (30 chars): brief notes from the form
      // - extra_memo fields (100 chars): additional memo from modal dialog
      // - remarks fields (TEXT): detailed instructions (currently not collected in UI)
      origin_memo: body.originMemo || null,                        // 30 char brief note
      origin_extra_memo: body.pickupAdditionalMemo || null,       // 100 char additional memo
      destination_memo: body.destinationMemo || null,             // 30 char brief note
      destination_extra_memo: body.deliveryAdditionalMemo || null, // 100 char additional memo
      
      // FBA specific fields
      amz_po_id: body.amzPoId || null,
      amz_ref_number: body.amzRefNumber || null,
      destination_warehouse_code: quoteData.serviceType === 'FBA' 
        ? quoteData.destinationWarehouse?.code 
        : null,
      
      // Status
      status: 'pending_review',
      status_history: [{
        status: 'pending_review',
        timestamp: new Date().toISOString(),
        notes: 'Order placed via web portal'
      }],
      
      // User information
      user_id: user.id,
      user_email: user.email,
      company_name: user.full_name
    }
    
    // Insert order into database
    console.log('Attempting to save order to database...')
    console.log('Order data to save:', JSON.stringify(orderData, null, 2))
    
    const { data: savedOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single()
    
    if (orderError) {
      console.error('ERROR: Failed to save order to database:', orderError)
      console.error('Error details:', JSON.stringify(orderError, null, 2))
      // Note: We still return success since the order was placed with the carrier
      // But we log the error for monitoring
    } else {
      console.log('SUCCESS: Order saved to database with ID:', savedOrder?.id)
    }
    
    // Save order items if order was saved successfully
    // Check for both 'cargo' and 'packageItems' fields (packageItems is the actual field name)
    const cargoItems = quoteData.cargo || quoteData.packageItems
    
    console.log('Checking for cargo items...')
    console.log('quoteData.cargo:', quoteData.cargo)
    console.log('quoteData.packageItems:', quoteData.packageItems)
    console.log('cargoItems found:', cargoItems)
    
    if (savedOrder && cargoItems && cargoItems.length > 0) {
      interface CargoItem {
        // Frontend field names
        packageName?: string // Maps to productName
        packageType?: string // Maps to packagingType
        totalPallet?: string | number // Maps to palletQuantity
        totalPackage?: string | number // Maps to quantity
        
        // Standard fields
        productName?: string
        description?: string
        packagingType?: string
        length?: string | number
        width?: string | number
        height?: string | number
        weight?: string | number
        quantity?: string | number
        palletQuantity?: string | number
        nmfcCode?: string
        nmfcSubCode?: string
        nmfc?: string // Alternative field name
        sub?: string // Alternative field name for nmfcSubCode
        freightClass?: string
        declaredValue?: string | number
        density?: number
        isHazmat?: boolean
      }
      
      const orderItems = cargoItems.map((item: CargoItem, index: number) => ({
        order_id: savedOrder.id,
        item_number: index + 1,
        
        // Item description (handle both field name formats)
        product_name: item.packageName || item.productName || `Item ${index + 1}`,
        description: item.description || null,
        package_type: item.packageType || item.packagingType || 'Pallet',
        
        // Dimensions
        length: item.length ? parseFloat(String(item.length)) : null,
        width: item.width ? parseFloat(String(item.width)) : null,
        height: item.height ? parseFloat(String(item.height)) : null,
        
        // Weight and volume
        weight_per_unit: item.weight ? parseFloat(String(item.weight)) : null,
        
        // Quantity (handle both field name formats)
        quantity: item.totalPackage ? parseInt(String(item.totalPackage)) : (item.quantity ? parseInt(String(item.quantity)) : 1),
        pallet_quantity: item.totalPallet ? parseInt(String(item.totalPallet)) : (item.palletQuantity ? parseInt(String(item.palletQuantity)) : 1),
        
        // Classification (handle both field name formats)
        nmfc_code: item.nmfc || item.nmfcCode || null,
        nmfc_sub_code: item.sub || item.nmfcSubCode || null,
        freight_class: item.freightClass || null,
        
        // Financial
        declared_value: item.declaredValue ? parseFloat(String(item.declaredValue)) : null,
        
        // Calculated fields
        total_weight: (item.weight ? parseFloat(String(item.weight)) : 0) * (item.totalPallet ? parseInt(String(item.totalPallet)) : (item.palletQuantity ? parseInt(String(item.palletQuantity)) : 1)),
        density: item.density || null,
        
        // Hazmat
        is_hazmat: item.isHazmat || false
      }))
      
      console.log('Attempting to save order items...')
      console.log('Number of items to save:', orderItems.length)
      console.log('Order items data:', JSON.stringify(orderItems, null, 2))
      
      const { data: savedItems, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItems)
        .select()
      
      if (itemsError) {
        console.error('ERROR: Failed to save order items:', itemsError)
        console.error('Error details:', JSON.stringify(itemsError, null, 2))
      } else {
        console.log('SUCCESS: Saved', savedItems?.length, 'order items to database')
      }
    }
    
    // Create dual balance transactions for order payment
    if (savedOrder && userData) {
      try {
        console.log('Creating dual balance transactions for order...')
        
        // Get the order amount (customer sees marked-up price)
        const customerAmount = parseFloat(String(selectedQuote.totalCharge || orderData.order_amount || 0))
        
        // Calculate base amount using centralized pricing engine
        const userPricing: UserPricingData = {
          id: user.id,
          user_type: user.user_type,
          price_ratio: user.price_ratio || 0
        }
        const baseAmount = pricingEngine.calculateBasePrice(customerAmount, userPricing.price_ratio)
        
        console.log('Customer amount:', customerAmount, 'Base amount:', baseAmount, 'Price ratio:', userPricing.price_ratio)
        
        // Get supervisor user
        const { data: supervisor } = await supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('user_type', 'admin')
          .limit(1)
          .single()
        
        if (!supervisor) {
          console.error('Warning: No supervisor user found, skipping dual transactions')
        } else {
          // Generate transaction IDs
          const customerTxId = 'TXN-CUST-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          const supervisorTxId = 'TXN-SUP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          
          // Prepare data for the OLD function signature (two jsonb parameters)
          const customerData = {
            transaction_id: customerTxId,
            user_id: user.id,
            user_email: user.email,
            order_id: savedOrder.id,
            order_account: `ACC-${user.id.substring(0, 8).toUpperCase()}`,
            company_name: user.full_name || 'Customer',
            order_number: body.orderId,
            amount: -Math.abs(customerAmount), // Negative for debit
            base_amount: baseAmount,
            transaction_type: 'debit',
            description: `Order placement - ${quoteData.serviceType || 'LTL'} shipment`,
            status: 'completed',
            is_supervisor_transaction: false,
            metadata: {
              service_type: quoteData.serviceType || 'LTL',
              carrier_name: selectedQuote.carrierName || body.carrierSCAC,
              origin_city: quoteData.originAddress?.city,
              destination_city: quoteData.serviceType === 'FBA' 
                ? quoteData.destinationWarehouse?.city
                : quoteData.destinationAddress?.city
            }
          };
          
          const supervisorData = {
            transaction_id: supervisorTxId,
            user_id: supervisor.id,
            user_email: user.email,  // Store customer's email for display
            order_id: savedOrder.id,
            order_account: `ACC-${user.id.substring(0, 8).toUpperCase()}`,  // Customer's account
            company_name: user.full_name || 'Customer',  // Customer's company
            order_number: body.orderId,
            amount: -Math.abs(baseAmount), // Negative for debit
            base_amount: baseAmount,
            transaction_type: 'debit',
            description: `Order placement (base) - ${quoteData.serviceType || 'LTL'} shipment`,
            status: 'completed',
            is_supervisor_transaction: true,
            metadata: {
              actual_user_id: supervisor.id,  // Store supervisor ID in metadata
              actual_user_email: supervisor.email,
              customer_user_id: user.id,
              customer_company: user.full_name || 'Customer',
              service_type: quoteData.serviceType || 'LTL',
              carrier_name: selectedQuote.carrierName || body.carrierSCAC,
              origin_city: quoteData.originAddress?.city,
              destination_city: quoteData.serviceType === 'FBA' 
                ? quoteData.destinationWarehouse?.city
                : quoteData.destinationAddress?.city
            }
          };
          
          // Use the dual transaction function with OLD signature
          const { data: txResult, error: txError } = await supabaseAdmin.rpc('create_dual_transaction', {
            customer_data: customerData,
            supervisor_data: supervisorData
          })
          
          if (txError) {
            console.error('Warning: Failed to create dual transactions:', txError)
            // Don't fail the order, just log the error
          } else {
            console.log('SUCCESS: Dual transactions created')
          }
        }
      } catch (balanceError) {
        console.error('Warning: Error creating balance transactions:', balanceError)
        // Don't fail the order, just log the error
      }
    }
    
    return NextResponse.json({
      success: true,
      message: result.data || 'Order placed successfully',
      orderId: body.orderId,
      dbOrderId: savedOrder?.id
    })
    
  } catch (error) {
    console.error('Error in order placement API route:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to place order' 
      },
      { status: 500 }
    )
  }
}