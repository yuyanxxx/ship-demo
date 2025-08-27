"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, MapPin, Plus, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

interface AddressDropdownProps {
  label: string
  placeholder: string
  selectedAddress: Address | null
  onAddressSelect: (address: Address | null) => void
  onCreateNewClick: () => void
  onEditClick: (address: Address) => void
  addresses: Address[]
  filterType?: 'origin' | 'destination' | null // Filter addresses by type
}

export function AddressDropdown({
  placeholder,
  selectedAddress,
  onAddressSelect,
  onCreateNewClick,
  onEditClick,
  addresses,
  filterType = null
}: AddressDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Filter addresses based on search term and type
  const filteredAddresses = addresses.filter(address => {
    // First filter by search term
    const matchesSearch = `${address.address_line1} ${address.city} ${address.state} ${address.postal_code}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    
    // Then filter by address type if specified
    const matchesType = !filterType || 
      address.address_type === filterType || 
      address.address_type === 'both'
    
    return matchesSearch && matchesType
  })

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


  const displayValue = selectedAddress 
    ? formatAddress(selectedAddress)
    : searchTerm || placeholder

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pr-10 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm cursor-pointer"
          readOnly={!isOpen}
        />
        <ChevronDown 
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Create New Location Option */}
          <Button
            variant="ghost"
            className="w-full justify-start px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100"
            onClick={() => {
              setIsOpen(false)
              onCreateNewClick()
            }}
          >
            <Plus className="h-4 w-4 mr-2 text-blue-600" />
            <span className="text-blue-600 font-medium">Create New Location</span>
          </Button>

          {/* Existing Addresses */}
          {filteredAddresses.length > 0 ? (
            filteredAddresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start gap-2 border-b border-gray-50 last:border-b-0 hover:bg-gray-50"
              >
                <button
                  className="flex-1 px-3 py-2 text-left flex items-start gap-2 min-w-0"
                  onClick={() => {
                    onAddressSelect(address)
                    setSearchTerm("")
                    setIsOpen(false)
                  }}
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {address.city}, {address.state} {address.postal_code}
                    </div>
                    <div className="text-xs text-gray-400">
                      {address.country}
                    </div>
                  </div>
                </button>
                <button
                  className="px-2 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(false)
                    onEditClick(address)
                  }}
                  title="Edit address"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : searchTerm ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No addresses found matching &quot;{searchTerm}&quot;
            </div>
          ) : addresses.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No saved addresses yet
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}