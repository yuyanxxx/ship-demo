import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Check if user is authorized (you should add proper auth check here)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Running migration to add sync and refund columns...')

    // Test if columns exist by trying to select them
    const { error: testError } = await supabaseAdmin
      .from('orders')
      .select('order_status, refund_status, refund_amount')
      .limit(1)

    if (testError) {
      console.log('Columns do not exist, migration needed:', testError.message)
      return NextResponse.json({
        success: false,
        message: 'Migration required. Please run the SQL migration in Supabase Dashboard.',
        sql: `-- Add API sync and refund-related columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_status VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS track_number VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS audit_remark TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_number VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_number VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS insured_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_api_sync TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_date TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS refund_transaction_id UUID DEFAULT NULL;`
      })
    }

    console.log('Columns already exist')
    return NextResponse.json({
      success: true,
      message: 'All required columns exist'
    })

  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}