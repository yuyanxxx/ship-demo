/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useState } from "react"

interface OrderSummaryProps {
  lineCharge: string | number
  fuelCharge: string | number
  accessorialCharge: string | number
  totalCharge: string | number
  declaredValue: string
  onDeclaredValueChange: (value: string) => void
  onPlaceOrder: () => void
  submitting: boolean
  isDisabled?: boolean
  disabledReason?: string
  maxDeclaredValue?: number
  onQueryInsurance?: (value: string) => Promise<{ insuranceAmount: string; compensationCeiling: string } | void>
}

export function OrderSummary({
  lineCharge,
  fuelCharge,
  accessorialCharge,
  totalCharge,
  declaredValue,
  onDeclaredValueChange,
  onPlaceOrder,
  submitting,
  isDisabled = false,
  disabledReason,
  maxDeclaredValue = 0,
  onQueryInsurance
}: OrderSummaryProps) {
  const [totalShipmentValue, setTotalShipmentValue] = useState('')
  const [insuranceQuote, setInsuranceQuote] = useState<{ amount: number; compensationCeiling: number } | null>(null)
  const [queryingInsurance, setQueryingInsurance] = useState(false)
  const [insuranceError, setInsuranceError] = useState<string | null>(null)

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    
    // Prices already have price ratio applied from the backend API
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  const handleQueryInsurance = async () => {
    if (!onQueryInsurance || !totalShipmentValue) return
    
    setQueryingInsurance(true)
    setInsuranceError(null)
    
    try {
      const result = await onQueryInsurance(totalShipmentValue)
      if (result && 'insuranceAmount' in result) {
        setInsuranceQuote({
          amount: parseFloat(result.insuranceAmount),
          compensationCeiling: parseFloat(result.compensationCeiling)
        })
      }
    } catch (error) {
      setInsuranceError(error instanceof Error ? error.message : 'Failed to query insurance')
    } finally {
      setQueryingInsurance(false)
    }
  }

  return (
    <Card className="md:w-80 md:sticky md:top-4">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between text-2xl font-bold">
            <span>Shipping Fee</span>
            <div className="text-right">
              <span className="text-green-600">{formatCurrency(totalCharge)}</span>
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground border-t pt-3">
            <div className="flex justify-between">
              <span>Base Rate</span>
              <div className="text-right">
                <span>{formatCurrency(lineCharge)}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Fuel Surcharge</span>
              <div className="text-right">
                <span>{formatCurrency(fuelCharge)}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Accessorials</span>
              <div className="text-right">
                <span>{formatCurrency(accessorialCharge)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Insurance Section */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">Insurance</h3>
          
          <div className="space-y-2">
            <Label htmlFor="totalShipmentValue">
              Total Shipment Value
              {maxDeclaredValue > 0 && (
                <span className="text-xs text-muted-foreground block">
                  Maximum: {formatCurrency(maxDeclaredValue)}
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="totalShipmentValue"
                type="number"
                step="0.01"
                min="0"
                max={maxDeclaredValue}
                placeholder="0.00"
                value={totalShipmentValue}
                onChange={(e) => {
                  const value = e.target.value
                  const numValue = parseFloat(value)
                  if (numValue > maxDeclaredValue) {
                    setTotalShipmentValue(maxDeclaredValue.toString())
                  } else {
                    setTotalShipmentValue(value)
                  }
                  setInsuranceQuote(null)
                  setInsuranceError(null)
                }}
                className="pl-7"
              />
            </div>
          </div>
          
          <Button
            onClick={handleQueryInsurance}
            disabled={!totalShipmentValue || parseFloat(totalShipmentValue) <= 0 || queryingInsurance}
            variant="outline"
            className="w-full"
          >
            {queryingInsurance ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Querying Insurance...
              </>
            ) : (
              'Query Insurance Quote'
            )}
          </Button>
          
          {insuranceError && (
            <div className="text-sm text-red-600">
              {insuranceError}
            </div>
          )}
          
          {insuranceQuote && (
            <div className="bg-gray-50 p-3 rounded-md space-y-2">
              <div className="flex justify-between text-sm">
                <span>Insurance Premium:</span>
                <div className="text-right">
                  <span className="font-semibold">{formatCurrency(insuranceQuote.amount)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span>Coverage Limit:</span>
                <span className="font-semibold">{formatCurrency(insuranceQuote.compensationCeiling)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Place Order Button */}
        <div className="border-t pt-4">
          <Button 
            onClick={onPlaceOrder}
            disabled={submitting || isDisabled}
            className="w-full"
            size="lg"
            title={isDisabled ? disabledReason : undefined}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Placing Order...
              </>
            ) : (
              'Place Order'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}