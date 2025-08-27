"use client"

import { useState } from "react"
import { ChevronDown, MapPin, Plus, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
  filterType?: 'origin' | 'destination' | null
}

export function AddressDropdownShadcn({
  placeholder,
  selectedAddress,
  onAddressSelect,
  onCreateNewClick,
  onEditClick,
  addresses,
  filterType = null
}: AddressDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  // Filter addresses based on type
  const filteredAddresses = addresses.filter(address => {
    const matchesType = !filterType || 
      address.address_type === filterType || 
      address.address_type === 'both'
    
    return matchesType
  })

  const formatAddress = (address: Address, includeAddressName: boolean = false) => {
    const parts = [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.postal_code,
    ].filter(Boolean)
    const fullAddress = parts.join(', ')
    
    if (includeAddressName && address.address_name) {
      return `${address.address_name} - ${fullAddress}`
    }
    return fullAddress
  }

  const formatShortAddress = (address: Address) => {
    return `${address.address_line1}, ${address.city}, ${address.state || ''} ${address.postal_code}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedAddress ? (
            <span className="truncate">{formatAddress(selectedAddress)}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search addresses..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>No addresses found.</CommandEmpty>
            
            {/* Create New Location Option */}
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false)
                  onCreateNewClick()
                }}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4 text-blue-600" />
                <span className="text-blue-600 font-medium">Create New Location</span>
              </CommandItem>
            </CommandGroup>

            {/* Existing Addresses */}
            {filteredAddresses.length > 0 && (
              <CommandGroup heading="Saved Addresses">
                {filteredAddresses.map((address) => {
                  const addressString = formatShortAddress(address).toLowerCase()
                  const searchLower = searchValue.toLowerCase()
                  
                  // Filter based on search
                  if (searchValue && !addressString.includes(searchLower)) {
                    return null
                  }

                  return (
                    <div key={address.id} className="relative">
                      <CommandItem
                        value={address.id}
                        onSelect={() => {
                          onAddressSelect(address)
                          setOpen(false)
                          setSearchValue("")
                        }}
                        className={`pr-12 cursor-pointer flex items-start ${
                          selectedAddress?.id === address.id ? 'bg-accent' : ''
                        }`}
                      >
                        <MapPin className="mr-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {address.address_line1}
                            {address.address_line2 && `, ${address.address_line2}`}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {address.city}, {address.state} {address.postal_code}
                          </div>
                        </div>
                      </CommandItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          onEditClick(address)
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}