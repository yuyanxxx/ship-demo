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
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('top_up_requests')
      .select(`
        *,
        customer:users!customer_id(*),
        payment_config:payment_configs(*),
        reviewer:users!reviewed_by(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching top-up requests:', error);
      return NextResponse.json({ error: 'Failed to fetch top-up requests' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/admin/top-up/review:', error);
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
    const { request_id, action, notes, amount } = body;

    if (!request_id || !action) {
      return NextResponse.json({ error: 'Missing required fields: request_id, action' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approve or reject' }, { status: 400 });
    }

    let result;
    if (action === 'approve') {
      if (!amount || parseFloat(amount) <= 0) {
        return NextResponse.json({ error: 'Valid amount is required for approval' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc('approve_top_up_request', {
        request_id,
        approver_id: userData.id,
        approved_amount: parseFloat(amount),
        notes
      });

      if (error) {
        console.error('Error approving top-up request:', error);
        return NextResponse.json({ error: error.message || 'Failed to approve request' }, { status: 500 });
      }

      result = data;
    } else {
      if (!notes) {
        return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc('reject_top_up_request', {
        request_id,
        rejector_id: userData.id,
        notes
      });

      if (error) {
        console.error('Error rejecting top-up request:', error);
        return NextResponse.json({ error: error.message || 'Failed to reject request' }, { status: 500 });
      }

      result = data;
    }

    if (!result?.success) {
      return NextResponse.json({ 
        error: result?.error || 'Operation failed' 
      }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/admin/top-up/review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}