"use client"

import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MapPin, Plus, Edit, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { AddressModal } from "@/components/address-modal-enhanced"
import { useIsTablet } from "@/hooks/use-tablet"

interface Address {
  id: string
  user_id: string
  address_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address_line1: string
  address_line2?: string
  city: string
  state?: string
  postal_code: string
  country: string
  address_type: 'origin' | 'destination' | 'both'
  address_classification?: 'Commercial' | 'Residential' | 'Unknown'
  created_at: string
  updated_at: string
}

interface User {
  id: string
  email: string
  full_name: string
}

export default function AddressesPage() {
  const isTablet = useIsTablet()
  const [user, setUser] = useState<User | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [filteredAddresses, setFilteredAddresses] = useState<Address[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load user data and addresses on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedUser = localStorage.getItem('user')
        if (!storedUser) {
          setIsLoading(false)
          return
        }

        const userData = JSON.parse(storedUser)
        setUser(userData)

        // Load user's addresses
        const response = await fetch('/api/addresses', {
          headers: {
            'Authorization': `Bearer ${userData.id}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setAddresses(data.addresses || [])
          setFilteredAddresses(data.addresses || [])
        } else {
          console.error('Failed to load addresses:', response.statusText)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter addresses based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAddresses(addresses)
    } else {
      const filtered = addresses.filter(address => {
        const searchString = `${address.address_line1} ${address.address_line2 || ''} ${address.city} ${address.state || ''} ${address.postal_code} ${address.country}`
          .toLowerCase()
        return searchString.includes(searchTerm.toLowerCase())
      })
      setFilteredAddresses(filtered)
    }
  }, [searchTerm, addresses])

  const handleAddressCreated = (newAddress: Address) => {
    const updatedAddresses = [newAddress, ...addresses]
    setAddresses(updatedAddresses)
    setFilteredAddresses(updatedAddresses)
  }

  const handleAddressUpdated = (updatedAddress: Address) => {
    const updatedAddresses = addresses.map(addr => 
      addr.id === updatedAddress.id ? updatedAddress : addr
    )
    setAddresses(updatedAddresses)
    setFilteredAddresses(
      updatedAddresses.filter(address => {
        if (!searchTerm.trim()) return true
        const searchString = `${address.address_line1} ${address.address_line2 || ''} ${address.city} ${address.state || ''} ${address.postal_code} ${address.country}`
          .toLowerCase()
        return searchString.includes(searchTerm.toLowerCase())
      })
    )
  }

  const handleCreateNewAddress = () => {
    setEditingAddress(null)
    setIsAddressModalOpen(true)
  }

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address)
    setIsAddressModalOpen(true)
  }

  const handleDeleteAddress = async () => {
    if (!deletingAddress || !user) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/addresses/${deletingAddress.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify({
          user_id: user.id
        }),
      })

      if (response.ok) {
        const updatedAddresses = addresses.filter(addr => addr.id !== deletingAddress.id)
        setAddresses(updatedAddresses)
        setFilteredAddresses(
          updatedAddresses.filter(address => {
            if (!searchTerm.trim()) return true
            const searchString = `${address.address_line1} ${address.address_line2 || ''} ${address.city} ${address.state || ''} ${address.postal_code} ${address.country}`
              .toLowerCase()
            return searchString.includes(searchTerm.toLowerCase())
          })
        )
        setDeletingAddress(null)
      } else {
        const data = await response.json()
        console.error('Failed to delete address:', data.error)
        // You might want to show an error toast here
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      // You might want to show an error toast here
    } finally {
      setIsDeleting(false)
    }
  }

  const handleModalClose = () => {
    setIsAddressModalOpen(false)
    setEditingAddress(null)
  }

  const formatAddress = (address: Address) => {
    const parts = [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.postal_code,
      address.country
    ].filter(Boolean)
    return parts.join(', ')
  }

  const getAddressTypeText = (type: string) => {
    switch (type) {
      case 'origin':
        return <span className="text-sm text-gray-900">Origin</span>
      case 'destination':
        return <span className="text-sm text-gray-900">Destination</span>
      case 'both':
        return <span className="text-sm text-gray-900">Both</span>
      default:
        return <span className="text-sm text-gray-500">-</span>
    }
  }

  const getClassificationText = (classification?: string) => {
    switch (classification) {
      case 'Commercial':
        return <span className="text-sm text-gray-900">Commercial</span>
      case 'Residential':
        return <span className="text-sm text-gray-900">Residential</span>
      case 'Unknown':
      default:
        return <span className="text-sm text-gray-500">Unknown</span>
    }
  }

  if (isLoading) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">Loading...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!user) {
    return (
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">Please log in to access your addresses.</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
      <AppSidebar />
      <SidebarInset>
        <CommonHeader 
          searchPlaceholder="Search addresses..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
        />

          <main className="flex flex-1 flex-col px-4 md:px-6 py-4 md:py-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold">All Addresses</h1>
                <p className="text-sm md:text-base text-gray-600">Manage and organize your shipping addresses</p>
              </div>
              <Button onClick={handleCreateNewAddress} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Address
              </Button>
            </div>

            {/* Addresses List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAddresses.length === 0 ? (
              <div className="text-center py-20">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No addresses found' : 'No addresses yet'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? 'Try adjusting your search terms to find the address you\'re looking for.'
                    : 'Add your first address to get started.'
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateNewAddress} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Your First Address
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Name</div>
                          </th>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Address</div>
                          </th>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Contact</div>
                          </th>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Type</div>
                          </th>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Classification</div>
                          </th>
                          <th className="px-4 py-3 text-left">
                            <div className="text-xs font-medium text-gray-700">Actions</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredAddresses.map((address) => (
                          <tr key={address.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium">
                                {address.address_name || 'Unnamed'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {[address.address_line1, address.address_line2].filter(Boolean).join(', ')}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {[address.city, address.state, address.postal_code, address.country].filter(Boolean).join(', ')}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="text-sm font-medium">{address.contact_name || '-'}</div>
                                <div className="text-xs text-gray-500">{address.contact_phone || '-'}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {getAddressTypeText(address.address_type)}
                            </td>
                            <td className="px-4 py-3">
                              {getClassificationText(address.address_classification)}
                            </td>
                            <td className="px-4 py-3">
                                                              <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditAddress(address)}
                                    title="Edit Address"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeletingAddress(address)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Delete Address"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Address</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this address? This action cannot be undone.
                                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                                          <p className="font-medium text-sm">{formatAddress(address)}</p>
                                        </div>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setDeletingAddress(null)}>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={handleDeleteAddress}
                                        disabled={isDeleting}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        {isDeleting ? 'Deleting...' : 'Delete Address'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </main>

        {/* Address Creation/Edit Modal */}
        <AddressModal
          isOpen={isAddressModalOpen}
          onClose={handleModalClose}
          onAddressCreated={handleAddressCreated}
          onAddressUpdated={handleAddressUpdated}
          editingAddress={editingAddress}
        />
      </SidebarInset>
    </SidebarProvider>
    </AuthGuard>
  )
}