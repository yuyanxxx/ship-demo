"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { CommonHeader } from "@/components/common-header"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { 
  ArrowLeft,
  Truck,
  Clock,
  CheckCircle,
  Package,
  Loader2,
  MapPin,
  Calendar,
  Phone,
  Mail,
  XCircle,
  AlertCircle
} from "lucide-react"
import { useIsTablet } from "@/hooks/use-tablet"

interface TrackingEvent {
  time: string
  location: string
  event: string
}

// Demo tracking data sets
const trackingScenarios = {
  delivered: [
    {
      time: "2025-01-14 16:45:00",
      location: "Phoenix, AZ",
      event: "Delivered - Left at front door"
    },
    {
      time: "2025-01-14 10:26:01",
      location: "Phoenix, AZ",
      event: "Out For Delivery"
    },
    {
      time: "2025-01-14 08:15:00",
      location: "Phoenix, AZ - Distribution Center",
      event: "Arrived at delivery facility"
    },
    {
      time: "2025-01-13 22:30:00",
      location: "Tucson, AZ",
      event: "In Transit"
    },
    {
      time: "2025-01-13 14:20:00",
      location: "El Paso, TX",
      event: "Departed from facility"
    },
    {
      time: "2025-01-13 09:45:00",
      location: "El Paso, TX - Hub",
      event: "Package processed at hub"
    },
    {
      time: "2025-01-12 18:30:00",
      location: "Houston, TX",
      event: "In Transit"
    },
    {
      time: "2025-01-12 15:22:00",
      location: "Houston, TX - Sort Facility",
      event: "Package sorted"
    },
    {
      time: "2025-01-12 12:30:00",
      location: "Houston, TX",
      event: "Picked up from sender"
    },
    {
      time: "2025-01-11 22:53:01",
      location: "Houston, TX",
      event: "Shipment information sent to carrier"
    }
  ],
  inTransit: [
    {
      time: "2025-01-14 14:30:00",
      location: "Denver, CO",
      event: "In Transit - On the way to delivery"
    },
    {
      time: "2025-01-14 06:15:00",
      location: "Denver, CO - Distribution Center",
      event: "Arrived at facility"
    },
    {
      time: "2025-01-13 23:45:00",
      location: "Kansas City, MO",
      event: "Departed from facility"
    },
    {
      time: "2025-01-13 18:20:00",
      location: "Kansas City, MO - Hub",
      event: "Package processed"
    },
    {
      time: "2025-01-13 10:00:00",
      location: "St. Louis, MO",
      event: "In Transit"
    },
    {
      time: "2025-01-12 16:30:00",
      location: "Nashville, TN",
      event: "Package sorted at facility"
    },
    {
      time: "2025-01-12 09:15:00",
      location: "Atlanta, GA",
      event: "Picked up from sender"
    }
  ],
  outForDelivery: [
    {
      time: "2025-01-14 08:30:00",
      location: "Los Angeles, CA",
      event: "Out For Delivery - With delivery courier"
    },
    {
      time: "2025-01-14 06:00:00",
      location: "Los Angeles, CA - Delivery Station",
      event: "Package loaded on delivery vehicle"
    },
    {
      time: "2025-01-13 22:15:00",
      location: "Los Angeles, CA - Sort Center",
      event: "Arrived at final delivery facility"
    },
    {
      time: "2025-01-13 14:30:00",
      location: "Bakersfield, CA",
      event: "In Transit"
    },
    {
      time: "2025-01-12 20:00:00",
      location: "San Francisco, CA",
      event: "Departed from origin facility"
    },
    {
      time: "2025-01-12 15:45:00",
      location: "San Francisco, CA",
      event: "Package received at facility"
    },
    {
      time: "2025-01-12 10:30:00",
      location: "San Francisco, CA",
      event: "Picked up from sender"
    }
  ]
}

