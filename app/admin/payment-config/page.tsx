"use client"

import { useEffect, useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Edit2, Trash2, Loader2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsTablet } from "@/hooks/use-tablet"

interface PaymentConfig {
  id: string
  country: string
  payment_method: string
  account_name: string
  account_number: string
  bank_name?: string
  routing_number?: string
  swift_code?: string
  additional_info?: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CN', name: 'China' },
]

const PAYMENT_METHODS = [
  { value: 'wire', label: 'Wire' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
]

export default function PaymentConfigPage() {
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<PaymentConfig | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    country: '',
    payment_method: '',
    // Wire & Zelle fields
    beneficiary_name: '',
    beneficiary_address: '',
    account_number: '',
    beneficiary_bank: '',
    routing_number: '',
    swift_code: '',
    bank_address: '',
    reference: '',
    // Zelle specific
    zelle_remittance: '',
    is_active: true
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/admin/payment-config', {
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConfigs(data)
      }
    } catch (error) {
      console.error('Error fetching payment configs:', error)
      setError('Failed to load payment configurations')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    setSaving(true)
    
    // Validate required fields based on payment method
    if (!formData.country || !formData.payment_method) {
      setError('Please fill in all required fields')
      setSaving(false)
      return
    }

    // Method-specific validation
    if (formData.payment_method === 'wire') {
      if (!formData.beneficiary_name || !formData.beneficiary_address || 
          !formData.account_number || !formData.beneficiary_bank || 
          !formData.routing_number || !formData.swift_code || !formData.bank_address) {
        setError('Please fill in all wire transfer fields')
        setSaving(false)
        return
      }
    } else if (formData.payment_method === 'check') {
      if (!formData.beneficiary_bank || !formData.swift_code) {
        setError('Please fill in Pay To and Mail To fields')
        setSaving(false)
        return
      }
    } else if (formData.payment_method === 'zelle') {
      if (!formData.zelle_remittance || !formData.beneficiary_name || 
          !formData.beneficiary_address || !formData.account_number || 
          !formData.beneficiary_bank || !formData.routing_number || 
          !formData.swift_code || !formData.bank_address) {
        setError('Please fill in all Zelle transfer fields')
        setSaving(false)
        return
      }
    }

    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const method = editingConfig ? 'PUT' : 'POST'
      
      // Build additional_info based on payment method
      const additional_info: Record<string, unknown> = {}

      if (formData.payment_method === 'wire') {
        additional_info.beneficiary_name = formData.beneficiary_name
        additional_info.beneficiary_address = formData.beneficiary_address
        additional_info.beneficiary_bank = formData.beneficiary_bank
        additional_info.bank_address = formData.bank_address
        additional_info.reference = formData.reference
      } else if (formData.payment_method === 'check') {
        // Check fields are handled in the body object below
        // Pay To is stored in bank_name, Mail To is stored in swift_code
      } else if (formData.payment_method === 'zelle') {
        additional_info.zelle_remittance = formData.zelle_remittance
        additional_info.beneficiary_name = formData.beneficiary_name
        additional_info.beneficiary_address = formData.beneficiary_address
        additional_info.beneficiary_bank = formData.beneficiary_bank
        additional_info.bank_address = formData.bank_address
      }
      
      const body = {
        id: editingConfig?.id,
        country: formData.country,
        payment_method: formData.payment_method,
        account_name: formData.payment_method === 'wire' || formData.payment_method === 'zelle' 
          ? formData.beneficiary_name 
          : formData.payment_method === 'check'
            ? formData.beneficiary_bank || 'Check Payment'
            : `${formData.payment_method} Account`,
        account_number: formData.account_number || 'N/A',
        bank_name: formData.beneficiary_bank || '',
        routing_number: formData.routing_number || '',
        swift_code: formData.swift_code || '',
        additional_info,
        is_active: formData.is_active
      }

      const response = await fetch('/api/admin/payment-config', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.id}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        // Remove success message, just refresh and close
        fetchConfigs()
        resetForm()
        setSaving(false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save payment config')
        setSaving(false)
      }
    } catch (error) {
      console.error('Error saving payment config:', error)
      setError('Failed to save payment configuration')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!configToDelete) return
    
    setDeleting(true)
    setError('')
    
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch(`/api/admin/payment-config?id=${configToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        // Remove success message, just refresh and close
        setDeleteDialogOpen(false)
        setConfigToDelete(null)
        fetchConfigs()
      } else {
        const errorData = await response.json()
        // Check for foreign key constraint error
        if (errorData.error?.includes('foreign key constraint') || 
            errorData.error?.includes('still referenced') ||
            errorData.error?.includes('top_up_requests')) {
          setError('Cannot delete this payment configuration because it is being used by existing top-up requests. Please disable it instead.')
        } else {
          setError(errorData.error || 'Failed to delete payment configuration')
        }
        setDeleteDialogOpen(false)
      }
    } catch (error) {
      console.error('Error deleting payment config:', error)
      setError('Failed to delete payment configuration')
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteDialog = (config: PaymentConfig) => {
    setConfigToDelete(config)
    setDeleteDialogOpen(true)
  }

  const handleClearTopUpRequests = async () => {
    setClearing(true)
    setError('')
    
    try {
      const user = localStorage.getItem('user')
      if (!user) return
      
      const userData = JSON.parse(user)
      const response = await fetch('/api/admin/clear-topup-requests', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData.id}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        setClearDialogOpen(false)
        // Show success message temporarily
        setError('') // Clear any existing errors
        alert(`Successfully cleared ${result.deleted_count || 'all'} top-up request records. You can now delete payment configurations.`)
        fetchConfigs() // Refresh the list
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to clear top-up requests')
        setClearDialogOpen(false)
      }
    } catch (error) {
      console.error('Error clearing top-up requests:', error)
      setError('Failed to clear top-up requests')
      setClearDialogOpen(false)
    } finally {
      setClearing(false)
    }
  }

  const handleEdit = (config: PaymentConfig) => {
    setEditingConfig(config)
    const additionalInfo = config.additional_info as Record<string, string | number | boolean> || {}
    setFormData({
      country: config.country,
      payment_method: config.payment_method,
      beneficiary_name: additionalInfo.beneficiary_name ? String(additionalInfo.beneficiary_name) : config.account_name || '',
      beneficiary_address: additionalInfo.beneficiary_address ? String(additionalInfo.beneficiary_address) : '',
      account_number: config.account_number || '',
      beneficiary_bank: additionalInfo.beneficiary_bank ? String(additionalInfo.beneficiary_bank) : config.bank_name || '',
      routing_number: config.routing_number || '',
      swift_code: config.swift_code || '',
      bank_address: additionalInfo.bank_address ? String(additionalInfo.bank_address) : '',
      reference: additionalInfo.reference ? String(additionalInfo.reference) : '',
      zelle_remittance: additionalInfo.zelle_remittance ? String(additionalInfo.zelle_remittance) : '',
      is_active: config.is_active
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      country: '',
      payment_method: '',
      beneficiary_name: '',
      beneficiary_address: '',
      account_number: '',
      beneficiary_bank: '',
      routing_number: '',
      swift_code: '',
      bank_address: '',
      reference: '',
      zelle_remittance: '',
      is_active: true
    })
    setEditingConfig(null)
    setShowForm(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader searchPlaceholder="Search payment configs..." />
        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Payment Configuration</h1>
              <p className="text-muted-foreground">Configure payment accounts for different countries</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setClearDialogOpen(true)}
                className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Clear All Top-Ups
              </Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add New
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Configurations List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No payment configurations yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Country</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Payment Method</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Account Details</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Status</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Created</div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="text-xs font-medium text-gray-700">Actions</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {configs.map((config) => (
                      <tr key={config.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium">
                            {COUNTRIES.find(c => c.code === config.country)?.name || config.country}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">
                            {PAYMENT_METHODS.find(m => m.value === config.payment_method)?.label || config.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="font-medium">{config.account_name}</p>
                            <p className="text-xs text-gray-500">{config.account_number}</p>
                            {config.bank_name && <p className="text-xs text-gray-500">{config.bank_name}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            config.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {config.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(config.created_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openDeleteDialog(config)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add/Edit Modal */}
          <Dialog open={showForm} onOpenChange={(open) => {
            // Prevent closing while saving
            if (!open && saving) return;
            setShowForm(open);
          }}>
            <DialogContent 
              className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{editingConfig ? 'Edit' : 'Add'} Payment Configuration</DialogTitle>
                <DialogDescription>Set up payment account details for customer top-ups</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Basic Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select 
                      value={formData.country} 
                      onValueChange={(value) => {
                        // If selecting China and current payment method is not wire, reset it
                        if (value === 'CN' && formData.payment_method !== 'wire') {
                          setFormData({...formData, country: value, payment_method: ''})
                        } else {
                          setFormData({...formData, country: value})
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method *</Label>
                    <Select 
                      value={formData.payment_method} 
                      onValueChange={(value) => setFormData({...formData, payment_method: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* If China is selected, only show Wire */}
                        {formData.country === 'CN' ? (
                          <SelectItem value="wire">Wire</SelectItem>
                        ) : (
                          PAYMENT_METHODS.map(method => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Wire Transfer Fields */}
                {formData.payment_method === 'wire' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold">Wire Transfer Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_name">Beneficiary Name *</Label>
                        <Input
                          id="beneficiary_name"
                          value={formData.beneficiary_name}
                          onChange={(e) => setFormData({...formData, beneficiary_name: e.target.value})}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_address">Beneficiary Address *</Label>
                        <Input
                          id="beneficiary_address"
                          value={formData.beneficiary_address}
                          onChange={(e) => setFormData({...formData, beneficiary_address: e.target.value})}
                          placeholder="123 Main St, City, State"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account_number">Account Number *</Label>
                        <Input
                          id="account_number"
                          value={formData.account_number}
                          onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                          placeholder="1234567890"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_bank">Beneficiary Bank *</Label>
                        <Input
                          id="beneficiary_bank"
                          value={formData.beneficiary_bank}
                          onChange={(e) => setFormData({...formData, beneficiary_bank: e.target.value})}
                          placeholder="Bank of America"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="routing_number">Routing Number *</Label>
                        <Input
                          id="routing_number"
                          value={formData.routing_number}
                          onChange={(e) => setFormData({...formData, routing_number: e.target.value})}
                          placeholder="123456789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="swift_code">Swift Code *</Label>
                        <Input
                          id="swift_code"
                          value={formData.swift_code}
                          onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                          placeholder="BOFAUS3N"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="bank_address">Bank Address *</Label>
                        <Input
                          id="bank_address"
                          value={formData.bank_address}
                          onChange={(e) => setFormData({...formData, bank_address: e.target.value})}
                          placeholder="456 Bank St, City, State"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="reference">Reference</Label>
                        <Input
                          id="reference"
                          value={formData.reference}
                          onChange={(e) => setFormData({...formData, reference: e.target.value})}
                          placeholder="Payment reference or note"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Check Fields */}
                {formData.payment_method === 'check' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold">Check Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pay_to">Pay To *</Label>
                        <Input
                          id="pay_to"
                          value={formData.beneficiary_bank}
                          onChange={(e) => setFormData({...formData, beneficiary_bank: e.target.value})}
                          placeholder="Enter payee name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mail_to">Mail To *</Label>
                        <Input
                          id="mail_to"
                          value={formData.swift_code}
                          onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                          placeholder="Enter mailing address"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Zelle Fields */}
                {formData.payment_method === 'zelle' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold">Zelle Transfer Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="zelle_remittance">Zelle Remittance *</Label>
                        <Input
                          id="zelle_remittance"
                          value={formData.zelle_remittance}
                          onChange={(e) => setFormData({...formData, zelle_remittance: e.target.value})}
                          placeholder="Zelle email or phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_name">Beneficiary Name *</Label>
                        <Input
                          id="beneficiary_name"
                          value={formData.beneficiary_name}
                          onChange={(e) => setFormData({...formData, beneficiary_name: e.target.value})}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_address">Beneficiary Address *</Label>
                        <Input
                          id="beneficiary_address"
                          value={formData.beneficiary_address}
                          onChange={(e) => setFormData({...formData, beneficiary_address: e.target.value})}
                          placeholder="123 Main St, City, State"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account_number">Account Number *</Label>
                        <Input
                          id="account_number"
                          value={formData.account_number}
                          onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                          placeholder="1234567890"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beneficiary_bank">Beneficiary Bank *</Label>
                        <Input
                          id="beneficiary_bank"
                          value={formData.beneficiary_bank}
                          onChange={(e) => setFormData({...formData, beneficiary_bank: e.target.value})}
                          placeholder="Bank of America"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="routing_number">Routing Number *</Label>
                        <Input
                          id="routing_number"
                          value={formData.routing_number}
                          onChange={(e) => setFormData({...formData, routing_number: e.target.value})}
                          placeholder="123456789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="swift_code">Swift Code *</Label>
                        <Input
                          id="swift_code"
                          value={formData.swift_code}
                          onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                          placeholder="BOFAUS3N"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="bank_address">Bank Address *</Label>
                        <Input
                          id="bank_address"
                          value={formData.bank_address}
                          onChange={(e) => setFormData({...formData, bank_address: e.target.value})}
                          placeholder="456 Bank St, City, State"
                        />
                      </div>
                    </div>
                  </div>
                )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingConfig ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingConfig ? 'Update' : 'Create'} Configuration
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
            // Only allow closing if not currently deleting
            if (!open && !deleting) {
              setDeleteDialogOpen(false)
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Payment Configuration</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this payment configuration for{' '}
                  <strong>{configToDelete && COUNTRIES.find(c => c.code === configToDelete.country)?.name}</strong> -{' '}
                  <strong>{configToDelete && PAYMENT_METHODS.find(m => m.value === configToDelete.payment_method)?.label}</strong>?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Clear Top-Up Requests Confirmation Dialog */}
          <AlertDialog open={clearDialogOpen} onOpenChange={(open) => {
            // Only allow closing if not currently clearing
            if (!open && !clearing) {
              setClearDialogOpen(false)
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                    Clear All Top-Up Requests
                  </div>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-red-600">Warning:</strong> This action will permanently delete ALL top-up request records from the database.
                    </div>
                    <div>
                      This includes:
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Pending top-up requests</li>
                      <li>Approved top-up requests</li>
                      <li>Rejected top-up requests</li>
                      <li>All associated payment proofs and notes</li>
                    </ul>
                    <div className="font-semibold">
                      This action cannot be undone. Are you absolutely sure?
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearTopUpRequests}
                  disabled={clearing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    'Clear All Top-Ups'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}