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
    
    // Get country from query param
    const { searchParams } = new URL(request.url);
    const requestedCountry = searchParams.get('country');
    
    let query = supabaseAdmin
      .from('payment_configs')
      .select('*')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('payment_method', { ascending: true });

    // If country is specified, filter by country; otherwise return all active configs
    if (requestedCountry) {
      query = query.eq('country', requestedCountry);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payment configs:', error);
      return NextResponse.json({ error: 'Failed to fetch payment configs' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/top-up/payment-configs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}