export default function TrackingDemoPage() {
  const isTablet = useIsTablet()
  const [selectedScenario, setSelectedScenario] = useState<'delivered' | 'inTransit' | 'outForDelivery'>('delivered')
  const [loadingTracking, setLoadingTracking] = useState(false)
  
  const trackingInfo = trackingScenarios[selectedScenario]
  
  // Format tracking time
  const formatTrackingTime = (timeString: string) => {
    try {
      const date = new Date(timeString.replace(' ', 'T'))
      if (isNaN(date.getTime())) {
        return timeString
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      return timeString
    }
  }

  // Simulate loading
  const simulateLoading = () => {
    setLoadingTracking(true)
    setTimeout(() => {
      setLoadingTracking(false)
    }, 1000)
  }

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isTablet}>
        <AppSidebar />
        <SidebarInset>
          <CommonHeader />
          
          <div className="flex flex-1 flex-col">
            {/* Header */}
            <div className="border-b">
              <div className="px-4 md:px-6 py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">Tracking Demo Page</h1>
                    <p className="text-sm text-gray-600 mt-1">Simulated tracking data for demonstration</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => window.history.back()}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-4 md:px-6 py-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Demo Controls */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">📋 Demo Controls</h3>
                  <p className="text-sm text-blue-700 mb-3">Select different tracking scenarios to see how they display:</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedScenario === 'delivered' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedScenario('delivered')
                        simulateLoading()
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Delivered Package
                    </Button>
                    <Button
                      variant={selectedScenario === 'inTransit' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedScenario('inTransit')
                        simulateLoading()
                      }}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      In Transit
                    </Button>
                    <Button
                      variant={selectedScenario === 'outForDelivery' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedScenario('outForDelivery')
                        simulateLoading()
                      }}
                    >
                      <Package className="w-4 h-4 mr-1" />
                      Out for Delivery
                    </Button>
                  </div>
                </div>

                {/* Mock Order Summary */}
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-lg font-semibold">Order Summary</h2>
                  </div>
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Order Number</p>
                        <p className="font-semibold">FB250814DEMO123</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Carrier</p>
                        <p className="font-semibold">FedEx Freight</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          selectedScenario === 'delivered' ? 'bg-green-100 text-green-800' :
                          selectedScenario === 'outForDelivery' ? 'bg-purple-100 text-purple-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedScenario === 'delivered' ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Delivered
                            </>
                          ) : selectedScenario === 'outForDelivery' ? (
                            <>
                              <Truck className="h-4 w-4" />
                              Out for Delivery
                            </>
                          ) : (
                            <>
                              <Truck className="h-4 w-4" />
                              In Transit
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Information - Timeline Style */}
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-6 py-2 border-b">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Tracking Information
                      {loadingTracking && (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      )}
                    </h2>
                  </div>
                  <div className="px-6 py-4">
                    {/* Tracking Number */}
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Tracking Number</p>
                          <p className="font-semibold text-lg">784932650192</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">PRO Number</p>
                          <p className="font-semibold">PRO-2025-0114</p>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Timeline */}
                    {loadingTracking ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Timeline */}
                        <div className="space-y-6">
                          {trackingInfo.map((event, index) => {
                            const isFirst = index === 0
                            const isLast = index === trackingInfo.length - 1
                            const isDelivered = event.event.toLowerCase().includes('delivered')
                            const isInTransit = event.event.toLowerCase().includes('transit') || event.event.toLowerCase().includes('out for delivery')
                            const isPickup = event.event.toLowerCase().includes('pickup') || event.event.toLowerCase().includes('picked up') || event.event.toLowerCase().includes('shipment information')
                            
                            return (
                              <div key={index} className="relative flex gap-4">
                                {/* Timeline Line */}
                                {!isLast && (
                                  <div className="absolute left-[15px] top-[30px] w-[2px] h-[calc(100%+24px)] bg-gray-200" />
                                )}
                                
                                {/* Timeline Dot */}
                                <div className="relative z-10 flex-shrink-0">
                                  <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${
                                    isFirst ? 'bg-blue-500' :
                                    isDelivered ? 'bg-green-500' :
                                    isInTransit ? 'bg-purple-500' :
                                    isPickup ? 'bg-orange-500' :
                                    'bg-gray-400'
                                  }`}>
                                    {isDelivered ? (
                                      <CheckCircle className="h-4 w-4 text-white" />
                                    ) : isInTransit ? (
                                      <Truck className="h-4 w-4 text-white" />
                                    ) : isPickup ? (
                                      <Package className="h-4 w-4 text-white" />
                                    ) : (
                                      <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Event Content */}
                                <div className="flex-1 pb-6">
                                  <div className={`${
                                    isFirst ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                                  } border rounded-lg p-4`}>
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className={`font-semibold ${
                                        isFirst ? 'text-blue-900' : 'text-gray-900'
                                      }`}>
                                        {event.event}
                                      </h4>
                                      {isFirst && (
                                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Latest</span>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{event.location}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>{formatTrackingTime(event.time)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> This is a demo page showing simulated tracking data. 
                    In production, this data would come from the RapidDeals API for actual orders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}