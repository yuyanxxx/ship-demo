// Quote Results Fetching API Integration
// Based on API documentation at /xxx-endpoint/报价/获取报价（LTL）异步处理

export interface AccessorialItem {
  serviceCode?: string
  chargeAmount: string
  serviceName: string
}

export interface QuoteRate {
  orderId: string
  rateId: string
  accessorialCharge: string
  carrierTransitDays: number
  totalCharge: string
  fuelCharge: string
  lineCharge: string
  carrierSCAC: string
  carrierName: string
  description?: Record<string, unknown>
  customerDump: number
  accesoriesList?: AccessorialItem[]
  carrierGuarantee?: string
  insuredCharge: string
}

export interface QuoteResultsResponse {
  code: number
  success: boolean
  data: {
    orderId: string
    rates: QuoteRate[]
  }
  msg: string
}

export async function fetchQuoteResults(quoteOrderId: string): Promise<QuoteResultsResponse> {
  const apiUrl = process.env.RAPIDDEALS_API_URL || 'https://ship.rapiddeals.com/api/shipment'
  const apiId = process.env.RAPIDDEALS_API_ID
  const apiKey = process.env.RAPIDDEALS_API_KEY

  if (!apiId || !apiKey) {
    throw new Error('RapidDeals API credentials not configured')
  }

  console.log('\n=== Fetching Quote Results ===')
  console.log('Quote Order ID:', quoteOrderId)
  console.log('Timestamp:', new Date().toISOString())

  // Add retry logic for network errors
  let retries = 2  // Fewer retries for polling
  let lastError: Error | null = null
  
  while (retries > 0) {
    try {
      const response = await fetch(`${apiUrl}/getRates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_Id': apiId,
          'user_key': apiKey
        },
        body: JSON.stringify({
          quoteOrderId
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error fetching quote results:', errorText)
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json() as QuoteResultsResponse
      
      console.log('Quote Results Retrieved:')
      console.log('- Order ID:', result.data?.orderId)
      console.log('- Number of Rates:', result.data?.rates?.length || 0)
      console.log('- Success:', result.success)
      
      return result
    } catch (error) {
      lastError = error as Error
      retries--
      
      console.error(`Error fetching results (${2 - retries}/2):`, error)
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  // All retries failed
  console.error('All retries failed for fetchQuoteResults')
  throw lastError || new Error('Failed to fetch quote results after retries')
}

// Helper function for polling quote results
export async function pollQuoteResults(
  quoteOrderId: string, 
  maxAttempts: number = 3,
  intervalMs: number = 4000
): Promise<QuoteRate[]> {
  let attempts = 0
  const allRates: QuoteRate[] = []
  const rateIds = new Set<string>()

  console.log(`\n=== Starting Quote Polling ===`)
  console.log(`Order ID: ${quoteOrderId}`)
  console.log(`Max Attempts: ${maxAttempts}`)
  console.log(`Interval: ${intervalMs}ms`)

  while (attempts < maxAttempts) {
    attempts++
    console.log(`\nPolling attempt ${attempts}/${maxAttempts}...`)
    
    try {
      const response = await fetchQuoteResults(quoteOrderId)
      
      if (response.success && response.data?.rates) {
        // Add new rates that we haven't seen before
        for (const rate of response.data.rates) {
          if (!rateIds.has(rate.rateId)) {
            rateIds.add(rate.rateId)
            allRates.push(rate)
            console.log(`- New rate found: ${rate.carrierName} (${rate.rateId}) - $${rate.totalCharge}`)
          }
        }
      }
      
      // Wait before next attempt (except for the last one)
      if (attempts < maxAttempts) {
        console.log(`Waiting ${intervalMs}ms before next attempt...`)
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    } catch (error) {
      console.error(`Error on attempt ${attempts}:`, error)
      // Continue polling even if one attempt fails
    }
  }

  console.log(`\n=== Polling Complete ===`)
  console.log(`Total unique rates collected: ${allRates.length}`)
  
  // Sort rates by total charge (lowest first)
  allRates.sort((a, b) => parseFloat(a.totalCharge) - parseFloat(b.totalCharge))
  
  return allRates
}