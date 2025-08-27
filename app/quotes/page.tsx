"use client"

import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CustomDatePicker } from "@/components/ui/custom-date-picker"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Search, Truck, Users, ArrowRight, Plus, Check, ChevronsUpDown, FileText, ClipboardCheck, CheckCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { StepsIndicator } from "@/components/steps-indicator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { AddressDropdownShadcn as AddressDropdown } from "@/components/address-dropdown-shadcn"
import { AddressModal } from "@/components/address-modal-enhanced"
import { FBADestinationDropdownShadcn as FBADestinationDropdown } from "@/components/fba-destination-dropdown-shadcn"
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

interface PackageItem {
  id: string
  packageName: string
  declaredValue: string
  totalPallet: string
  packageType: string
  totalPackage: string
  freightClass: string
  length: string
  width: string
  height: string
  weight: string
  nmfc: string
  sub: string
}

export default function QuotesPage() {
  const router = useRouter()
  const isTablet = useIsTablet()
  const [selectedService, setSelectedService] = useState<"FTL" | "LTL" | "FBA" | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [originAddress, setOriginAddress] = useState<Address | null>(null)
  const [destinationAddress, setDestinationAddress] = useState<Address | null>(null)
  const [selectedFBAWarehouse, setSelectedFBAWarehouse] = useState<{
    id: string
    code: string
    name: string
    address: string
    city?: string
    state: string
    postalCode?: string
  } | null>(null)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [, setIsLoading] = useState(true)
  const [pickupDate, setPickupDate] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [packageItems, setPackageItems] = useState<PackageItem[]>([
    {
      id: '1',
      packageName: 'Test Cargo', // Default for testing
      declaredValue: '1000', // Default for testing  
      totalPallet: '1', // Default for testing
      packageType: 'Pallet',
      totalPackage: '1', // Default for testing
      freightClass: '50', // Default for testing
      length: '48', // Default for testing (inches)
      width: '40', // Default for testing (inches)
      height: '48', // Default for testing (inches)
      weight: '500', // Default for testing (lbs)
      nmfc: '156600', // Default for testing
      sub: '1' // Default for testing
    }
  ])
  const [deliveryAccessorials, setDeliveryAccessorials] = useState<string[]>([])
  const [openPackageTypePopover, setOpenPackageTypePopover] = useState<string | null>(null)

  // Watch for destination address changes to handle Residential addresses
  useEffect(() => {
    if (destinationAddress?.address_classification === 'Residential' && selectedService === 'LTL') {
      // For residential addresses, auto-select and lock lift-gate and appointment delivery
      setDeliveryAccessorials(prev => {
        const required = ['Lift-Gate Delivery', 'Appointment Delivery']
        const merged = [...new Set([...required, ...prev])]
        return merged
      })
    }
  }, [destinationAddress, selectedService])

  // Load user's addresses on component mount
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const storedUser = localStorage.getItem('user')
        if (!storedUser) {
          setIsLoading(false)
          return
        }

        const user = JSON.parse(storedUser)
        const response = await fetch(`/api/addresses?user_id=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${user.id}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setAddresses(data.addresses || [])
        } else {
          console.error('Failed to load addresses:', response.statusText)
        }
      } catch (error) {
        console.error('Error loading addresses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAddresses()
  }, [])

  const handleAddressCreated = (newAddress: Address) => {
    setAddresses(prev => [newAddress, ...prev])
  }

  const handleAddressUpdated = (updatedAddress: Address) => {
    setAddresses(prev => prev.map(addr => 
      addr.id === updatedAddress.id ? updatedAddress : addr
    ))
    // Update selected addresses if they were edited
    if (originAddress?.id === updatedAddress.id) {
      setOriginAddress(updatedAddress)
    }
    if (destinationAddress?.id === updatedAddress.id) {
      setDestinationAddress(updatedAddress)
    }
  }

  const [defaultAddressType, setDefaultAddressType] = useState<'origin' | 'destination' | 'both'>('both')
  
  const handleCreateNewLocation = (type?: 'origin' | 'destination') => {
    setEditingAddress(null)
    // Set default address type based on which dropdown triggered the add
    if (type === 'origin') {
      setDefaultAddressType('origin')
    } else if (type === 'destination') {
      setDefaultAddressType('destination')
    } else {
      setDefaultAddressType('both')
    }
    setIsAddressModalOpen(true)
  }

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address)
    setIsAddressModalOpen(true)
  }

  const handleModalClose = () => {
    setIsAddressModalOpen(false)
    setEditingAddress(null)
  }

  // Check if cargo details should be shown
  const shouldShowCargoDetails = () => {
    if (!selectedService) return false
    
    // For TL and LTL: need origin, destination, and pickup date
    if ((selectedService === 'FTL' || selectedService === 'LTL')) {
      return !!(originAddress && destinationAddress && pickupDate)
    }
    
    // For FBA: need origin, destination (warehouse), pickup date, and delivery date
    if (selectedService === 'FBA') {
      return !!(originAddress && selectedFBAWarehouse && pickupDate && deliveryDate)
    }
    
    return false
  }

  // Handle package item changes
  const handlePackageItemChange = (id: string, field: keyof PackageItem, value: string) => {
    setPackageItems(items =>
      items.map(item => {
        if (item.id !== id) return item
        
        const updatedItem = { ...item, [field]: value }
        
        // Auto-calculate freight class when dimensions or weight change
        if (field === 'weight' || field === 'length' || field === 'width' || field === 'height') {
          const freightClass = calculateFreightClass(
            field === 'weight' ? value : updatedItem.weight,
            field === 'length' ? value : updatedItem.length,
            field === 'width' ? value : updatedItem.width,
            field === 'height' ? value : updatedItem.height
          )
          updatedItem.freightClass = freightClass
        }
        
        return updatedItem
      })
    )
  }

  // Calculate freight class based on density
  const calculateFreightClass = (weight: string, length: string, width: string, height: string): string => {
    const w = parseFloat(weight) || 0
    const l = parseFloat(length) || 0
    const wi = parseFloat(width) || 0
    const h = parseFloat(height) || 0
    
    if (w === 0 || l === 0 || wi === 0 || h === 0) return ''
    
    // Calculate volume in cubic feet (dimensions are in inches)
    const volumeCubicFeet = (l * wi * h) / 1728
    
    // Calculate density (pounds per cubic foot)
    const density = w / volumeCubicFeet
    
    // Determine freight class based on density
    if (density >= 50) return '50'
    if (density >= 35) return '55'
    if (density >= 30) return '60'
    if (density >= 22.5) return '65'
    if (density >= 15) return '70'
    if (density >= 13.5) return '77.5'
    if (density >= 12) return '85'
    if (density >= 10.5) return '92.5'
    if (density >= 9) return '100'
    if (density >= 8) return '110'
    if (density >= 7) return '125'
    if (density >= 6) return '150'
    if (density >= 5) return '175'
    if (density >= 4) return '200'
    if (density >= 3) return '250'
    if (density >= 2) return '300'
    if (density >= 1) return '400'
    return '500'
  }

  // Get dynamic label for Total Package based on Package Type
  const getTotalPackageLabel = (packageType: string): string => {
    switch(packageType) {
      case 'Bag': return 'Total Bag'
      case 'Bale': return 'Total Bale'
      case 'Box': return 'Total Box'
      case 'Bunch': return 'Total Bunch'
      case 'Cabinet': return 'Total Cabinet'
      case 'Carton': return 'Total Carton'
      case 'Crate': return 'Total Crate'
      case 'Cylinder': return 'Total Cylinder'
      case 'Drum': return 'Total Drum'
      case 'Pallet': return 'Total Pallet'
      case 'Reel': return 'Total Reel'
      case 'Roll': return 'Total Roll'
      case 'Tube': return 'Total Tube'
      case 'Unit': return 'Total Unit'
      default: return 'Total Package'
    }
  }

  // Add new package item
  const addPackageItem = () => {
    const newId = String(packageItems.length + 1)
    setPackageItems([...packageItems, {
      id: newId,
      packageName: 'Test Cargo ' + newId, // Default for testing
      declaredValue: '1000', // Default for testing
      totalPallet: '1', // Default for testing
      packageType: 'Pallet',
      totalPackage: '1', // Default for testing
      freightClass: '50', // Default for testing
      length: '48', // Default for testing (inches)
      width: '40', // Default for testing (inches)
      height: '48', // Default for testing (inches)
      weight: '500', // Default for testing (lbs)
      nmfc: '156600', // Default for testing
      sub: '1' // Default for testing
    }])
  }

  // Remove package item
  const removePackageItem = (id: string) => {
    // Keep at least one item
    if (packageItems.length > 1) {
      setPackageItems(items => items.filter(item => item.id !== id))
    }
  }

  // Handle quote submission
  const handleSubmitQuote = async () => {
    // Reset previous messages
    setSubmitError(null)
    
    // Validate required fields
    if (selectedService === 'LTL' || selectedService === 'FTL') {
      if (!originAddress || !destinationAddress || !pickupDate) {
        setSubmitError('Please fill in all required fields')
        return
      }
    } else if (selectedService === 'FBA') {
      if (!originAddress || !selectedFBAWarehouse || !pickupDate || !deliveryDate) {
        setSubmitError('Please fill in all required fields including FBA warehouse and delivery date')
        return
      }
    }
    
    // Validate package items for all services
    const hasInvalidItems = packageItems.some(item => 
      !item.packageName || !item.totalPallet || !item.totalPackage || 
      !item.length || !item.width || !item.height || !item.weight
    )
    
    if (hasInvalidItems) {
      setSubmitError('Please fill in all required cargo details')
      return
    }
    
    setIsSubmitting(true)
    
    // Prepare request payload based on service type
    let requestPayload: {
      originAddress: typeof originAddress
      destinationAddress?: typeof destinationAddress
      destinationWarehouse?: {
        id: string
        name: string
        code: string
        address_line1: string
        city: string
        state: string
        postal_code: string
        country: string
      } | null
      pickupDate: string
      deliveryDate?: string
      deliveryAccessorials?: string[]
      packageItems: typeof packageItems
    }
    
    if (selectedService === 'FBA') {
      // FBA-specific payload
      requestPayload = {
        originAddress,
        destinationWarehouse: selectedFBAWarehouse ? {
          id: selectedFBAWarehouse.id,
          name: selectedFBAWarehouse.name,
          code: selectedFBAWarehouse.code,
          address_line1: selectedFBAWarehouse.address,
          city: selectedFBAWarehouse.city || '',
          state: selectedFBAWarehouse.state,
          postal_code: selectedFBAWarehouse.postalCode || '',
          country: 'US'
        } : null,
        pickupDate,
        deliveryDate,
        packageItems
      }
    } else {
      // LTL/FTL payload
      requestPayload = {
        originAddress,
        destinationAddress,
        pickupDate,
        deliveryAccessorials: selectedService === 'LTL' ? deliveryAccessorials : [],
        packageItems
      }
    }
    
    // Debug logging - Request details
    console.log(`=== ${selectedService} Quote Submission Debug ===`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Service Type:', selectedService);
    console.log('\n--- Origin Address ---');
    if (originAddress) {
      console.log('Address Line 1:', originAddress.address_line1);
      console.log('City:', originAddress.city);
      console.log('State:', originAddress.state);
      console.log('Postal Code:', originAddress.postal_code);
      console.log('Country:', originAddress.country);
      console.log('Classification:', originAddress.address_classification);
    }
      if (selectedService === 'FBA') {
        console.log('\n--- FBA Warehouse ---');
        console.log('Code:', selectedFBAWarehouse?.code);
        console.log('Name:', selectedFBAWarehouse?.name);
        console.log('Address:', selectedFBAWarehouse?.address);
        console.log('City:', selectedFBAWarehouse?.city);
        console.log('State:', selectedFBAWarehouse?.state);
        console.log('Postal Code:', selectedFBAWarehouse?.postalCode);
      } else {
        console.log('\n--- Destination Address ---');
        console.log('Address Line 1:', destinationAddress?.address_line1);
        console.log('City:', destinationAddress?.city);
        console.log('State:', destinationAddress?.state);
        console.log('Postal Code:', destinationAddress?.postal_code);
        console.log('Country:', destinationAddress?.country);
        console.log('Classification:', destinationAddress?.address_classification);
      }
      console.log('\n--- Shipment Details ---');
      console.log('Pickup Date:', pickupDate);
      if (selectedService === 'LTL') {
        console.log('Delivery Accessorials:', deliveryAccessorials);
      } else if (selectedService === 'FBA') {
        console.log('Delivery Date:', deliveryDate);
      }
      console.log('\n--- Package Items ---');
      packageItems.forEach((item, index) => {
        console.log(`\nPackage ${index + 1}:`);
        console.log('  Package Name:', item.packageName);
        console.log('  Declared Value:', item.declaredValue);
        console.log('  Total Pallet:', item.totalPallet);
        console.log('  Package Type:', item.packageType);
        console.log('  Total Package:', item.totalPackage);
        console.log('  Freight Class:', item.freightClass);
        console.log('  Dimensions (L x W x H):', `${item.length}" x ${item.width}" x ${item.height}"`);
        console.log('  Weight:', item.weight, 'lbs');
        console.log('  NMFC:', item.nmfc || 'N/A');
        console.log('  Sub:', item.sub || 'N/A');
      });
      console.log('\n--- Full Request Payload ---');
      console.log(JSON.stringify(requestPayload, null, 2));
      console.log('=================================\n');
      
      try {
        // Get user ID for authorization
        const storedUser = localStorage.getItem('user')
        let userId = ''
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser)
            userId = user.id
          } catch (error) {
            console.error('Error parsing user data:', error)
          }
        }
        
        // Choose endpoint based on service type
        let endpoint: string
        if (selectedService === 'FTL') {
          endpoint = '/api/quotes/tl'
        } else if (selectedService === 'FBA') {
          endpoint = '/api/quotes/fba'
        } else {
          endpoint = '/api/quotes/ltl'
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}`
          },
          body: JSON.stringify(requestPayload)
        })
        
        const data = await response.json()
        
        // Debug logging - Response
        console.log('=== API Response Debug ===');
        console.log('Response Status:', response.status);
        console.log('Response OK:', response.ok);
        console.log('Response Data:', JSON.stringify(data, null, 2));
        console.log('=========================\n');
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit quote')
        }
        
        // Get order ID from response (TL uses orderId, LTL uses quoteNumber)
        const orderId = data.orderId || data.quoteNumber
        
        // If this is a TL quote with immediate rates, store them in sessionStorage
        if (data.isTL && data.initialRates && data.initialRates.length > 0) {
          sessionStorage.setItem(`tl_rates_${orderId}`, JSON.stringify(data.initialRates))
        }
        
        // Store quote submission data for order placement
        // IMPORTANT: Store the exact same data format that was sent to the quote API
        const quoteSubmissionData = {
          orderId,
          serviceType: selectedService,
          originAddress,
          destinationAddress: selectedService === 'FBA' ? null : destinationAddress,
          destinationWarehouse: selectedService === 'FBA' && selectedFBAWarehouse ? {
            id: selectedFBAWarehouse.id,
            name: selectedFBAWarehouse.name,
            code: selectedFBAWarehouse.code,
            address_line1: selectedFBAWarehouse.address,
            city: selectedFBAWarehouse.city || '',
            state: selectedFBAWarehouse.state,
            postal_code: selectedFBAWarehouse.postalCode || '',
            country: 'US'
          } : null,
          pickupDate,
          deliveryDate: selectedService === 'FBA' ? deliveryDate : null,
          deliveryAccessorials: selectedService === 'LTL' ? deliveryAccessorials : [],
          packageItems,
          palletQuantity: packageItems.reduce((sum, item) => sum + parseInt(item.totalPallet || '0'), 0),
          timestamp: new Date().toISOString()
        }
        sessionStorage.setItem(`quote_submission_${orderId}`, JSON.stringify(quoteSubmissionData))
        
        // Immediately redirect to results page
        router.push(`/quotes/results?orderId=${orderId}`)
      } catch (error) {
        console.error('Error submitting quote:', error)
        setSubmitError(error instanceof Error ? error.message : 'Failed to submit quote')
      } finally {
        setIsSubmitting(false)
      }
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
      <SidebarInset>
        <CommonHeader />
        
        <div className="flex flex-1 flex-col gap-8 px-4 md:px-12 py-8 w-full xl:w-[70%] mx-auto">
          {/* Page Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">Get a quote</h1>
            <div className="hidden md:flex items-center gap-2">
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8"
                disabled={isSubmitting}
                onClick={() => {
                  // Reset all form data
                  setSelectedService(null)
                  setOriginAddress(null)
                  setDestinationAddress(null)
                  setSelectedFBAWarehouse(null)
                  setPickupDate('')
                  setDeliveryDate('')
                  setDeliveryAccessorials([])
                  setPackageItems([{
                    id: '1',
                    packageName: '',
                    declaredValue: '',
                    totalPallet: '',
                    packageType: 'Pallet',
                    totalPackage: '',
                    freightClass: '',
                    length: '',
                    width: '',
                    height: '',
                    weight: '',
                    nmfc: '',
                    sub: ''
                  }])
                  setSubmitError(null)
                }}
              >
                Reset
              </Button>
              <Button 
                size="lg" 
                className="px-8 flex items-center gap-2"
                onClick={handleSubmitQuote}
                disabled={isSubmitting || !selectedService}
              >
                {isSubmitting ? 'Submitting...' : 'Next'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Steps Indicator */}
          <StepsIndicator
            steps={[
              { id: 1, name: "Quote", description: "Enter shipment details", icon: FileText },
              { id: 2, name: "Select Truck Carrier", description: "Choose your carrier", icon: Truck },
              { id: 3, name: "Confirm Order", description: "Review and confirm", icon: ClipboardCheck },
              { id: 4, name: "Complete", description: "Order placed", icon: CheckCircle }
            ]}
            currentStep={1}
            className="mb-4"
          />

          {/* Service Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card 
              className={`cursor-pointer transition-all border py-4 gap-0 ${
                selectedService === "FTL" 
                  ? "bg-[#f7f9fd] border-ring" 
                  : "bg-white border-[#dae3f2] hover:bg-gray-50"
              }`}
              onClick={() => setSelectedService("FTL")}
            >
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Truck className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">TL</h3>
                    <p className="text-gray-600">Full truckload</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all border py-4 gap-0 ${
                selectedService === "LTL" 
                  ? "bg-[#f7f9fd] border-ring" 
                  : "bg-white border-[#dae3f2] hover:bg-gray-50"
              }`}
              onClick={() => setSelectedService("LTL")}
            >
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">LTL</h3>
                    <p className="text-gray-600">Less than a truckload</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all border py-4 gap-0 ${
                selectedService === "FBA" 
                  ? "bg-[#f7f9fd] border-ring" 
                  : "bg-white border-[#dae3f2] hover:bg-gray-50"
              }`}
              onClick={() => setSelectedService("FBA")}
            >
              <CardContent className="px-4 py-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-green-700">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M17 12.5a15.198 15.198 0 0 1 -7.37 1.44a14.62 14.62 0 0 1 -6.63 -2.94" />
                      <path d="M19.5 15c.907 -1.411 1.451 -3.323 1.5 -5c-1.197 -.773 -2.577 -.935 -4 -1" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">FBA</h3>
                    <p className="text-gray-600">Amazon fulfillment</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
            {/* White overlay - shows when no service is selected */}
            {!selectedService && (
              <div className="absolute inset-0 bg-white/80 z-10" />
            )}
            
            {/* Origin Section */}
            <div className={`space-y-6 ${!selectedService ? 'pointer-events-none' : ''}`}>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Origin</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Origin Location <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-1">
                      <AddressDropdown
                        label="Origin Location"
                        placeholder="Search or select origin address"
                        selectedAddress={originAddress}
                        onAddressSelect={setOriginAddress}
                        onCreateNewClick={() => handleCreateNewLocation('origin')}
                        onEditClick={handleEditAddress}
                        addresses={addresses}
                        filterType="origin"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup-date" className="text-sm font-medium text-gray-700">
                      When will your cargo be ready for pickup? <span className="text-red-500">*</span>
                    </Label>
                    <CustomDatePicker
                      id="pickup-date"
                      value={pickupDate}
                      onValueChange={setPickupDate}
                      placeholder="Select pickup date"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Destination Section */}
            <div className={`space-y-6 ${!selectedService ? 'pointer-events-none' : ''}`}>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Destination</h2>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Destination Location <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-1">
                      {selectedService === "FBA" ? (
                        <FBADestinationDropdown
                          selectedWarehouse={selectedFBAWarehouse}
                          onWarehouseSelect={setSelectedFBAWarehouse}
                          placeholder="FBA Warehouse"
                        />
                      ) : (
                        <AddressDropdown
                          label="Destination Location"
                          placeholder="Search or select destination address"
                          selectedAddress={destinationAddress}
                          onAddressSelect={setDestinationAddress}
                          onCreateNewClick={() => handleCreateNewLocation('destination')}
                          onEditClick={handleEditAddress}
                          addresses={addresses}
                          filterType="destination"
                        />
                      )}
                    </div>
                  </div>

                  {selectedService === "LTL" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-gray-700">
                          Delivery Accessorials
                          {destinationAddress?.address_classification === 'Residential' && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (Lift-Gate & Appointment required for residential)
                            </span>
                          )}
                        </Label>
                        {deliveryAccessorials.length > 0 && destinationAddress?.address_classification !== 'Residential' && (
                          <button
                            type="button"
                            onClick={() => setDeliveryAccessorials([])}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between text-left font-normal"
                          >
                            <span className={deliveryAccessorials.length > 0 ? "" : "text-muted-foreground"}>
                              {deliveryAccessorials.length > 0 
                                ? `${deliveryAccessorials.length} selected`
                                : "Select delivery options"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0" align="start" sideOffset={4} style={{ width: 'var(--radix-popover-trigger-width)' }}>
                          <Command>
                            <CommandInput placeholder="Search options..." />
                            <CommandEmpty>No option found.</CommandEmpty>
                            <CommandGroup>
                              {[
                                "Inside Delivery",
                                "Lift-Gate Delivery",
                                "Appointment Delivery",
                                "Guaranteed Delivery",
                                "Room of Choice with Signature",
                                "White Glove Delivery",
                                "No Signature Required"
                              ].map((option) => (
                                <CommandItem
                                  key={option}
                                  onSelect={() => {
                                    // For residential addresses, prevent deselecting lift-gate and appointment
                                    const isResidential = destinationAddress?.address_classification === 'Residential'
                                    const isRequired = isResidential && 
                                      (option === 'Lift-Gate Delivery' || option === 'Appointment Delivery')
                                    
                                    if (isRequired && deliveryAccessorials.includes(option)) {
                                      // Don't allow deselecting required options for residential
                                      return
                                    }
                                    
                                    setDeliveryAccessorials(prev =>
                                      prev.includes(option)
                                        ? prev.filter(item => item !== option)
                                        : [...prev, option]
                                    )
                                  }}
                                  className="flex items-center justify-between"
                                >
                                  <span>{option}</span>
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      deliveryAccessorials.includes(option) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {selectedService === "FBA" && (
                    <div className="space-y-2">
                      <Label htmlFor="delivery-date" className="text-sm font-medium text-gray-700">
                        Final Destination Target Delivery Date <span className="text-red-500">*</span>
                      </Label>
                      <CustomDatePicker
                        id="delivery-date"
                        value={deliveryDate}
                        onValueChange={setDeliveryDate}
                        placeholder="Select delivery date"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cargo Details Section */}
          {shouldShowCargoDetails() && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Cargo Details</h2>
                
                <div className="space-y-6">
                  {packageItems.map((item, index) => (
                    <div key={item.id}>
                      {/* Separator line between items */}
                      {index > 0 && <Separator className="mb-6" />}
                      
                      <div className="space-y-4">
                        {/* Row 1: Package Name, Declared Value, Total Pallet, Package Type, Total Package, Freight Class */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          {/* Package Name */}
                          <div>
                            <Label htmlFor={`package-name-${item.id}`} className="text-sm font-medium text-gray-700">
                              Package Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`package-name-${item.id}`}
                              type="text"
                              value={item.packageName}
                              onChange={(e) => handlePackageItemChange(item.id, 'packageName', e.target.value)}
                              className="mt-1"
                              placeholder="Enter name"
                            />
                          </div>

                          {/* Declared Value */}
                          <div>
                            <Label htmlFor={`declared-value-${item.id}`} className="text-sm font-medium text-gray-700">
                              Declared Value
                            </Label>
                            <Input
                              id={`declared-value-${item.id}`}
                              type="number"
                              value={item.declaredValue}
                              onChange={(e) => handlePackageItemChange(item.id, 'declaredValue', e.target.value)}
                              className="mt-1"
                              placeholder="$0"
                              min="0"
                              step="0.01"
                            />
                          </div>

                          {/* Total Pallet */}
                          <div>
                            <Label htmlFor={`total-pallet-${item.id}`} className="text-sm font-medium text-gray-700">
                              Total Pallet <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`total-pallet-${item.id}`}
                              type="number"
                              value={item.totalPallet}
                              onChange={(e) => handlePackageItemChange(item.id, 'totalPallet', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="1"
                            />
                          </div>

                          {/* Package Type */}
                          <div>
                            <Label htmlFor={`package-type-${item.id}`} className="text-sm font-medium text-gray-700">
                              Package Type <span className="text-red-500">*</span>
                            </Label>
                            <Popover 
                              open={openPackageTypePopover === item.id} 
                              onOpenChange={(open) => setOpenPackageTypePopover(open ? item.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between text-left font-normal mt-1"
                                >
                                  {item.packageType}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search package type..." />
                                  <CommandEmpty>No package type found.</CommandEmpty>
                                  <CommandGroup>
                                    {[
                                      "Bag",
                                      "Bale",
                                      "Box",
                                      "Bunch",
                                      "Cabinet",
                                      "Carton",
                                      "Crate",
                                      "Cylinder",
                                      "Drum",
                                      "Pallet",
                                      "Reel",
                                      "Roll",
                                      "Tube",
                                      "Unit"
                                    ].map((type) => (
                                      <CommandItem
                                        key={type}
                                        onSelect={() => {
                                          handlePackageItemChange(item.id, 'packageType', type)
                                          setOpenPackageTypePopover(null) // Auto-close the dropdown
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.packageType === type ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {type}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Total Package (dynamic label) */}
                          <div>
                            <Label htmlFor={`total-package-${item.id}`} className="text-sm font-medium text-gray-700">
                              {getTotalPackageLabel(item.packageType)} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`total-package-${item.id}`}
                              type="number"
                              value={item.totalPackage}
                              onChange={(e) => handlePackageItemChange(item.id, 'totalPackage', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="1"
                            />
                          </div>

                          {/* Freight Class */}
                          <div>
                            <Label htmlFor={`freight-class-${item.id}`} className="text-sm font-medium text-gray-700">
                              Freight Class
                            </Label>
                            <Input
                              id={`freight-class-${item.id}`}
                              type="text"
                              value={item.freightClass}
                              readOnly
                              className="mt-1 bg-gray-100 cursor-not-allowed"
                              placeholder="Auto-calculated"
                            />
                          </div>
                        </div>

                        {/* Row 2: Length, Width, Height, Weight, NMFC, Sub */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          {/* Length */}
                          <div>
                            <Label htmlFor={`length-${item.id}`} className="text-sm font-medium text-gray-700">
                              Length(in) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`length-${item.id}`}
                              type="number"
                              value={item.length}
                              onChange={(e) => handlePackageItemChange(item.id, 'length', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="0"
                              step="0.1"
                            />
                          </div>

                          {/* Width */}
                          <div>
                            <Label htmlFor={`width-${item.id}`} className="text-sm font-medium text-gray-700">
                              Width(in) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`width-${item.id}`}
                              type="number"
                              value={item.width}
                              onChange={(e) => handlePackageItemChange(item.id, 'width', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="0"
                              step="0.1"
                            />
                          </div>

                          {/* Height */}
                          <div>
                            <Label htmlFor={`height-${item.id}`} className="text-sm font-medium text-gray-700">
                              Height(in) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`height-${item.id}`}
                              type="number"
                              value={item.height}
                              onChange={(e) => handlePackageItemChange(item.id, 'height', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="0"
                              step="0.1"
                            />
                          </div>

                          {/* Weight */}
                          <div>
                            <Label htmlFor={`weight-${item.id}`} className="text-sm font-medium text-gray-700">
                              Weight(lbs) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`weight-${item.id}`}
                              type="number"
                              value={item.weight}
                              onChange={(e) => handlePackageItemChange(item.id, 'weight', e.target.value)}
                              className="mt-1"
                              placeholder="0"
                              min="0"
                              step="0.1"
                            />
                          </div>

                          {/* NMFC */}
                          <div>
                            <Label htmlFor={`nmfc-${item.id}`} className="text-sm font-medium text-gray-700">
                              NMFC
                            </Label>
                            <Input
                              id={`nmfc-${item.id}`}
                              type="text"
                              value={item.nmfc}
                              onChange={(e) => handlePackageItemChange(item.id, 'nmfc', e.target.value)}
                              className="mt-1"
                              placeholder="Optional"
                            />
                          </div>

                          {/* Sub */}
                          <div>
                            <Label htmlFor={`sub-${item.id}`} className="text-sm font-medium text-gray-700">
                              Sub
                            </Label>
                            <Input
                              id={`sub-${item.id}`}
                              type="text"
                              value={item.sub}
                              onChange={(e) => handlePackageItemChange(item.id, 'sub', e.target.value)}
                              className="mt-1"
                              placeholder="Optional"
                            />
                          </div>
                        </div>

                        {/* Delete button - only show for items after the first */}
                        {packageItems.length > 1 && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => removePackageItem(item.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              type="button"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M4 7l16 0" />
                                <path d="M10 11l0 6" />
                                <path d="M14 11l0 6" />
                                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add another package button with Reset/Next for multiple items */}
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addPackageItem}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add another package
                    </Button>
                    
                    {packageItems.length > 1 && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="px-6"
                          onClick={() => {
                            setPackageItems([{
                              id: Date.now().toString(),
                              packageName: '',
                              declaredValue: '',
                              totalPallet: '',
                              packageType: '',
                              totalPackage: '',
                              freightClass: '',
                              length: '',
                              width: '',
                              height: '',
                              weight: '',
                              nmfc: '',
                              sub: ''
                            }])
                          }}
                        >
                          Reset
                        </Button>
                        <Button 
                          type="button"
                          size="lg"
                          className="px-6 flex items-center gap-2"
                          onClick={handleSubmitQuote}
                          disabled={isSubmitting || !selectedService}
                        >
                          {isSubmitting ? 'Submitting...' : 'Next'}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Separator Line */}
          <Separator className="my-2" />

          {/* Error/Success Messages */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}

          {/* Action Buttons - Mobile Only */}
          <div className="flex md:hidden justify-end gap-2">
            <Button 
              variant="outline" 
              size="lg" 
              className="px-6"
              disabled={isSubmitting}
              onClick={() => {
                // Reset all form data
                setSelectedService(null)
                setOriginAddress(null)
                setDestinationAddress(null)
                setSelectedFBAWarehouse(null)
                setPickupDate('')
                setDeliveryDate('')
                setDeliveryAccessorials([])
                setPackageItems([{
                  id: '1',
                  packageName: '',
                  declaredValue: '',
                  totalPallet: '',
                  packageType: 'Pallet',
                  totalPackage: '',
                  freightClass: '',
                  length: '',
                  width: '',
                  height: '',
                  weight: '',
                  nmfc: '',
                  sub: ''
                }])
                setSubmitError(null)
              }}
            >
              Reset
            </Button>
            <Button 
              size="lg" 
              className="px-6 flex items-center gap-2"
              onClick={handleSubmitQuote}
              disabled={isSubmitting || !selectedService}
            >
              {isSubmitting ? 'Submitting...' : 'Review'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Address Creation/Edit Modal */}
        <AddressModal
          isOpen={isAddressModalOpen}
          onClose={handleModalClose}
          onAddressCreated={handleAddressCreated}
          onAddressUpdated={handleAddressUpdated}
          editingAddress={editingAddress}
          defaultAddressType={defaultAddressType}
        />
      </SidebarInset>
    </SidebarProvider>
    </AuthGuard>
  )
}