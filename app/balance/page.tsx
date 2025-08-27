/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { 
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Hash,
  Download,
  Plus
} from "lucide-react"
import { CommonHeader } from "@/components/common-header"
import { useIsTablet } from "@/hooks/use-tablet"
import { useIsMobile } from "@/hooks/use-mobile"
// import { formatPriceForUser, getPriceRatio } from "@/lib/pricing-utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { CustomDatePicker } from "@/components/ui/custom-date-picker"

interface Transaction {
  id: string
  transaction_id: string
  user_id: string
  user_email?: string  // Add user email field
  order_id?: string
  order_account: string
  company_name: string
  order_number?: string
  amount: number
  balance_before?: number
  balance_after?: number
  transaction_type: 'credit' | 'debit' | 'refund' | 'payment' | 'adjustment'
  description?: string
  payment_method?: string
  reference_id?: string
  status?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string
  is_supervisor_transaction?: boolean
  users?: {
    email?: string
    full_name?: string
    user_type?: string
  }
  // For compatibility with API field names
  change_time?: string
}

interface UserBalance {
  current_balance: number
  available_balance: number
  pending_balance: number
  credit_limit: number
}

type TransactionTypeFilter = 'all' | 'credit' | 'debit' | 'refund' | 'payment' | 'adjustment'

