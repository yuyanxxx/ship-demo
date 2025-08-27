import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    // Authorize the request
    const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!
    
    // Check if user is admin
    if (user.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[Admin] Clearing all top-up requests for admin:', user.email);

    // First, get a count of records to be deleted
    const { count: beforeCount } = await supabaseAdmin
      .from('top_up_requests')
      .select('*', { count: 'exact', head: true });

    // Delete all top-up requests
    const { error } = await supabaseAdmin
      .from('top_up_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records (using a condition that's always true)

    if (error) {
      console.error('Error deleting top-up requests:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to delete top-up requests' 
      }, { status: 500 });
    }

    console.log(`[Admin] Successfully deleted ${beforeCount} top-up request records`);

    return NextResponse.json({ 
      success: true,
      message: `Successfully deleted ${beforeCount} top-up request records`,
      deleted_count: beforeCount 
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/clear-topup-requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}