import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    // Check if user is admin
    const userDataHeader = request.headers.get('x-user-data');
    if (!userDataHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = JSON.parse(userDataHeader);
    if (userData.user_type !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[Admin] Clearing all top-up requests for admin:', userData.email);

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