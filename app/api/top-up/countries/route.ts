import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'CN': 'China',
};

export async function GET(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get distinct countries from payment_configs table where is_active = true
    const { data, error } = await supabaseAdmin
      .from('payment_configs')
      .select('country')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching countries from payment_configs:', error);
      return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 });
    }

    // Get unique countries and format them
    const uniqueCountries = [...new Set(data?.map(config => config.country) || [])];
    
    const countries = uniqueCountries.map(countryCode => ({
      code: countryCode,
      name: COUNTRY_NAMES[countryCode] || countryCode
    }));

    return NextResponse.json(countries);
  } catch (error) {
    console.error('Error in GET /api/top-up/countries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 