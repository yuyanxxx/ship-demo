'use client'

import { useState, useEffect, Suspense } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommonHeader } from '@/components/common-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  DollarSign, 
  Shield,
  Loader2,
  ArrowUpDown,
  Users,
  MoreHorizontal
} from 'lucide-react'
import { AuthGuard } from '@/components/auth-guard'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsMobile } from '@/hooks/use-mobile'
import { useIsTablet } from '@/hooks/use-tablet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Customer {
  id: string
  email: string
  full_name: string
  phone: string | null
  company_name: string
  bonus_credit: number
  is_active: boolean
  price_ratio: number
  created_at: string
  updated_at: string
  role_id?: string
}

interface Role {
  id: string
  name: string
  description: string
  is_active: boolean
}

// Format phone number as user types
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, '')
  
  // Limit to 10 digits
  const truncated = phoneNumber.slice(0, 10)
  
  // Format based on length
  if (truncated.length === 0) {
    return ''
  } else if (truncated.length <= 3) {
    return `(${truncated}`
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`
  } else {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)} ${truncated.slice(6)}`
  }
}

// Get raw phone number (digits only) from formatted string
function getRawPhoneNumber(value: string): string {
  return value.replace(/\D/g, '')
}

function CustomersContent() {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    companyName: '',
    bonusCredit: 0,
    isActive: true,
    priceRatio: 1.0,
    roleId: ''
  })

  // Store user type
  const [userType, setUserType] = useState<string>('')
  
  // Check user type
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUserType(parsedUser.user_type || 'customer')
    }
  }, [])

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const userData = localStorage.getItem('user')
      if (!userData) return

      const parsedUser = JSON.parse(userData)
      const response = await fetch('/api/customers', {
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      } else {
        console.error('Failed to fetch customers')
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Fetch roles when dialog opens
  useEffect(() => {
    if ((showAddDialog || showEditDialog) && userType === 'admin' && roles.length === 0) {
      fetchRoles()
    }
  }, [showAddDialog, showEditDialog, userType, roles.length])

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true)
      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        const response = await fetch('/api/roles', {
          headers: {
            'Authorization': `Bearer ${parsedUser.id}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setRoles(data.filter((role: Role) => role.is_active))
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
    } finally {
      setLoadingRoles(false)
    }
  }

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          items.push(i)
        }
        items.push('ellipsis-end')
        items.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        items.push(1)
        items.push('ellipsis-start')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          items.push(i)
        }
      } else {
        items.push(1)
        items.push('ellipsis-start')
        items.push(currentPage - 1)
        items.push(currentPage)
        items.push(currentPage + 1)
        items.push('ellipsis-end')
        items.push(totalPages)
      }
    }
    
    return items
  }

  // Handle add customer
  const handleAddCustomer = async () => {
    setSaving(true)
    try {
      setError('')
      const userData = localStorage.getItem('user')
      if (!userData) return

      const parsedUser = JSON.parse(userData)
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parsedUser.id}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setShowAddDialog(false)
        fetchCustomers()
        resetForm()
      } else {
        setError(data.error || 'Failed to create customer')
      }
    } catch {
      setError('An error occurred while creating customer')
    } finally {
      setSaving(false)
    }
  }

  // Handle edit customer
  const handleEditCustomer = async () => {
    if (!selectedCustomer) return

    setSaving(true)
    try {
      setError('')
      const userData = localStorage.getItem('user')
      if (!userData) return

      const parsedUser = JSON.parse(userData)
      const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parsedUser.id}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setShowEditDialog(false)
        fetchCustomers()
        resetForm()
      } else {
        setError(data.error || 'Failed to update customer')
      }
    } catch {
      setError('An error occurred while updating customer')
    } finally {
      setSaving(false)
    }
  }

  // Handle delete customer
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return

    try {
      const userData = localStorage.getItem('user')
      if (!userData) return

      const parsedUser = JSON.parse(userData)
      const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${parsedUser.id}`
        }
      })

      if (response.ok) {
        setShowDeleteDialog(false)
        fetchCustomers()
      } else {
        setError('Failed to delete customer')
      }
    } catch {
      setError('An error occurred while deleting customer')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      companyName: '',
      bonusCredit: 0,
      isActive: true,
      priceRatio: 1.0,
      roleId: ''
    })
    setSelectedCustomer(null)
  }

  // Open edit dialog
  const openEditDialog = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setFormData({
      email: customer.email,
      password: '',
      fullName: customer.full_name,
      phone: customer.phone || '',
      companyName: customer.company_name,
      bonusCredit: customer.bonus_credit,
      isActive: customer.is_active,
      priceRatio: customer.price_ratio || 1.0,
      roleId: customer.role_id || ''
    })
    setShowEditDialog(true)
  }

  // Open delete dialog
  const openDeleteDialog = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setShowDeleteDialog(true)
  }

  return (
    <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader 
          searchPlaceholder="Search customers..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">
                {userType === 'admin' ? 'Customer Management' : 'Customer Directory'}
              </h1>
              <p className="text-sm md:text-base text-gray-600">
                {userType === 'admin' 
                  ? 'Manage customer accounts and permissions' 
                  : 'View customer information and contacts'}
              </p>
            </div>
            {userType === 'admin' && (
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            )}
          </div>

          {/* Error Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}


          {/* Customers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'Try adjusting your search' : 'Add your first customer to get started'}
              </p>
              {!searchTerm && userType === 'admin' && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Customer
                </Button>
              )}
            </div>
          ) : isMobile ? (
            // Mobile Card Layout
            <>
              <div className="space-y-3">
                {paginatedCustomers.map((customer) => (
                  <div 
                    key={customer.id} 
                    className="bg-white border rounded-lg p-4"
                  >
                    {/* First row: Company and Status */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-base">
                        {customer.company_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          customer.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {userType === 'admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => openEditDialog(e as React.MouseEvent, customer)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => openDeleteDialog(e as React.MouseEvent, customer)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    
                    {/* Contact Info */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.full_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom row: Bonus and Price Ratio */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                      <span className="text-sm text-gray-500">
                        Bonus: ${customer.bonus_credit.toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Ratio: {customer.price_ratio || 1.0}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination - Mobile */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {generatePaginationItems().map((item, index) => (
                        <PaginationItem key={index}>
                          {item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(Number(item))}
                              isActive={currentPage === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            // Desktop/Tablet Table Layout
            <>
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                            Company
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Contact Name</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Email</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Phone</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Bonus Credit</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Price Ratio</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Status</div>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <div className="text-xs font-medium text-gray-700">Created</div>
                        </th>
                        {userType === 'admin' && (
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Actions</div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedCustomers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {customer.company_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{customer.full_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{customer.email}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{customer.phone || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium">
                              ${customer.bonus_credit.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium">
                              {customer.price_ratio || 1.0}x
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              customer.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {customer.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-500">
                              {new Date(customer.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          {userType === 'admin' && (
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => openEditDialog(e, customer)}
                                  title="Edit Customer"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => openDeleteDialog(e, customer)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete Customer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Pagination and Summary - Desktop */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} customers
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {generatePaginationItems().map((item, index) => (
                        <PaginationItem key={index}>
                          {item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(Number(item))}
                              isActive={currentPage === item}
                              className="cursor-pointer"
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}

          {/* Add Customer Dialog */}
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            if (!open && saving) return; // Prevent closing while saving
            setShowAddDialog(open);
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Create a new customer account with access to the platform.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Contact Name*</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name*</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      placeholder="ABC Corp"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email*</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password*</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formatPhoneNumber(formData.phone)}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value)
                        const raw = getRawPhoneNumber(formatted)
                        setFormData({...formData, phone: raw})
                      }}
                      placeholder="(___) ___ ____"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="isActive">Account Status</Label>
                    <Select
                      value={formData.isActive.toString()}
                      onValueChange={(value) => setFormData({...formData, isActive: value === 'true'})}
                    >
                      <SelectTrigger id="isActive" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bonusCredit">Bonus Credit ($)</Label>
                    <Input
                      id="bonusCredit"
                      type="number"
                      step="0.01"
                      value={formData.bonusCredit}
                      onChange={(e) => setFormData({...formData, bonusCredit: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceRatio">Price Ratio</Label>
                    <Input
                      id="priceRatio"
                      type="number"
                      step="0.01"
                      value={formData.priceRatio}
                      onChange={(e) => setFormData({...formData, priceRatio: parseFloat(e.target.value) || 1.0})}
                      placeholder="1.00"
                      min="0.01"
                    />
                  </div>
                </div>
                {userType === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.roleId}
                      onValueChange={(value) => setFormData({...formData, roleId: value})}
                    >
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingRoles ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Loading roles...</div>
                        ) : (
                          roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {setShowAddDialog(false); resetForm()}}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomer} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Add Customer'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Customer Dialog */}
          <Dialog open={showEditDialog} onOpenChange={(open) => {
            if (!open && saving) return; // Prevent closing while saving
            setShowEditDialog(open);
          }}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
                <DialogDescription>
                  Update customer account information.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullName">Contact Name</Label>
                    <Input
                      id="edit-fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-companyName">Company Name</Label>
                    <Input
                      id="edit-companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-password">New Password</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={formatPhoneNumber(formData.phone)}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value)
                        const raw = getRawPhoneNumber(formatted)
                        setFormData({...formData, phone: raw})
                      }}
                      placeholder="(___) ___ ____"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-isActive">Account Status</Label>
                    <Select
                      value={formData.isActive.toString()}
                      onValueChange={(value) => setFormData({...formData, isActive: value === 'true'})}
                    >
                      <SelectTrigger id="edit-isActive" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-bonusCredit">Bonus Credit ($)</Label>
                    <Input
                      id="edit-bonusCredit"
                      type="number"
                      step="0.01"
                      value={formData.bonusCredit}
                      onChange={(e) => setFormData({...formData, bonusCredit: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-priceRatio">Price Ratio</Label>
                    <Input
                      id="edit-priceRatio"
                      type="number"
                      step="0.01"
                      value={formData.priceRatio}
                      onChange={(e) => setFormData({...formData, priceRatio: parseFloat(e.target.value) || 1.0})}
                      placeholder="1.00"
                      min="0.01"
                    />
                  </div>
                </div>
                {userType === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Role</Label>
                    <Select
                      value={formData.roleId}
                      onValueChange={(value) => setFormData({...formData, roleId: value})}
                    >
                      <SelectTrigger id="edit-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingRoles ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Loading roles...</div>
                        ) : (
                          roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {setShowEditDialog(false); resetForm()}}>
                  Cancel
                </Button>
                <Button onClick={handleEditCustomer} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will deactivate the customer account for {selectedCustomer?.full_name} at {selectedCustomer?.company_name}.
                  The account can be reactivated later if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedCustomer(null)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCustomer}>
                  Deactivate Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function CustomersPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<div>Loading...</div>}>
        <CustomersContent />
      </Suspense>
    </AuthGuard>
  )
}