export default function BalancePage() {
  const router = useRouter()
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all')
  const [dateRange, setDateRange] = useState<'all' | '7days' | '30days' | '90days'>('30days')
  const [userBalance, setUserBalance] = useState<UserBalance>({
    current_balance: 0,
    available_balance: 0,
    pending_balance: 0,
    credit_limit: 0
  })
  const [refundNotification, setRefundNotification] = useState<string | null>(null)
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null)
  
  // xzx001: State for Top Up modal
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [submittingTopUp, setSubmittingTopUp] = useState(false)
  const [userType, setUserType] = useState<string>('')
  
  // New states for top-up form
  const [selectedPaymentConfig, setSelectedPaymentConfig] = useState<any>(null)
  const [availablePaymentConfigs, setAvailablePaymentConfigs] = useState<any[]>([])
  const [loadingPaymentConfigs, setLoadingPaymentConfigs] = useState(false)
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, string | File>>({})
  const [activePaymentTab, setActivePaymentTab] = useState('')
  
  // Admin reset system states
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  const loadTransactions = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    
    try {
      // Get user data from localStorage
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        console.error('No user data found in localStorage')
        setLoading(false)
        return
      }
      
      const user = JSON.parse(storedUser)
      setUserData(user) // Store user data for pricing
      setUserType(user.user_type || '') // xzx001: Set user type for conditional rendering
      
      // Fetch transactions from API with proper auth
      const response = await fetch('/api/balance/transactions', {
        headers: {
          'Authorization': `Bearer ${user.id}`,
          'x-user-id': user.id,
          'Authorization': `Bearer ${user.id}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      
      // Map transactions to include change_time for compatibility
      const mappedTransactions = (data.transactions || []).map((t: Transaction) => ({
        ...t,
        change_time: t.created_at // Use created_at as change_time for display
      }))
      
      // Check for new refunds
      const newRefunds = mappedTransactions.filter((t: Transaction) => 
        t.transaction_type === 'refund' && 
        new Date(t.created_at).getTime() > Date.now() - 60000 // Created in last minute
      )
      
      if (newRefunds.length > 0 && !showLoading) {
        const latestRefund = newRefunds[0]
        setRefundNotification(`Refund processed: ${latestRefund.description || 'Order refund'} - Amount: $${Math.abs(latestRefund.amount).toFixed(2)}`)
        setTimeout(() => setRefundNotification(null), 5000) // Hide after 5 seconds
      }
      
      setTransactions(mappedTransactions)
      setUserBalance(data.balance || {
        current_balance: 0,
        available_balance: 0,
        pending_balance: 0,
        credit_limit: 0
      })
    } catch (error) {
      console.error('Error loading transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
    
    // Get user type from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setUserType(user.user_type || 'customer')
    
    // Set up auto-refresh every 30 seconds to check for new refunds
    const interval = setInterval(() => {
      loadTransactions(false) // Don't show loading spinner on auto-refresh
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Filter transactions based on search term
  const searchFilteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions
    
    const searchLower = searchTerm.toLowerCase()
    return transactions.filter(transaction => 
      transaction.transaction_id.toLowerCase().includes(searchLower) ||
      transaction.order_number?.toLowerCase().includes(searchLower) ||
      transaction.company_name.toLowerCase().includes(searchLower) ||
      transaction.order_account.toLowerCase().includes(searchLower) ||
      transaction.description?.toLowerCase().includes(searchLower)
    )
  }, [transactions, searchTerm])

  // Filter by transaction type
  const typeFilteredTransactions = useMemo(() => {
    if (typeFilter === 'all') return searchFilteredTransactions
    return searchFilteredTransactions.filter(t => t.transaction_type === typeFilter)
  }, [searchFilteredTransactions, typeFilter])

  // Filter by date range
  const dateFilteredTransactions = useMemo(() => {
    if (dateRange === 'all') return typeFilteredTransactions

    const now = new Date()
    const cutoffDate = new Date()
    
    switch (dateRange) {
      case '7days':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case '30days':
        cutoffDate.setDate(now.getDate() - 30)
        break
      case '90days':
        cutoffDate.setDate(now.getDate() - 90)
        break
    }

    return typeFilteredTransactions.filter(t => 
      new Date(t.change_time || t.created_at) >= cutoffDate
    )
  }, [typeFilteredTransactions, dateRange])

  // Sort transactions (always newest first)
  const sortedTransactions = useMemo(() => {
    return [...dateFilteredTransactions].sort((a, b) => {
      const dateA = new Date(a.change_time || a.created_at).getTime()
      const dateB = new Date(b.change_time || b.created_at).getTime()
      return dateB - dateA // Always sort newest first
    })
  }, [dateFilteredTransactions])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = {
      totalCredits: 0,
      totalDebits: 0,
      netChange: 0,
      transactionCount: sortedTransactions.length
    }

    sortedTransactions.forEach(t => {
      if (t.amount > 0) {
        stats.totalCredits += t.amount
      } else {
        stats.totalDebits += Math.abs(t.amount)
      }
    })

    stats.netChange = stats.totalCredits - stats.totalDebits

    return stats
  }, [sortedTransactions])

  const formatCurrency = (amount: number, useUserPricing = false) => {
    const absAmount = Math.abs(amount)
    
    // Never apply price ratio to balance amounts - always show actual values
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(absAmount)
  }

  const formatTransactionDescription = (transaction: Transaction) => {
    if (!transaction.description) return 'N/A'
    
    // Check if this is an insurance purchase transaction
    if (transaction.description.includes('Insurance purchase for order')) {
      return 'Insurance purchase for order'
    }
    
    // Check if this is an insurance cancellation/refund transaction
    if (transaction.description.includes('Insurance cancellation refund') || 
        transaction.description.includes('Insurance refund for cancelled')) {
      return 'Insurance refund for cancelled'
    }
    
    // Return original description for other transactions
    return transaction.description
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    // Format as MM/DD/YYYY HH:MM AM/PM EST
    const formatted = date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    })
    // Add EST timezone suffix
    return `${formatted} EST`
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
      case 'payment':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'debit':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'refund':
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'adjustment':
        return <DollarSign className="h-4 w-4 text-orange-600" />
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />
    }
  }

  const getTransactionBadge = (type: string) => {
    const badges = {
      credit: 'bg-green-100 text-green-800',
      debit: 'bg-red-100 text-red-800',
      refund: 'bg-blue-100 text-blue-800',
      payment: 'bg-green-100 text-green-800',
      adjustment: 'bg-orange-100 text-orange-800'
    }
    
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  // Load all payment configs for top-up modal
  const loadAllPaymentConfigs = async () => {
    setLoadingPaymentConfigs(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      // Call without country param to get all active configs
      const response = await fetch('/api/top-up/payment-configs', {
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailablePaymentConfigs(data)
        
        // Set first config as active tab if exists
        if (data.length > 0) {
          const firstConfig = data[0]
          const tabKey = `${firstConfig.payment_method}-${firstConfig.country}`
          setActivePaymentTab(tabKey)
          setSelectedPaymentConfig(firstConfig)
        }
      }
    } catch (error) {
      console.error('Error loading payment configs:', error)
    } finally {
      setLoadingPaymentConfigs(false)
    }
  }

  // xzx001: Submit top-up request
  const handleTopUpSubmit = async () => {
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (!selectedPaymentConfig) {
      alert('Please select a payment method')
      return
    }

    // Validate required fields based on payment method
    if (selectedPaymentConfig.payment_method === 'wire' || selectedPaymentConfig.payment_method === 'zelle') {
      const requiredFields = ['remitter_sender', 'remitting_bank', 'remittance_account', 'confirmation_number', 'remittance_date', 'upload_document', 'remarks_note']
      for (const field of requiredFields) {
        if (!dynamicFormData[field]) {
          alert(`Please fill in all required fields: ${field.replace('_', ' ')}`)
          return
        }
      }
    } else if (selectedPaymentConfig.payment_method === 'check') {
      const requiredFields = ['check_front', 'check_back']
      for (const field of requiredFields) {
        if (!dynamicFormData[field]) {
          alert(`Please upload all required files: ${field.replace('_', ' ')}`)
          return
        }
      }
    }

    setSubmittingTopUp(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')

      // Prepare form data for file uploads
      const formData = new FormData()
      formData.append('payment_config_id', selectedPaymentConfig.id)
      formData.append('amount', topUpAmount)
      formData.append('currency', 'USD')
      formData.append('payment_reference', `TOPUP-${Date.now()}`)
      
      // Add all form fields
      Object.entries(dynamicFormData).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value)
        } else {
          formData.append(key, value as string)
        }
      })

      // Create customer notes with payment details (excluding files)
      const paymentDetails = Object.fromEntries(
        Object.entries(dynamicFormData).filter(([_, value]) => !(value instanceof File))
      )
      formData.append('customer_notes', `Top-up request from balance page. Payment details: ${JSON.stringify(paymentDetails)}`)

      // Submit top-up request
      const response = await fetch('/api/top-up/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.id}`
        },
        body: formData
      })

      if (response.ok) {
        // Close the modal
        setShowTopUpModal(false)
        // Reset form
        resetTopUpForm()
        // Redirect to top-up history page
        router.push('/top-up-history')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit top-up request')
      }
    } catch (error) {
      console.error('Error submitting top-up:', error)
      alert('Failed to submit top-up request')
    } finally {
      setSubmittingTopUp(false)
    }
  }

  // Reset top-up form
  const resetTopUpForm = () => {
    setTopUpAmount('')
    setDynamicFormData({})
    setShowTopUpModal(false)
  }

  // Admin system reset function
  const handleSystemReset = async () => {
    if (resetConfirmText !== 'RESET SYSTEM') {
      alert('Please type "RESET SYSTEM" to confirm')
      return
    }

    setResetting(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      
      const response = await fetch('/api/admin/reset-system', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setShowResetDialog(false)
        setResetConfirmText('')
        
        // Show success message with details
        alert(`System reset completed successfully!\n\nOperations completed:\n${result.operations.join('\n')}`)
        
        // Reload the page to show fresh data
        window.location.reload()
      } else {
        alert(`Reset failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error during system reset:', error)
      alert('Failed to reset system. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  // Handle file upload
  const handleFileUpload = (fieldName: string, file: File | null) => {
    if (file) {
      setDynamicFormData(prev => ({...prev, [fieldName]: file}))
    } else {
      const newData = {...dynamicFormData}
      delete newData[fieldName]
      setDynamicFormData(newData)
    }
  }

  // Capitalize first letter of payment method
  const capitalizePaymentMethod = (method: string) => {
    return method.charAt(0).toUpperCase() + method.slice(1)
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader 
            searchPlaceholder="Search transactions..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
          />

          <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
            {/* Refund Notification */}
            {refundNotification && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-800 font-medium">{refundNotification}</span>
                </div>
                <button
                  onClick={() => setRefundNotification(null)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Account Balance Changes</h1>
                <p className="text-sm md:text-base text-gray-600">Track all your account transactions and balance history</p>
              </div>
              <div className="flex gap-2">
                {/* Show Top Up button for customers only */}
                {userType === 'customer' && (
                  <Button
                    onClick={() => {
                      setShowTopUpModal(true)
                      console.log('[DEBUG] Top Up button clicked, loading payment configs...')
                      loadAllPaymentConfigs()
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Top Up
                  </Button>
                )}
                
                {/* Show System Reset button for admins only */}
                {userType === 'admin' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    Reset System
                  </Button>
                )}
                
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Summary Cards in Single Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Current Balance */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm opacity-90">Current Balance</p>
                  <DollarSign className="h-4 w-4 opacity-90" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(userBalance.current_balance)}</p>
              </div>
              
              {/* Total Credits */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Total Credits</p>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  +{formatCurrency(summaryStats.totalCredits)}
                </p>
              </div>
              
              {/* Total Debits */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Total Debits</p>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-600">
                  -{formatCurrency(summaryStats.totalDebits)}
                </p>
              </div>
              
              {/* Net Change */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Net Change</p>
                  <Hash className="h-4 w-4 text-gray-600" />
                </div>
                <p className={`text-2xl font-bold ${
                  summaryStats.netChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {summaryStats.netChange >= 0 ? '+' : ''}{formatCurrency(summaryStats.netChange)}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TransactionTypeFilter)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Credits</SelectItem>
                  <SelectItem value="debit">Debits</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="adjustment">Adjustments</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={(value) => setDateRange(value as 'all' | '7days' | '30days' | '90days')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transactions List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : sortedTransactions.length === 0 ? (
              <div className="text-center py-20">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
                <p className="text-gray-500">
                  {searchTerm 
                    ? `No transactions match your search "${searchTerm}"` 
                    : 'No transactions to display'}
                </p>
              </div>
            ) : isMobile ? (
              // Mobile Card Layout
              <div className="space-y-3">
                {sortedTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="bg-white border rounded-lg p-4"
                  >
                    {/* Header with ID and Type */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-sm">{transaction.transaction_id}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(transaction.change_time || transaction.created_at)}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTransactionBadge(transaction.transaction_type)}`}>
                        {getTransactionIcon(transaction.transaction_type)}
                        {transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                      </span>
                    </div>
                    
                    {/* Details */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Company:</span>
                        <span className="font-medium">{transaction.company_name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Order:</span>
                        <span className="font-medium">{transaction.order_number}</span>
                      </div>
                      {transaction.description && (
                        <p className="text-xs text-gray-600 pt-1 border-t">
                          {formatTransactionDescription(transaction)}
                        </p>
                      )}
                    </div>
                    
                    {/* Amount */}
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm text-gray-600">Amount</span>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop/Tablet Table Layout
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Transaction ID</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Account</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Company</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Order Number</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Amount</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Time</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Type</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Balance After</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedTransactions.map((transaction) => (
                        <tr 
                          key={transaction.id} 
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{transaction.transaction_id}</p>
                              {transaction.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{formatTransactionDescription(transaction)}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              {transaction.is_supervisor_transaction && transaction.users ? (
                                // For supervisor transactions, show the actual customer info
                                <>
                                  <span className="text-sm font-medium">{transaction.users.email}</span>
                                  <div className="text-xs text-gray-500">
                                    {transaction.users.full_name} ({transaction.users.user_type})
                                  </div>
                                </>
                              ) : (
                                // For regular transactions, show user email or account
                            <span className="text-sm">{transaction.user_email || transaction.order_account}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{transaction.company_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium">{transaction.order_number}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-right">
                              <span className={`text-sm font-bold ${
                                transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.amount >= 0 ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{formatDate(transaction.change_time || transaction.created_at)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTransactionBadge(transaction.transaction_type)}`}>
                              {getTransactionIcon(transaction.transaction_type)}
                              {transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {transaction.balance_after !== undefined && (
                              <span className="text-sm font-medium">
                                {formatCurrency(transaction.balance_after)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>

          {/* xzx001: Top-up Modal */}
          <Dialog open={showTopUpModal} onOpenChange={(open) => {
            setShowTopUpModal(open)
            if (!open) {
              // Reset only form fields when closing modal, keep payment configs
              setTopUpAmount('')
              setDynamicFormData({})
            }
          }}>
            <DialogContent className="max-w-6xl">
              <DialogHeader>
                <DialogTitle>Top Up Account</DialogTitle>
                <DialogDescription>
                  Add funds to your account by submitting a top-up request
                </DialogDescription>
              </DialogHeader>
              
              {loadingPaymentConfigs ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading payment methods...</span>
                </div>
              ) : availablePaymentConfigs.length === 0 ? (
                <div className="text-center py-20">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No payment methods available</h3>
                  <p className="text-gray-500">
                    No active payment configurations are currently available for top-up
                  </p>
                </div>
              ) : (
                <Tabs value={activePaymentTab} onValueChange={(value) => {
                  setActivePaymentTab(value)
                  const config = availablePaymentConfigs.find(c => `${c.payment_method}-${c.country}` === value)
                  setSelectedPaymentConfig(config || null)
                }}>
                  <TabsList className="inline-flex h-auto">
                    {availablePaymentConfigs.map((config) => {
                      const tabKey = `${config.payment_method}-${config.country}`
                      return (
                        <TabsTrigger key={config.id} value={tabKey}>
                          {capitalizePaymentMethod(config.payment_method)}-{config.country}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                  
                  {availablePaymentConfigs.map((config) => {
                    const tabKey = `${config.payment_method}-${config.country}`
                    return (
                      <TabsContent key={config.id} value={tabKey}>
                        <div className="space-y-6">

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Side - Payment Configuration Table */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-base">Payment Configuration</h4>
                            
                            {config.payment_method === 'wire' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 w-2/5 text-sm">Beneficiary Name</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_name || config.account_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_address || 'N/A'}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Account Number</td>
                                    <td className="p-3 text-sm">{config.account_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Bank</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_bank || config.bank_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Routing Number</td>
                                    <td className="p-3 text-sm">{config.routing_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Swift Code</td>
                                    <td className="p-3 text-sm">{config.swift_code}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Bank Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.bank_address || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Reference</td>
                                    <td className="p-3 text-sm">{config.additional_info?.reference || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}

                            {config.payment_method === 'zelle' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Name</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_name || config.account_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Account Number</td>
                                    <td className="p-3 text-sm">{config.account_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Bank</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_bank || config.bank_name}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Routing Number</td>
                                    <td className="p-3 text-sm">{config.routing_number}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">SWIFT Code</td>
                                    <td className="p-3 text-sm">{config.swift_code}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Zelle Email/Phone</td>
                                    <td className="p-3 text-sm">{config.additional_info?.zelle_remittance || 'N/A'}</td>
                                  </tr>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Bank Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.bank_address || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Beneficiary Address</td>
                                    <td className="p-3 text-sm">{config.additional_info?.beneficiary_address || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}

                            {config.payment_method === 'check' && (
                              <table className="w-full border border-gray-200 rounded-lg">
                                <tbody>
                                  <tr className="border-b">
                                    <td className="p-3 font-medium bg-gray-50 w-2/5 text-sm">Pay To</td>
                                    <td className="p-3 text-sm">{config.bank_name || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td className="p-3 font-medium bg-gray-50 text-sm">Mail To</td>
                                    <td className="p-3 text-sm">{config.swift_code || 'N/A'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Right Side - Form Fields */}
                          <div className="space-y-4">
                            <h4 className="font-medium text-base">Payment Details</h4>
                            
                            {/* Dynamic Fields Based on Payment Method */}
                            {(config.payment_method === 'wire' || config.payment_method === 'zelle') && (
                              <div className="space-y-4">
                                {/* Two-column layout for most fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="amount">Amount *</Label>
                                    <Input
                                      id="amount"
                                      type="number"
                                      step="0.01"
                                      value={topUpAmount}
                                      onChange={(e) => setTopUpAmount(e.target.value)}
                                      placeholder="100.00"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remitter_sender">Remitter / Sender *</Label>
                                    <Input
                                      id="remitter_sender"
                                      value={dynamicFormData.remitter_sender as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remitter_sender: e.target.value})}
                                      placeholder="Enter remitter/sender name"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remitting_bank">Remitting Bank *</Label>
                                    <Input
                                      id="remitting_bank"
                                      value={dynamicFormData.remitting_bank as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remitting_bank: e.target.value})}
                                      placeholder="Enter remitting bank name"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remittance_account">Remittance Account *</Label>
                                    <Input
                                      id="remittance_account"
                                      value={dynamicFormData.remittance_account as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, remittance_account: e.target.value})}
                                      placeholder="Enter remittance account number"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="confirmation_number">Wire Transfer Confirmation Number *</Label>
                                    <Input
                                      id="confirmation_number"
                                      value={dynamicFormData.confirmation_number as string || ''}
                                      onChange={(e) => setDynamicFormData({...dynamicFormData, confirmation_number: e.target.value})}
                                      placeholder="Enter wire transfer confirmation number"
                                      required
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="remittance_date">Remittance Date *</Label>
                                    <CustomDatePicker
                                      id="remittance_date"
                                      value={dynamicFormData.remittance_date as string || ''}
                                      onValueChange={(value) => setDynamicFormData({...dynamicFormData, remittance_date: value})}
                                      placeholder="Select remittance date"
                                    />
                                  </div>
                                </div>
                                
                                {/* Full-width fields */}
                                <div className="space-y-2">
                                  <Label htmlFor="upload_document">Upload Document *</Label>
                                  <Input
                                    id="upload_document"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('upload_document', e.target.files?.[0] || null)}
                                    required
                                  />
                                  {dynamicFormData.upload_document && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.upload_document as File).name}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="remarks_note">Remarks / Note *</Label>
                                  <Textarea
                                    id="remarks_note"
                                    value={dynamicFormData.remarks_note as string || ''}
                                    onChange={(e) => setDynamicFormData({...dynamicFormData, remarks_note: e.target.value})}
                                    placeholder="Enter any remarks or notes"
                                    rows={3}
                                    required
                                  />
                                </div>
                              </div>
                            )}

                            {config.payment_method === 'check' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="amount">Amount *</Label>
                                  <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    placeholder="100.00"
                                    required
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="check_front">Front of the check *</Label>
                                  <Input
                                    id="check_front"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('check_front', e.target.files?.[0] || null)}
                                    required
                                  />
                                  {dynamicFormData.check_front && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.check_front as File).name}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="check_back">Back of the check *</Label>
                                  <Input
                                    id="check_back"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUpload('check_back', e.target.files?.[0] || null)}
                                    required
                                  />
                                  {dynamicFormData.check_back && (
                                    <p className="text-sm text-green-600">
                                      File selected: {(dynamicFormData.check_back as File).name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Submit Buttons */}
                            <div className="flex justify-end space-x-2 pt-4">
                              <Button variant="outline" onClick={resetTopUpForm}>
                                Cancel
                              </Button>
                              <Button onClick={handleTopUpSubmit} disabled={submittingTopUp}>
                                {submittingTopUp ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit Top-up Request'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        </div>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              )}
            </DialogContent>
          </Dialog>

          {/* Admin System Reset Dialog */}
          <Dialog open={showResetDialog} onOpenChange={(open) => {
            if (!open && resetting) return; // Prevent closing while resetting
            setShowResetDialog(open);
            if (!open) setResetConfirmText(''); // Clear confirm text when closing
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-red-600">⚠️ System Reset</DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      This action will permanently delete:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
                      <li>All balance transactions</li>
                      <li>All orders</li>
                      <li>All top-up requests</li>
                      <li>All insurance certificates</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mb-2">
                      And reset all user balances to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
                      <li>Admin users: $2,000</li>
                      <li>Customer users: $1,000</li>
                    </ul>
                    <p className="text-sm font-semibold text-red-600">
                      This action cannot be undone!
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="confirm-text">
                    Type <strong>&quot;RESET SYSTEM&quot;</strong> to confirm:
                  </Label>
                  <Input
                    id="confirm-text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET SYSTEM"
                    disabled={resetting}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowResetDialog(false);
                    setResetConfirmText('');
                  }}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleSystemReset}
                  disabled={resetting || resetConfirmText !== 'RESET SYSTEM'}
                >
                  {resetting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset System'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}