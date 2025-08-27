# FBA Warehouse Data

## Overview
This directory contains the processed Amazon FBA warehouse data converted from the original Excel file.

## Files

### fba-warehouses.json
- **Total Warehouses**: 1,741 locations
- **Countries**: Multiple (US, France, UK, China, India, Japan, Canada, Mexico, Brazil, etc.)
- **States/Regions**: 119 unique locations

## Data Structure

Each warehouse entry contains:
```json
{
  "id": "fba-1",           // Unique identifier
  "code": "ABE1",          // Warehouse code (searchable)
  "name": "ABE1",          // Display name (same as code)
  "address": "705 Boulder Dr",
  "city": "Breinigsville",
  "state": "PA",
  "postalCode": "18105",   // Searchable
  "country": "US",
  "type": "FBA",
  "fullAddress": "705 Boulder Dr, Breinigsville, PA 18105",
  "searchableText": "abe1 18105 705 boulder dr breinigsville pa"
}
```

## Usage

### Import the data
```typescript
import { searchFBAWarehouses, formatWarehouseDisplay } from '@/lib/fba-warehouses'

// Search by code or postal code
const results = searchFBAWarehouses('ABE1')
// or
const results = searchFBAWarehouses('18105')

// Format for display
const displayText = formatWarehouseDisplay(warehouse)
// Returns: "ABE1 - Breinigsville, PA 18105"
```

### Available Functions
- `searchFBAWarehouses(query)` - Search by code or postal code
- `getFBAWarehouseById(id)` - Get warehouse by ID
- `getFBAWarehouseByCode(code)` - Get warehouse by code
- `getFBAWarehousesByState(state)` - Get all warehouses in a state
- `getFBAWarehousesByCountry(country)` - Get all warehouses in a country
- `formatWarehouseDisplay(warehouse)` - Format for dropdown display
- `getUniqueStates()` - Get list of all states
- `getUniqueCountries()` - Get list of all countries

## Search Capabilities
The data supports searching by:
1. **Warehouse Code** (e.g., "ABE1", "SEA6")
2. **Postal/ZIP Code** (e.g., "98121", "18105")
3. **Partial text search** in address, city, or state

## Data Source
Generated from `amazon_warehouse.xlsx` using the conversion script at `scripts/convert-warehouse-to-json.js`

## Regenerating the Data
To regenerate the JSON file from the Excel source:
```bash
node scripts/convert-warehouse-to-json.js
```