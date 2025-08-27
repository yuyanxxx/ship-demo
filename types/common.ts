// Common type definitions

export type AnyObject = Record<string, any>;

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  base_amount?: number;
  description: string;
  transaction_type: 'debit' | 'credit' | 'refund';
  order_id?: string;
  supervisor_transaction_id?: string;
  is_supervisor_transaction?: boolean;
  created_at: string;
  [key: string]: any;
}

export interface Quote {
  totalCharge?: number;
  lineCharge?: number;
  fuelCharge?: number;
  accessorials?: number;
  [key: string]: any;
}