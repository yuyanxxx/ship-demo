import { NextRequest, NextResponse } from 'next/server'
import type { QuoteResultsResponse } from '@/lib/rapiddeals-quote-results-api'

// Mock quote results for testing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { quoteOrderId } = body
    
    console.log('\n=== MOCK: Fetching Quote Results ===')
    console.log('Order ID:', quoteOrderId)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Generate mock quotes with varying prices
    const mockQuotes = [
      {
        orderId: quoteOrderId,
        rateId: '000001',
        accessorialCharge: '75.00',
        carrierTransitDays: 2,
        totalCharge: '485.50',
        fuelCharge: '42.50',
        lineCharge: '368.00',
        carrierSCAC: 'RDWY',
        carrierName: 'YRC Freight',
        customerDump: 0,
        accesoriesList: [
          {
            serviceName: 'Inside Delivery',
            chargeAmount: '75.00',
            serviceCode: 'ISD'
          }
        ],
        carrierGuarantee: 'Standard',
        insuredCharge: '25.00'
      },
      {
        orderId: quoteOrderId,
        rateId: '000002',
        accessorialCharge: '65.00',
        carrierTransitDays: 3,
        totalCharge: '425.00',
        fuelCharge: '35.00',
        lineCharge: '325.00',
        carrierSCAC: 'EXLA',
        carrierName: 'Estes Express Lines',
        customerDump: 0,
        accesoriesList: [
          {
            serviceName: 'Inside Delivery',
            chargeAmount: '65.00',
            serviceCode: 'ISD'
          }
        ],
        carrierGuarantee: 'GN',
        insuredCharge: '30.00'
      },
      {
        orderId: quoteOrderId,
        rateId: '000003',
        accessorialCharge: '80.00',
        carrierTransitDays: 1,
        totalCharge: '550.00',
        fuelCharge: '50.00',
        lineCharge: '420.00',
        carrierSCAC: 'FXFE',
        carrierName: 'FedEx Freight',
        customerDump: 0,
        accesoriesList: [
          {
            serviceName: 'Inside Delivery',
            chargeAmount: '80.00',
            serviceCode: 'ISD'
          },
          {
            serviceName: 'Liftgate Service',
            chargeAmount: '0.00',
            serviceCode: 'LG'
          }
        ],
        carrierGuarantee: 'Priority',
        insuredCharge: '35.00'
      },
      {
        orderId: quoteOrderId,
        rateId: '000004',
        accessorialCharge: '70.00',
        carrierTransitDays: 2,
        totalCharge: '465.00',
        fuelCharge: '40.00',
        lineCharge: '355.00',
        carrierSCAC: 'ODFL',
        carrierName: 'Old Dominion Freight Line',
        customerDump: 0,
        accesoriesList: [
          {
            serviceName: 'Inside Delivery',
            chargeAmount: '70.00',
            serviceCode: 'ISD'
          }
        ],
        carrierGuarantee: 'GN',
        insuredCharge: '25.00'
      },
      {
        orderId: quoteOrderId,
        rateId: '000005',
        accessorialCharge: '55.00',
        carrierTransitDays: 4,
        totalCharge: '398.00',
        fuelCharge: '33.00',
        lineCharge: '310.00',
        carrierSCAC: 'SAIA',
        carrierName: 'Saia LTL Freight',
        customerDump: 0,
        accesoriesList: [
          {
            serviceName: 'Inside Delivery',
            chargeAmount: '55.00',
            serviceCode: 'ISD'
          }
        ],
        carrierGuarantee: 'Standard',
        insuredCharge: '-1' // Not available
      }
    ]
    
    // Randomly return 2-5 quotes to simulate real behavior
    const numQuotes = Math.floor(Math.random() * 4) + 2
    const selectedQuotes = mockQuotes.slice(0, numQuotes)
    
    const response: QuoteResultsResponse = {
      code: 200,
      success: true,
      data: {
        orderId: quoteOrderId,
        rates: selectedQuotes
      },
      msg: 'success (MOCK)'
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in mock quote results API:', error)
    return NextResponse.json(
      { error: 'Mock API error' },
      { status: 500 }
    )
  }
}