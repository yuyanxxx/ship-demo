/**
 * Pricing analytics utilities for supervisor-customer pricing system
 * Provides functions for calculating profit margins, revenue breakdowns, and pricing reports
 */

import { supabaseAdmin } from './supabase';

/**
 * Interface for profit margin data
 */
interface ProfitMarginData {
  totalCustomerRevenue: number;
  totalSupervisorCost: number;
  totalProfit: number;
  profitMarginPercentage: number;
  transactionCount: number;
  averageMarkup: number;
}

/**
 * Interface for customer revenue breakdown
 */
interface CustomerRevenueData {
  customerId: string;
  customerEmail: string;
  customerName: string;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  transactionCount: number;
  averagePriceRatio: number;
}

/**
 * Interface for pricing analytics filters
 */
interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  transactionType?: 'debit' | 'credit' | 'refund';
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Get overall profit margin metrics for admin dashboard
 * 
 * @param supabase - Supabase admin client
 * @param filters - Optional filters for date range, etc.
 * @returns Promise resolving to profit margin data
 */
export async function getProfitMarginMetrics(
  filters: AnalyticsFilters = {}
): Promise<ProfitMarginData> {
  try {
    // Build query for customer transactions (excluding supervisor transactions)
    let customerQuery = supabaseAdmin
      .from('balance_transactions')
      .select('amount, base_amount, transaction_type, created_at')
      .eq('is_supervisor_transaction', false)
      .not('base_amount', 'is', null); // Only transactions with dual pricing

    // Apply filters
    if (filters.startDate) {
      customerQuery = customerQuery.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      customerQuery = customerQuery.lte('created_at', filters.endDate);
    }
    if (filters.customerId) {
      customerQuery = customerQuery.eq('user_id', filters.customerId);
    }
    if (filters.transactionType) {
      customerQuery = customerQuery.eq('transaction_type', filters.transactionType);
    }
    if (filters.minAmount) {
      customerQuery = customerQuery.gte('amount', filters.minAmount);
    }
    if (filters.maxAmount) {
      customerQuery = customerQuery.lte('amount', filters.maxAmount);
    }

    const { data: transactions, error } = await customerQuery;

    if (error) {
      throw new Error(`Failed to fetch transaction data: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return {
        totalCustomerRevenue: 0,
        totalSupervisorCost: 0,
        totalProfit: 0,
        profitMarginPercentage: 0,
        transactionCount: 0,
        averageMarkup: 0
      };
    }

    // Calculate metrics
    let totalCustomerRevenue = 0;
    let totalSupervisorCost = 0;
    let totalMarkup = 0;
    const transactionCount = transactions.length;

    transactions.forEach(transaction => {
      const customerAmount = Math.abs(transaction.amount || 0);
      const baseAmount = Math.abs(transaction.base_amount || 0);

      // For debit transactions (expenses), these represent actual costs/revenue
      if (transaction.transaction_type === 'debit') {
        totalCustomerRevenue += customerAmount;
        totalSupervisorCost += baseAmount;
        
        if (baseAmount > 0) {
          totalMarkup += ((customerAmount - baseAmount) / baseAmount) * 100;
        }
      }
    });

    const totalProfit = totalCustomerRevenue - totalSupervisorCost;
    const profitMarginPercentage = totalSupervisorCost > 0 
      ? (totalProfit / totalSupervisorCost) * 100 
      : 0;
    
    const averageMarkup = transactionCount > 0 ? totalMarkup / transactionCount : 0;

    return {
      totalCustomerRevenue: Math.round(totalCustomerRevenue * 100) / 100,
      totalSupervisorCost: Math.round(totalSupervisorCost * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMarginPercentage: Math.round(profitMarginPercentage * 100) / 100,
      transactionCount,
      averageMarkup: Math.round(averageMarkup * 100) / 100
    };

  } catch (error) {
    console.error('Error calculating profit margin metrics:', error);
    throw error;
  }
}

/**
 * Get revenue breakdown by customer for admin dashboard
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to array of customer revenue data
 */
export async function getCustomerRevenueBreakdown(
  filters: AnalyticsFilters = {}
): Promise<CustomerRevenueData[]> {
  try {
    // Query customer transactions with user details
    let query = supabaseAdmin
      .from('balance_transactions')
      .select(`
        amount,
        base_amount,
        transaction_type,
        user_id,
        created_at,
        users!balance_transactions_user_id_fkey (
          email,
          full_name,
          price_ratio
        )
      `)
      .eq('is_supervisor_transaction', false)
      .eq('transaction_type', 'debit') // Focus on actual expenses/revenue
      .not('base_amount', 'is', null);

    // Apply filters
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.customerId) {
      query = query.eq('user_id', filters.customerId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch customer transaction data: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group transactions by customer
    const customerMap = new Map<string, {
      customerId: string;
      customerEmail: string;
      customerName: string;
      totalRevenue: number;
      totalCost: number;
      transactionCount: number;
      priceRatios: number[];
    }>();

    transactions.forEach((transaction: Record<string, unknown>) => {
      const userId = String(transaction.user_id);
      const customerAmount = Math.abs(Number(transaction.amount) || 0);
      const baseAmount = Math.abs(Number(transaction.base_amount) || 0);
      const userInfo = transaction.users as Record<string, unknown> | undefined;

      if (!customerMap.has(userId)) {
        customerMap.set(userId, {
          customerId: userId,
          customerEmail: String(userInfo?.email || 'Unknown'),
          customerName: String(userInfo?.full_name || 'Unknown'),
          totalRevenue: 0,
          totalCost: 0,
          transactionCount: 0,
          priceRatios: []
        });
      }

      const customer = customerMap.get(userId)!;
      customer.totalRevenue += customerAmount;
      customer.totalCost += baseAmount;
      customer.transactionCount++;
      
      if (userInfo?.price_ratio !== undefined && userInfo.price_ratio !== null) {
        customer.priceRatios.push(Number(userInfo.price_ratio));
      }
    });

    // Convert to result format
    const results: CustomerRevenueData[] = Array.from(customerMap.values()).map(customer => {
      const profit = customer.totalRevenue - customer.totalCost;
      const profitMargin = customer.totalCost > 0 
        ? (profit / customer.totalCost) * 100 
        : 0;
      
      const averagePriceRatio = customer.priceRatios.length > 0
        ? customer.priceRatios.reduce((sum, ratio) => sum + ratio, 0) / customer.priceRatios.length
        : 0;

      return {
        customerId: customer.customerId,
        customerEmail: customer.customerEmail,
        customerName: customer.customerName,
        totalRevenue: Math.round(customer.totalRevenue * 100) / 100,
        totalCost: Math.round(customer.totalCost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        transactionCount: customer.transactionCount,
        averagePriceRatio: Math.round(averagePriceRatio * 100) / 100
      };
    });

    // Sort by profit descending
    return results.sort((a, b) => b.profit - a.profit);

  } catch (error) {
    console.error('Error getting customer revenue breakdown:', error);
    throw error;
  }
}

/**
 * Get pricing trends over time for charts
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to trend data
 */
export async function getPricingTrends(
  filters: AnalyticsFilters = {}
): Promise<{
  date: string;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  transactionCount: number;
}[]> {
  try {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30); // Last 30 days

    let query = supabaseAdmin
      .from('balance_transactions')
      .select('amount, base_amount, transaction_type, created_at')
      .eq('is_supervisor_transaction', false)
      .eq('transaction_type', 'debit')
      .not('base_amount', 'is', null)
      .gte('created_at', filters.startDate || defaultStartDate.toISOString())
      .order('created_at', { ascending: true });

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch pricing trend data: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group by date
    const dailyMap = new Map<string, {
      totalRevenue: number;
      totalCost: number;
      transactionCount: number;
    }>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
      const customerAmount = Math.abs(transaction.amount || 0);
      const baseAmount = Math.abs(transaction.base_amount || 0);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          totalRevenue: 0,
          totalCost: 0,
          transactionCount: 0
        });
      }

      const daily = dailyMap.get(date)!;
      daily.totalRevenue += customerAmount;
      daily.totalCost += baseAmount;
      daily.transactionCount++;
    });

    // Convert to array and calculate derived metrics
    return Array.from(dailyMap.entries())
      .map(([date, data]) => {
        const profit = data.totalRevenue - data.totalCost;
        const profitMargin = data.totalCost > 0 ? (profit / data.totalCost) * 100 : 0;

        return {
          date,
          totalRevenue: Math.round(data.totalRevenue * 100) / 100,
          totalCost: Math.round(data.totalCost * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          transactionCount: data.transactionCount
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

  } catch (error) {
    console.error('Error getting pricing trends:', error);
    throw error;
  }
}

/**
 * Get summary statistics for pricing dashboard widgets
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to summary statistics
 */
export async function getPricingSummaryStats(
  filters: AnalyticsFilters = {}
): Promise<{
  totalProfit: number;
  totalProfitChange: number; // Percentage change from previous period
  averageMargin: number;
  averageMarginChange: number;
  topCustomerProfit: number;
  topCustomerName: string;
  transactionVolume: number;
  volumeChange: number;
}> {
  try {
    // Get current period metrics
    const currentMetrics = await getProfitMarginMetrics(filters);
    
    // Get previous period for comparison (same duration, but shifted back)
    const periodDays = filters.startDate && filters.endDate 
      ? Math.ceil((new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const prevEndDate = filters.startDate 
      ? new Date(filters.startDate)
      : new Date();
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    const prevMetrics = await getProfitMarginMetrics({
      ...filters,
      startDate: prevStartDate.toISOString(),
      endDate: prevEndDate.toISOString()
    });

    // Get top customer
    const customerBreakdown = await getCustomerRevenueBreakdown(filters);
    const topCustomer = customerBreakdown[0] || {
      profit: 0,
      customerName: 'No customers'
    };

    // Calculate percentage changes
    const profitChange = prevMetrics.totalProfit > 0 
      ? ((currentMetrics.totalProfit - prevMetrics.totalProfit) / prevMetrics.totalProfit) * 100
      : 0;

    const marginChange = prevMetrics.profitMarginPercentage > 0
      ? ((currentMetrics.profitMarginPercentage - prevMetrics.profitMarginPercentage) / prevMetrics.profitMarginPercentage) * 100
      : 0;

    const volumeChange = prevMetrics.transactionCount > 0
      ? ((currentMetrics.transactionCount - prevMetrics.transactionCount) / prevMetrics.transactionCount) * 100
      : 0;

    return {
      totalProfit: currentMetrics.totalProfit,
      totalProfitChange: Math.round(profitChange * 100) / 100,
      averageMargin: currentMetrics.profitMarginPercentage,
      averageMarginChange: Math.round(marginChange * 100) / 100,
      topCustomerProfit: topCustomer.profit,
      topCustomerName: topCustomer.customerName,
      transactionVolume: currentMetrics.transactionCount,
      volumeChange: Math.round(volumeChange * 100) / 100
    };

  } catch (error) {
    console.error('Error getting pricing summary stats:', error);
    throw error;
  }
}

/**
 * Export pricing data to CSV format for reporting
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to CSV string
 */
export async function exportPricingDataToCSV(
  filters: AnalyticsFilters = {}
): Promise<string> {
  try {
    const customerData = await getCustomerRevenueBreakdown(filters);
    
    const headers = [
      'Customer ID',
      'Customer Email', 
      'Customer Name',
      'Total Revenue',
      'Total Cost',
      'Profit',
      'Profit Margin %',
      'Transaction Count',
      'Average Price Ratio %'
    ];

    const csvRows = [
      headers.join(','),
      ...customerData.map(customer => [
        customer.customerId,
        `"${customer.customerEmail}"`,
        `"${customer.customerName}"`,
        customer.totalRevenue,
        customer.totalCost,
        customer.profit,
        customer.profitMargin,
        customer.transactionCount,
        customer.averagePriceRatio
      ].join(','))
    ];

    return csvRows.join('\n');

  } catch (error) {
    console.error('Error exporting pricing data to CSV:', error);
    throw error;
  }
}