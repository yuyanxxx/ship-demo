"use client"

import { useState, useMemo } from "react"
import { Check, ChevronDown, MapPin, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchFBAWarehouses } from "@/lib/fba-warehouses"
import type { FBAWarehouse } from "@/types/fba-warehouse"

interface FBADestinationDropdownProps {
  selectedWarehouse: {
    id: string
    code: string
    name: string
    address: string
    city?: string
    state: string
    postalCode?: string
  } | null
  onWarehouseSelect: (warehouse: {
    id: string
    code: string
    name: string
    address: string
    city?: string
    state: string
    postalCode?: string
  } | null) => void
  placeholder?: string
}

export function FBADestinationDropdownShadcn({
  selectedWarehouse,
  onWarehouseSelect,
  placeholder = "FBA Warehouse"
}: FBADestinationDropdownProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Search warehouses based on query
  const filteredWarehouses = useMemo(() => {
    const results = searchFBAWarehouses(searchQuery)
    // Limit to 50 results for performance
    return results.slice(0, 50)
  }, [searchQuery])

  const handleWarehouseSelect = (warehouse: FBAWarehouse) => {
    // Convert to the expected format
    const formattedWarehouse = {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.fullAddress,
      city: warehouse.city,
      state: warehouse.state,
      postalCode: warehouse.postalCode
    }
    onWarehouseSelect(formattedWarehouse)
    setOpen(false)
    setSearchQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start font-normal"
        >
          <div className="flex items-center justify-between w-full">
            {selectedWarehouse ? (
              <div className="flex items-center gap-2 truncate">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{selectedWarehouse.code}</span>
                <span className="text-muted-foreground truncate">- {selectedWarehouse.address}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className="flex h-11 w-full rounded-none border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Search by address, code, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[300px]">
          {filteredWarehouses.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No warehouses found.
            </div>
          ) : (
            <div className="p-1">
              <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
                FBA Warehouses
              </div>
              {filteredWarehouses.map((warehouse) => (
                <button
                  key={warehouse.id}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-start rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    selectedWarehouse?.id === warehouse.id && "bg-accent"
                  )}
                  onClick={() => handleWarehouseSelect(warehouse)}
                >
                  {selectedWarehouse?.id === warehouse.id && (
                    <Check className="mr-2 h-4 w-4 mt-0.5" />
                  )}
                  <MapPin className={cn(
                    "h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5",
                    selectedWarehouse?.id === warehouse.id ? "ml-0 mr-2" : "mr-2"
                  )} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{warehouse.code}</span>
                      <span className="text-xs text-muted-foreground">({warehouse.state})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {warehouse.address}, {warehouse.city}, {warehouse.state} {warehouse.postalCode}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}