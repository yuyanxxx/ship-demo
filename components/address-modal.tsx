"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddressModalProps {
  isOpen: boolean
  onClose: () => void
  onAddressCreated: (address: Address) => void
  onAddressUpdated?: (address: Address) => void
  editingAddress?: Address | null
}

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

interface AddressFormData {
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  country: string
  address_type: 'origin' | 'destination' | 'both'
}

export function AddressModal({ isOpen, onClose, onAddressCreated, onAddressUpdated, editingAddress }: AddressModalProps) {
  const [formData, setFormData] = useState<AddressFormData>({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    address_type: "both",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Initialize form with editing address data
  useEffect(() => {
    if (editingAddress) {
      setFormData({
        address_line1: editingAddress.address_line1,
        address_line2: editingAddress.address_line2 || "",
        city: editingAddress.city,
        state: editingAddress.state || "",
        postal_code: editingAddress.postal_code,
        country: editingAddress.country,
        address_type: editingAddress.address_type,
      })
    } else {
      setFormData({
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "United States",
        address_type: "both",
      })
    }
    setError("")
  }, [editingAddress])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Get user data from localStorage
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      setError('You must be logged in to create an address')
      setIsLoading(false)
      return
    }

    let user
    try {
      user = JSON.parse(storedUser)
    } catch {
      setError('Invalid user session. Please log in again.')
      setIsLoading(false)
      return
    }

    try {
      const isEditing = editingAddress !== null
      const url = isEditing ? `/api/addresses/${editingAddress!.id}` : '/api/addresses'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          ...formData,
          user_id: user.id
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (isEditing && onAddressUpdated) {
          onAddressUpdated(data.address)
        } else {
          onAddressCreated(data.address)
        }
        
        setFormData({
          address_line1: "",
          address_line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "United States",
          address_type: "both",
        })
        onClose()
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} address`)
      }
    } catch (error) {
      setError('Network error. Please try again.')
      console.error(`Address ${editingAddress ? 'update' : 'creation'} error:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "United States",
      address_type: "both",
    })
    setError("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingAddress ? 'Edit Address' : 'Create New Address'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="address_type">Address Type *</Label>
            <Select
              value={formData.address_type}
              onValueChange={(value) => handleSelectChange('address_type', value)}
            >
              <SelectTrigger className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm">
                <SelectValue placeholder="Select address type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="origin">Origin (Shipping From)</SelectItem>
                <SelectItem value="destination">Destination (Shipping To)</SelectItem>
                <SelectItem value="both">Both Origin & Destination</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address_line1">Address Line 1 *</Label>
            <Input
              id="address_line1"
              name="address_line1"
              type="text"
              placeholder="123 Main Street"
              value={formData.address_line1}
              onChange={handleChange}
              className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
              required
            />
          </div>

          <div>
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              name="address_line2"
              type="text"
              placeholder="Apt, Suite, Unit, etc. (optional)"
              value={formData.address_line2}
              onChange={handleChange}
              className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                name="city"
                type="text"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                name="state"
                type="text"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postal_code">Postal Code *</Label>
              <Input
                id="postal_code"
                name="postal_code"
                type="text"
                placeholder="12345"
                value={formData.postal_code}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                name="country"
                type="text"
                placeholder="Country"
                value={formData.country}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (editingAddress ? "Updating..." : "Creating...") : (editingAddress ? "Update Address" : "Create Address")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}