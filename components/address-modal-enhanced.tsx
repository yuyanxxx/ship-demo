"use client"

import { useState, useEffect, useRef } from "react"
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
import { MapPin, Loader2, ShieldCheck, HelpCircle } from "lucide-react"

interface AddressModalProps {
  isOpen: boolean
  onClose: () => void
  onAddressCreated: (address: Address) => void
  onAddressUpdated?: (address: Address) => void
  editingAddress?: Address | null
  defaultAddressType?: 'origin' | 'destination' | 'both'
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
  address_name: string
  contact_name: string
  contact_phone: string
  contact_email: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  country: string
  address_type: 'origin' | 'destination' | 'both'
  address_classification?: 'Commercial' | 'Residential' | 'Unknown'
}

interface MapboxSuggestion {
  id: string
  place_name: string
  properties: {
    full_address?: string
    name?: string
    name_preferred?: string
    coordinates?: {
      longitude: number
      latitude: number
    }
    context?: {
      address?: {
        name?: string
        address_number?: string
        street_name?: string
      }
      street?: {
        name?: string
      }
      neighborhood?: {
        name?: string
      }
      postcode?: {
        name?: string
      }
      place?: {
        name?: string
      }
      district?: {
        name?: string
      }
      region?: {
        name?: string
        region_code?: string
        region_code_full?: string
      }
      country?: {
        name?: string
        country_code?: string
        country_code_alpha_3?: string
      }
    }
  }
  geometry: {
    coordinates: [number, number]
  }
}

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || ""

