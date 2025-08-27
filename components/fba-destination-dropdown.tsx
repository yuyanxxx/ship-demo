"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MapPin, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"

// Test data for FBA warehouses
const FBA_WAREHOUSES = [
  { id: "1", code: "LAX1", name: "Los Angeles FC", address: "6820 West Slauson Ave, Commerce, CA 90040", state: "CA" },
  { id: "2", code: "LAX2", name: "Los Angeles FC", address: "1700 East 132nd Street, Los Angeles, CA 90061", state: "CA" },
  { id: "3", code: "PHX3", name: "Phoenix FC", address: "6835 W Buckeye Rd, Phoenix, AZ 85043", state: "AZ" },
  { id: "4", code: "PHX6", name: "Phoenix FC", address: "4750 West Mohave St, Phoenix, AZ 85043", state: "AZ" },
  { id: "5", code: "SEA6", name: "Seattle FC", address: "2700 Center Drive, DuPont, WA 98327", state: "WA" },
  { id: "6", code: "SEA8", name: "Seattle FC", address: "22001 East Valley Highway, Kent, WA 98032", state: "WA" },
  { id: "7", code: "DFW6", name: "Dallas FC", address: "940 W Bethel Rd, Coppell, TX 75019", state: "TX" },
  { id: "8", code: "DFW7", name: "Dallas FC", address: "700 Westport Parkway, Grapevine, TX 76051", state: "TX" },
  { id: "9", code: "MDW2", name: "Chicago FC", address: "250 Emerald Dr, Joliet, IL 60433", state: "IL" },
  { id: "10", code: "MDW6", name: "Chicago FC", address: "1125 W Remington Blvd, Romeoville, IL 60446", state: "IL" },
  { id: "11", code: "EWR4", name: "New Jersey FC", address: "50 New Canton Way, Robbinsville, NJ 08691", state: "NJ" },
  { id: "12", code: "EWR5", name: "New Jersey FC", address: "301 Blair Rd, Avenel, NJ 07001", state: "NJ" },
  { id: "13", code: "MIA1", name: "Miami FC", address: "14050 NW 124th Ave, Opa-locka, FL 33054", state: "FL" },
  { id: "14", code: "MCO1", name: "Orlando FC", address: "12900 Pecan Park Rd, Jacksonville, FL 32218", state: "FL" },
  { id: "15", code: "ATL6", name: "Atlanta FC", address: "4200 North Commerce Dr, East Point, GA 30344", state: "GA" },
]

interface FBAWarehouse {
  id: string
  code: string
  name: string
  address: string
  state: string
}

interface FBADestinationDropdownProps {
  selectedWarehouse: FBAWarehouse | null
  onWarehouseSelect: (warehouse: FBAWarehouse | null) => void
  placeholder?: string
}

export function FBADestinationDropdown({
  selectedWarehouse,
  onWarehouseSelect,
  placeholder = "FBA Warehouse"
}: FBADestinationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredWarehouses, setFilteredWarehouses] = useState<FBAWarehouse[]>(FBA_WAREHOUSES)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter warehouses based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredWarehouses(FBA_WAREHOUSES)
    } else {
      const searchLower = searchTerm.toLowerCase()
      const filtered = FBA_WAREHOUSES.filter(warehouse => 
        warehouse.code.toLowerCase().includes(searchLower) ||
        warehouse.name.toLowerCase().includes(searchLower) ||
        warehouse.address.toLowerCase().includes(searchLower) ||
        warehouse.state.toLowerCase().includes(searchLower)
      )
      setFilteredWarehouses(filtered)
    }
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectWarehouse = (warehouse: FBAWarehouse) => {
    onWarehouseSelect(warehouse)
    setIsOpen(false)
    setSearchTerm("")
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        className="flex items-center justify-between w-full min-h-[36px] px-3 py-2 border border-input rounded-md bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {selectedWarehouse ? (
            <div className="text-sm">
              <span className="font-medium">{selectedWarehouse.code}</span> - {selectedWarehouse.name}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by address, code, city, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Warehouse List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredWarehouses.length > 0 ? (
              filteredWarehouses.map((warehouse) => (
                <div
                  key={warehouse.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelectWarehouse(warehouse)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{warehouse.code}</span>
                        <span className="text-xs text-muted-foreground">({warehouse.state})</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {warehouse.address}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                No warehouses found matching &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}