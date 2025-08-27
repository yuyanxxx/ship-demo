import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = JSON.parse(userDataHeader);
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');

    let query = supabaseAdmin
      .from('payment_configs')
      .select('*')
      .eq('admin_id', userData.id)
      .order('country', { ascending: true });

    if (country) {
      query = query.eq('country', country);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payment configs:', error);
      return NextResponse.json({ error: 'Failed to fetch payment configs' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/admin/payment-config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = JSON.parse(userDataHeader);
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      country,
      payment_method,
      account_name,
      account_number,
      bank_name,
      routing_number,
      swift_code,
      additional_info,
      is_active = true
    } = body;

    if (!country || !payment_method || !account_name || !account_number) {
      return NextResponse.json({ 
        error: 'Missing required fields: country, payment_method, account_name, account_number' 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('payment_configs')
      .insert({
        admin_id: userData.id,
        country,
        payment_method,
        account_name,
        account_number,
        bank_name,
        routing_number,
        swift_code,
        additional_info,
        is_active
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'Payment config for this country and method already exists' 
        }, { status: 409 });
      }
      console.error('Error creating payment config:', error);
      return NextResponse.json({ error: 'Failed to create payment config' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/admin/payment-config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = JSON.parse(userDataHeader);
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Config ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('payment_configs')
      .update(updateData)
      .eq('id', id)
      .eq('admin_id', userData.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment config:', error);
      return NextResponse.json({ error: 'Failed to update payment config' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Payment config not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/admin/payment-config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = JSON.parse(userDataHeader);
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Config ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('payment_configs')
      .delete()
      .eq('id', id)
      .eq('admin_id', userData.id);

    if (error) {
      console.error('Error deleting payment config:', error);
      // Check for foreign key constraint error
      if (error.code === '23503' || 
          error.message?.includes('foreign key constraint') ||
          error.message?.includes('still referenced') ||
          error.details?.includes('top_up_requests')) {
        return NextResponse.json({ 
          error: 'Cannot delete: This payment configuration is being used by existing top-up requests' 
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to delete payment config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/payment-config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}