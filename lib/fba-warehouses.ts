import { FBAWarehouse, FBAWarehouseList } from '@/types/fba-warehouse'
import warehouseData from '@/data/fba-warehouses.json'

// Type-safe warehouse data
export const fbaWarehouses: FBAWarehouseList = warehouseData as FBAWarehouseList

/**
 * Search FBA warehouses by code or postal code
 * @param query - Search query (can be warehouse code or postal code)
 * @returns Array of matching warehouses
 */
export function searchFBAWarehouses(query: string): FBAWarehouse[] {
  if (!query || query.length === 0) {
    return fbaWarehouses.slice(0, 50) // Return first 50 if no query
  }

  const searchTerm = query.toLowerCase().trim()
  
  // First, try exact code match
  const exactCodeMatch = fbaWarehouses.filter(
    warehouse => warehouse.code.toLowerCase() === searchTerm
  )
  
  if (exactCodeMatch.length > 0) {
    return exactCodeMatch
  }
  
  // Then, try exact postal code match
  const exactPostalMatch = fbaWarehouses.filter(
    warehouse => warehouse.postalCode === searchTerm
  )
  
  if (exactPostalMatch.length > 0) {
    // Remove duplicates based on address + city combination
    const uniqueWarehouses = new Map<string, FBAWarehouse>()
    exactPostalMatch.forEach(warehouse => {
      const key = `${warehouse.address.toLowerCase()}_${warehouse.city.toLowerCase()}`
      if (!uniqueWarehouses.has(key)) {
        uniqueWarehouses.set(key, warehouse)
      }
    })
    return Array.from(uniqueWarehouses.values())
  }
  
  // Finally, do a fuzzy search on searchableText
  const fuzzyMatches = fbaWarehouses.filter(
    warehouse => warehouse.searchableText.includes(searchTerm)
  )
  
  // Remove duplicates based on address + city combination
  const uniqueResults = new Map<string, FBAWarehouse>()
  fuzzyMatches.forEach(warehouse => {
    const key = `${warehouse.address.toLowerCase()}_${warehouse.city.toLowerCase()}`
    if (!uniqueResults.has(key)) {
      uniqueResults.set(key, warehouse)
    }
  })
  
  // Limit results to prevent performance issues
  return Array.from(uniqueResults.values()).slice(0, 100)
}

/**
 * Get FBA warehouse by ID
 * @param id - Warehouse ID
 * @returns Warehouse object or null if not found
 */
export function getFBAWarehouseById(id: string): FBAWarehouse | null {
  return fbaWarehouses.find(warehouse => warehouse.id === id) || null
}

/**
 * Get FBA warehouse by code
 * @param code - Warehouse code
 * @returns Warehouse object or null if not found
 */
export function getFBAWarehouseByCode(code: string): FBAWarehouse | null {
  return fbaWarehouses.find(
    warehouse => warehouse.code.toLowerCase() === code.toLowerCase()
  ) || null
}

/**
 * Get warehouses by state
 * @param state - State abbreviation or name
 * @returns Array of warehouses in the specified state
 */
export function getFBAWarehousesByState(state: string): FBAWarehouse[] {
  return fbaWarehouses.filter(
    warehouse => warehouse.state.toLowerCase() === state.toLowerCase()
  )
}

/**
 * Get warehouses by country
 * @param country - Country code or name
 * @returns Array of warehouses in the specified country
 */
export function getFBAWarehousesByCountry(country: string): FBAWarehouse[] {
  return fbaWarehouses.filter(
    warehouse => warehouse.country.toLowerCase() === country.toLowerCase()
  )
}

/**
 * Format warehouse for display in dropdown
 * @param warehouse - Warehouse object
 * @returns Formatted string for display
 */
export function formatWarehouseDisplay(warehouse: FBAWarehouse): string {
  return `${warehouse.code} - ${warehouse.city}, ${warehouse.state} ${warehouse.postalCode}`
}

/**
 * Get unique states from all warehouses
 * @returns Array of unique state values
 */
export function getUniqueStates(): string[] {
  const states = new Set(fbaWarehouses.map(w => w.state).filter(s => s))
  return Array.from(states).sort()
}

/**
 * Get unique countries from all warehouses
 * @returns Array of unique country values
 */
export function getUniqueCountries(): string[] {
  const countries = new Set(fbaWarehouses.map(w => w.country).filter(c => c))
  return Array.from(countries).sort()
}