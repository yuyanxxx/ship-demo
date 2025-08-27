import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeApiRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Use new authentication system
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    if (user.user_type !== 'customer') {
      return NextResponse.json({ error: 'Only customers can submit top-up requests' }, { status: 403 });
    }

    // Handle both FormData (with files) and JSON requests
    let requestData: Record<string, string> = {};
    const files: Record<string, File> = {};
    
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with file uploads)
      const formData = await request.formData();
      
      // Extract regular fields
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          files[key] = value;
        } else {
          requestData[key] = value;
        }
      }
    } else {
      // Handle JSON requests (backward compatibility)
      requestData = await request.json();
    }
    
    const {
      payment_config_id,
      amount,
      currency = 'USD',
      payment_reference,
      customer_notes
    } = requestData;

    if (!payment_config_id || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields: payment_config_id, amount' 
      }, { status: 400 });
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const { data: config } = await supabaseAdmin
      .from('payment_configs')
      .select('*')
      .eq('id', payment_config_id)
      .eq('is_active', true)
      .single();

    if (!config) {
      return NextResponse.json({ error: 'Invalid or inactive payment config' }, { status: 400 });
    }

    // Handle file uploads - store file content as base64
    const fileInfo: Record<string, unknown> = {};
    if (Object.keys(files).length > 0) {
      for (const [fieldName, file] of Object.entries(files)) {
        // Convert file to base64 for storage
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        fileInfo[fieldName] = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          content: base64 // Store the actual file content
        };
      }
    }

    // Combine payment details including files info into customer_notes
    const allPaymentDetails = {
      ...requestData, // All form fields except the main ones
      files: fileInfo
    };
    
    // Create enhanced customer notes with all payment details
    const enhancedCustomerNotes = customer_notes 
      ? `${customer_notes}\n\nPayment Details: ${JSON.stringify(allPaymentDetails, null, 2)}`
      : `Payment Details: ${JSON.stringify(allPaymentDetails, null, 2)}`;

    const { data, error } = await supabaseAdmin
      .from('top_up_requests')
      .insert({
        customer_id: user.id,
        payment_config_id,
        amount: parseFloat(amount),
        currency,
        payment_reference,
        customer_notes: enhancedCustomerNotes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating top-up request:', error);
      return NextResponse.json({ error: 'Failed to create top-up request' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/top-up/submit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Use new authentication system
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!

    const { data, error } = await supabaseAdmin
      .from('top_up_requests')
      .select(`
        *,
        payment_config:payment_configs(*),
        users!customer_id(email, full_name)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching top-up requests:', error);
      return NextResponse.json({ error: 'Failed to fetch top-up requests' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/top-up/submit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}