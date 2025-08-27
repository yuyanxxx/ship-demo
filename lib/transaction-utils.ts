/**
 * Simplified transaction utilities - No more complexity theater
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TransactionData {
  orderId: string;
  orderNumber: string;
  description: string;
  customerAmount: number;  // NUMBERS, not strings
  baseAmount: number;      // NUMBERS, not strings
  transactionType: 'debit' | 'credit' | 'refund';
}

/**
 * Create dual transactions using the database function
 * Let the database handle atomicity, not JavaScript
 */
export async function createDualTransaction(
  supabase: SupabaseClient,
  customerId: string,
  supervisorId: string,
  data: TransactionData
): Promise<{ success: boolean; error?: string }> {
  
  // First get user details for both customer and supervisor
  const { data: customerData } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', customerId)
    .single();
    
  const { data: supervisorData } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', supervisorId)
    .single();
    
  if (!customerData || !supervisorData) {
    return { success: false, error: 'Failed to fetch user data for transactions' };
  }
  
  // Call the database function - it handles everything atomically
  const { data: result, error } = await supabase.rpc('create_dual_transaction', {
    customer_data: {
      transaction_id: `ORDER_${data.orderNumber}_${Date.now()}`,
      user_id: customerId,
      user_email: customerData.email,
      order_id: data.orderId,
      order_account: 'ORDER',
      company_name: customerData.company_name || customerData.full_name,
      order_number: data.orderNumber,
      amount: -Math.abs(data.customerAmount), // Negative for debit
      base_amount: data.baseAmount,
      transaction_type: data.transactionType,
      description: data.description,
      status: 'completed',
      is_supervisor_transaction: false,
      metadata: {
        transaction_type: data.transactionType,
        order_id: data.orderId
      }
    },
    supervisor_data: {
      transaction_id: `ORDER_SUPERVISOR_${data.orderNumber}_${Date.now()}`,
      user_id: supervisorId,
      user_email: supervisorData.email,
      order_id: data.orderId,
      order_account: 'ORDER',
      company_name: supervisorData.company_name || supervisorData.full_name,
      order_number: data.orderNumber,
      amount: -Math.abs(data.baseAmount), // Negative for debit
      base_amount: data.baseAmount,
      transaction_type: data.transactionType,
      description: `${data.description} (Base Cost)`,
      status: 'completed',
      is_supervisor_transaction: true,
      metadata: {
        transaction_type: data.transactionType,
        order_id: data.orderId
      }
    }
  });

  if (error) {
    console.error('Transaction creation failed:', error);
    return { success: false, error: error.message };
  }

  return { success: result?.success || false };
}

/**
 * Create refund transactions
 * Same as above but with positive amounts
 */
export async function createRefundTransaction(
  supabase: SupabaseClient,
  originalOrderId: string,
  customerId: string,
  supervisorId: string,
  customerRefundAmount: number,
  baseRefundAmount: number,
  reason: string = 'Order refund'
): Promise<{ success: boolean; error?: string }> {
  
  // First get user details for both customer and supervisor
  const { data: customerData } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', customerId)
    .single();
    
  const { data: supervisorData } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', supervisorId)
    .single();
    
  if (!customerData || !supervisorData) {
    return { success: false, error: 'Failed to fetch user data for transactions' };
  }
  
  // Get order number for transaction ID generation
  const { data: orderData } = await supabase
    .from('orders')
    .select('order_number')
    .eq('id', originalOrderId)
    .single();
    
  const orderNumber = orderData?.order_number || 'UNKNOWN';
  
  const { data: result, error } = await supabase.rpc('create_dual_transaction', {
    customer_data: {
      transaction_id: `REFUND_${orderNumber}_${Date.now()}`,
      user_id: customerId,
      user_email: customerData.email,
      order_id: originalOrderId,
      order_account: 'REFUND',
      company_name: customerData.company_name || customerData.full_name,
      order_number: orderNumber,
      amount: Math.abs(customerRefundAmount), // Positive for refund
      base_amount: baseRefundAmount,
      transaction_type: 'refund',
      description: reason,
      status: 'completed',
      is_supervisor_transaction: false,
      metadata: {
        refund_type: 'order_cancellation',
        original_order_id: originalOrderId
      }
    },
    supervisor_data: {
      transaction_id: `REFUND_SUPERVISOR_${orderNumber}_${Date.now()}`,
      user_id: supervisorId,
      user_email: supervisorData.email,
      order_id: originalOrderId,
      order_account: 'REFUND',
      company_name: supervisorData.company_name || supervisorData.full_name,
      order_number: orderNumber,
      amount: Math.abs(baseRefundAmount), // Positive for refund
      base_amount: baseRefundAmount,
      transaction_type: 'refund',
      description: `${reason} (Base Cost)`,
      status: 'completed',
      is_supervisor_transaction: true,
      metadata: {
        refund_type: 'order_cancellation',
        original_order_id: originalOrderId
      }
    }
  });

  if (error) {
    console.error('Refund creation failed:', error);
    return { success: false, error: error.message };
  }

  return { success: result?.success || false };
}