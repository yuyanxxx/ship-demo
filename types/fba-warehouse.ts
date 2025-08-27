export interface FBAWarehouse {
  id: string
  code: string
  name: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  type: 'FBA'
  fullAddress: string
  searchableText: string
}

export type FBAWarehouseList = FBAWarehouse[]