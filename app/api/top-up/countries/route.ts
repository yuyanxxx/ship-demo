import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeApiRequest } from '@/lib/auth-utils'

const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'CN': 'China',
};

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