// User type definitions for the application

export interface User {
  id: string;
  email: string;
  name?: string;
  user_type: 'admin' | 'customer';
  price_ratio?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  [key: string]: any; // Allow additional properties
}

export type UserData = User | null;