export function AddressModal({ isOpen, onClose, onAddressCreated, onAddressUpdated, editingAddress, defaultAddressType = "both" }: AddressModalProps) {
  const [formData, setFormData] = useState<AddressFormData>({
    address_name: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    address_type: defaultAddressType,
    address_classification: "Unknown"
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'none' | 'validated' | 'failed'>('none')
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Initialize form with editing address data
  useEffect(() => {
    if (editingAddress) {
      setFormData({
        address_name: editingAddress.address_name || "",
        contact_name: editingAddress.contact_name || "",
        contact_phone: editingAddress.contact_phone || "",
        contact_email: editingAddress.contact_email || "",
        address_line1: editingAddress.address_line1,
        address_line2: editingAddress.address_line2 || "",
        city: editingAddress.city,
        state: editingAddress.state || "",
        postal_code: editingAddress.postal_code,
        country: editingAddress.country,
        address_type: editingAddress.address_type,
        address_classification: editingAddress.address_classification || "Unknown"
      })
    } else {
      setFormData({
        address_name: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "United States",
        address_type: defaultAddressType,
        address_classification: "Unknown"
      })
    }
    setError("")
    setSuggestions([])
    setShowSuggestions(false)
    setValidationStatus('none')
  }, [editingAddress, defaultAddressType])

  const searchAddress = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Mapbox API key is not configured')
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsSearching(true)
    try {
      const encodedQuery = encodeURIComponent(query)
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodedQuery}&access_token=${MAPBOX_ACCESS_TOKEN}&country=US&types=address&autocomplete=true&limit=5`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        const formattedSuggestions: MapboxSuggestion[] = data.features.map((feature: {
          id: string
          properties: MapboxSuggestion['properties']
          geometry: { coordinates: [number, number] }
          place_name?: string
        }) => ({
          id: feature.id,
          place_name: feature.properties.full_address || feature.properties.name || feature.place_name || '',
          properties: feature.properties, // Pass properties directly, context is already inside
          geometry: feature.geometry
        }))
        setSuggestions(formattedSuggestions)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddressLineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({
      ...formData,
      address_line1: value,
    })

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      searchAddress(value)
    }, 500)
  }

  const handleAddressPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault() // Prevent default paste behavior to avoid duplication
    const pastedText = e.clipboardData.getData('text')
    
    // Update the form field immediately
    setFormData({
      ...formData,
      address_line1: pastedText,
    })

    // Search for the pasted address
    searchAddress(pastedText)
  }

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    // Debug: Log the full suggestion object to understand the structure
    console.log('Mapbox suggestion selected:', suggestion)
    console.log('Properties:', suggestion.properties)
    console.log('Context:', suggestion.properties?.context)
    
    const properties = suggestion.properties || {}
    const context = properties.context || {}
    
    // Extract the street address (Address Line 1)
    // For Mapbox Geocoding API v6, we need to construct the full street address
    let addressLine1 = ''
    
    // Check if we have structured address components
    if (context.address) {
      // Build address from components: house number + street name
      const houseNumber = context.address.address_number || ''
      const streetName = context.address.street_name || context.address.name || ''
      addressLine1 = houseNumber && streetName ? `${houseNumber} ${streetName}` : (streetName || '')
    }
    
    // Fallback to properties.name if no structured address
    if (!addressLine1 && properties.name) {
      addressLine1 = properties.name
    }
    
    // If still no address, try to extract from full_address or place_name
    if (!addressLine1) {
      // Try to extract street address from full_address by taking the first part before the first comma
      if (properties.full_address) {
        const parts = properties.full_address.split(',')
        if (parts.length > 0) {
          addressLine1 = parts[0].trim()
        }
      } else if (suggestion.place_name) {
        // Last resort: extract from place_name
        const parts = suggestion.place_name.split(',')
        if (parts.length > 0) {
          addressLine1 = parts[0].trim()
        }
      }
    }

    // Extract city from the place context
    const city = context.place?.name || ''
    
    // Extract state - prefer the 2-letter code
    const state = context.region?.region_code || ''
    
    // Extract postal code
    const postalCode = context.postcode?.name || ''
    
    // Extract country
    const country = context.country?.name || 'United States'

    // Update form with parsed address - use functional update to ensure we have latest state
    setFormData(prevData => ({
      ...prevData,
      address_line1: addressLine1,
      address_line2: "", // Clear address line 2 as it's typically not provided
      city: city,
      state: state,
      postal_code: postalCode,
      country: country,
      // Preserve address_type
      address_type: prevData.address_type
    }))

    // Hide suggestions
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'address_line1') {
      handleAddressLineChange(e as React.ChangeEvent<HTMLInputElement>)
    } else {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
      })
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleValidateAddress = async () => {
    setIsValidating(true)
    setError("")
    
    try {
      // Get user from localStorage for auth
      const storedUser = localStorage.getItem('user')
      const user = storedUser ? JSON.parse(storedUser) : null
      
      const response = await fetch('/api/addresses/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${user.id}` : '',
        },
        body: JSON.stringify({
          address_line1: formData.address_line1,
          address_line2: formData.address_line2,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFormData({
          ...formData,
          address_classification: data.classification || 'Unknown'
        })
        setValidationStatus('validated')
        
        // Optionally update with matched address
        if (data.matchedAddress && data.validated) {
          // Could show a dialog to use the validated address
          console.log('Validated address:', data.matchedAddress)
        }
      } else {
        setError(data.error || 'Address validation failed')
        setValidationStatus('failed')
      }
    } catch (error) {
      console.error('Address validation error:', error)
      setError('Failed to validate address. Please try again.')
      setValidationStatus('failed')
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setShowSuggestions(false)

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
          address_name: "",
          contact_name: "",
          contact_phone: "",
          contact_email: "",
          address_line1: "",
          address_line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "United States",
          address_type: "both",
          address_classification: "Unknown"
        })
        setValidationStatus('none')
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
      address_name: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "United States",
      address_type: "both",
      address_classification: "Unknown"
    })
    setValidationStatus('none')
    setError("")
    setSuggestions([])
    setShowSuggestions(false)
    onClose()
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the input AND the suggestions dropdown
      const isOutsideInput = addressInputRef.current && !addressInputRef.current.contains(e.target as Node)
      const isOutsideSuggestions = suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
      
      if (isOutsideInput && isOutsideSuggestions) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
            <Label htmlFor="address_name">Address Name *</Label>
            <Input
              id="address_name"
              name="address_name"
              type="text"
              placeholder="e.g., Main Warehouse, Home Office"
              value={formData.address_name}
              onChange={handleChange}
              className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input
                id="contact_name"
                name="contact_name"
                type="text"
                placeholder="John Doe"
                value={formData.contact_name}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="contact_phone">Contact Phone *</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.contact_phone}
                onChange={handleChange}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="contact_email">Contact Email *</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="john@example.com"
              value={formData.contact_email}
              onChange={handleChange}
              className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
              required
            />
          </div>

          <div className="relative">
            <Label htmlFor="address_line1">
              Address Line 1 * 
              <span className="text-xs text-muted-foreground ml-2">
                (Paste a full address to auto-fill all fields)
              </span>
            </Label>
            <div className="relative">
              <Input
                ref={addressInputRef}
                id="address_line1"
                name="address_line1"
                type="text"
                placeholder="123 Main Street or paste full address"
                value={formData.address_line1}
                onChange={handleChange}
                onPaste={handleAddressPaste}
                className="mt-1 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm pr-8"
                required
                autoComplete="off"
              />
              {isSearching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b last:border-b-0"
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{suggestion.place_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address_classification">Classification</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="address_classification"
                  value={formData.address_classification || 'Unknown'}
                  readOnly
                  className="bg-gray-50 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm"
                />
                {validationStatus === 'validated' && formData.address_classification !== 'Unknown' ? (
                  <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleValidateAddress}
                    disabled={isValidating || !formData.address_line1 || !formData.city || !formData.state || !formData.postal_code}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <HelpCircle className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="invisible">
              {/* Empty grid cell for alignment */}
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