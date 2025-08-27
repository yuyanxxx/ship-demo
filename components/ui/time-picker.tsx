"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TimePickerProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  minTime?: string // Minimum time in 24-hour format (HH:mm)
  disabled?: boolean
  error?: boolean // Add error state prop
  showSaveButton?: boolean // Show save button in the popover
  onSave?: () => void // Callback when save is clicked
}

export function TimePicker({
  value,
  onValueChange,
  placeholder = "Select time",
  className,
  id,
  minTime,
  disabled = false,
  error = false,
  showSaveButton = false,
  onSave
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [time, setTime] = React.useState<{ hour: string; minute: string; period: string }>({
    hour: "",
    minute: "",
    period: "AM"
  })
  
  // Initialize default values when popover opens for the first time
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    
    if (newOpen && !value && !time.hour) {
      // Check if we have a minTime restriction
      if (minTime) {
        const [hour24, minute] = minTime.split(':').map(Number)
        let defaultPeriod = 'AM'
        let defaultHour = '09'
        let defaultMinute = '00'
        
        // Calculate the next available time slot after minTime
        let nextHour24 = hour24
        let nextMinute = minute
        
        // Always move to the next 15-minute interval
        if (minute >= 45) {
          nextHour24 = hour24 + 1
          nextMinute = 0
        } else if (minute >= 30) {
          nextMinute = 45
        } else if (minute >= 15) {
          nextMinute = 30
        } else if (minute >= 0) {
          nextMinute = 15
        }
        
        // If the calculated time is the same as minTime, move to next slot
        if (nextHour24 === hour24 && nextMinute === minute) {
          if (nextMinute >= 45) {
            nextHour24 = hour24 + 1
            nextMinute = 0
          } else {
            nextMinute = nextMinute + 15
          }
        }
        
        // Ensure we're within business hours (9 AM - 5 PM)
        if (nextHour24 < 9) {
          nextHour24 = 9
          nextMinute = 0
        } else if (nextHour24 > 17 || (nextHour24 === 17 && nextMinute > 0)) {
          // Past 5 PM, cap at 5 PM
          nextHour24 = 17
          nextMinute = 0
        }
        
        // Convert to 12-hour format
        if (nextHour24 >= 12) {
          defaultPeriod = 'PM'
          if (nextHour24 === 12) {
            defaultHour = '12'
          } else {
            defaultHour = (nextHour24 - 12).toString().padStart(2, '0')
          }
        } else {
          defaultPeriod = 'AM'
          defaultHour = nextHour24.toString().padStart(2, '0')
        }
        
        defaultMinute = nextMinute.toString().padStart(2, '0')
        
        setTime({
          hour: defaultHour,
          minute: defaultMinute,
          period: defaultPeriod
        })
        
        const timeValue = `${nextHour24.toString().padStart(2, '0')}:${defaultMinute}`
        onValueChange?.(timeValue)
      } else {
        // No minTime restriction, use 9:00 AM as default
        const defaultPeriod = "AM"
        const defaultHour = "09"
        const defaultMinute = "00"
        
        setTime({
          hour: defaultHour,
          minute: defaultMinute,
          period: defaultPeriod
        })
        
        const timeValue = `09:00`
        onValueChange?.(timeValue)
      }
    }
  }

  // Parse minTime to get restrictions
  const getMinTimeRestrictions = () => {
    if (!minTime) return { minHour12: 0, minMinute: 0, minPeriod: 'AM' }
    
    const [hour24, minute] = minTime.split(':').map(Number)
    let hour12 = hour24
    let period = 'AM'
    
    if (hour24 === 0) {
      hour12 = 12
      period = 'AM'
    } else if (hour24 === 12) {
      hour12 = 12
      period = 'PM'
    } else if (hour24 > 12) {
      hour12 = hour24 - 12
      period = 'PM'
    }
    
    return { minHour12: hour12, minMinute: minute, minPeriod: period }
  }

  const restrictions = getMinTimeRestrictions()

  // Generate available periods based on minTime
  const getAvailablePeriods = () => {
    if (!minTime) return [{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]
    
    // If minimum time is PM, only PM is available
    if (restrictions.minPeriod === 'PM') {
      return [{ value: "PM", label: "PM" }]
    }
    
    // Both AM and PM available
    return [{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]
  }

  // Generate available hours based on selected period and minTime
  const getAvailableHours = (selectedPeriod: string) => {
    // Restrict hours based on business hours
    let availableHours = []
    
    if (selectedPeriod === 'AM') {
      // AM hours: 9, 10, 11 (no 12 AM as that's midnight)
      availableHours = [
        { value: '09', label: '9' },
        { value: '10', label: '10' },
        { value: '11', label: '11' }
      ]
    } else {
      // PM hours: 12, 1, 2, 3, 4, 5
      availableHours = [
        { value: '12', label: '12' },
        { value: '01', label: '1' },
        { value: '02', label: '2' },
        { value: '03', label: '3' },
        { value: '04', label: '4' },
        { value: '05', label: '5' }
      ]
    }

    if (!minTime) return availableHours

    // If period is before minimum period, no hours available
    if (restrictions.minPeriod === 'PM' && selectedPeriod === 'AM') {
      return []
    }

    // If same period as minimum, filter hours
    if (selectedPeriod === restrictions.minPeriod) {
      return availableHours.filter(h => {
        const hour = parseInt(h.label)
        const minHour = restrictions.minHour12
        
        // For PM period, 12 comes before 1-5
        if (selectedPeriod === 'PM') {
          const actualHour = hour === 12 ? 0 : hour // Treat 12 PM as 0 for comparison
          const actualMinHour = minHour === 12 ? 0 : minHour
          
          if (actualHour === actualMinHour) {
            return restrictions.minMinute < 45
          }
          return actualHour > actualMinHour
        }
        
        // For AM period, simple comparison (9, 10, 11)
        return hour > minHour || (hour === minHour && restrictions.minMinute < 45)
      })
    }

    // If period is after minimum period, all hours available
    return availableHours
  }

  // Generate available minutes based on selected hour, period and minTime
  const getAvailableMinutes = (selectedHour: string, selectedPeriod: string) => {
    const allMinutes = [
      { value: "00", label: "00" },
      { value: "15", label: "15" },
      { value: "30", label: "30" },
      { value: "45", label: "45" }
    ]

    if (!minTime) return allMinutes

    // If different period or hour from minimum, all minutes available
    if (selectedPeriod !== restrictions.minPeriod) {
      return selectedPeriod === 'PM' ? allMinutes : allMinutes
    }

    const hour = parseInt(selectedHour)
    
    // If same hour as minimum, filter minutes
    if (selectedPeriod === restrictions.minPeriod && hour === restrictions.minHour12) {
      return allMinutes.filter(m => parseInt(m.value) > restrictions.minMinute)
    }

    // If hour is after minimum, all minutes available
    if (hour > restrictions.minHour12 || (selectedPeriod === 'PM' && restrictions.minPeriod === 'AM')) {
      return allMinutes
    }

    return allMinutes
  }

  const periods = getAvailablePeriods()
  const hours = getAvailableHours(time.period)
  const minutes = getAvailableMinutes(time.hour, time.period)

  // Convert 24-hour format to 12-hour format for display
  React.useEffect(() => {
    if (value) {
      const [hourStr, minuteStr] = value.split(':')
      const hour24 = parseInt(hourStr)
      const minute = minuteStr
      
      if (hour24 === 0) {
        setTime({ hour: "12", minute, period: "AM" })
      } else if (hour24 <= 12) {
        setTime({ hour: hour24.toString().padStart(2, '0'), minute, period: hour24 === 12 ? "PM" : "AM" })
      } else {
        setTime({ hour: (hour24 - 12).toString().padStart(2, '0'), minute, period: "PM" })
      }
    } else {
      // Reset the internal state when value is cleared
      setTime({ hour: "", minute: "", period: "AM" })
    }
  }, [value])

  // Convert 12-hour format to 24-hour format for value
  const updateValue = (newHour: string, newMinute: string, newPeriod: string) => {
    if (!newHour || !newMinute) return
    
    let hour24 = parseInt(newHour)
    
    if (newPeriod === "AM") {
      // AM hours are 9, 10, 11 (no conversion needed)
      // hour24 stays as is
    } else if (newPeriod === "PM") {
      // PM hours: 12 stays as 12, 1-5 become 13-17
      if (hour24 !== 12) {
        hour24 += 12
      }
    }
    
    const timeValue = `${hour24.toString().padStart(2, '0')}:${newMinute}`
    onValueChange?.(timeValue)
  }

  const handleHourChange = (newHour: string) => {
    const availableMinutes = getAvailableMinutes(newHour, time.period)
    let newMinute = time.minute
    
    // If current minute is not valid with new hour, or if no minute is set, select first available minute
    if (!time.minute || !availableMinutes.find(m => m.value === time.minute)) {
      newMinute = availableMinutes[0]?.value || "00"
    }
    
    const newTime = { ...time, hour: newHour, minute: newMinute }
    setTime(newTime)
    updateValue(newHour, newMinute, time.period)
  }

  const handleMinuteChange = (newMinute: string) => {
    const newTime = { ...time, minute: newMinute }
    setTime(newTime)
    if (time.hour) {
      updateValue(time.hour, newMinute, time.period)
    }
  }

  const handlePeriodChange = (newPeriod: string) => {
    // Check if hours need to be reset based on new period
    const availableHours = getAvailableHours(newPeriod)
    let newHour = time.hour
    let newMinute = time.minute
    
    // If current hour is not available in new period, select first available hour
    if (!availableHours.find(h => h.value === time.hour)) {
      newHour = availableHours[0]?.value || ""
      // If we're setting a new hour, also set a default minute if none is set
      if (!newMinute && newHour) {
        const availableMinutes = getAvailableMinutes(newHour, newPeriod)
        newMinute = availableMinutes[0]?.value || "00"
      }
    } else if (time.hour) {
      // Check if minutes need to be reset
      const availableMinutes = getAvailableMinutes(time.hour, newPeriod)
      if (time.minute && !availableMinutes.find(m => m.value === time.minute)) {
        newMinute = availableMinutes[0]?.value || "00"
      }
      // If no minute was set, set a default one
      if (!newMinute) {
        newMinute = availableMinutes[0]?.value || "00"
      }
    }
    
    // If switching to a new period and we have no hour set, select the first available
    if (!newHour && availableHours.length > 0) {
      newHour = availableHours[0].value
      const availableMinutes = getAvailableMinutes(newHour, newPeriod)
      newMinute = availableMinutes[0]?.value || "00"
    }
    
    const newTime = { hour: newHour, minute: newMinute, period: newPeriod }
    setTime(newTime)
    
    if (newHour && newMinute) {
      updateValue(newHour, newMinute, newPeriod)
    }
  }

  const formatDisplayTime = () => {
    if (time.hour && time.minute) {
      return `${time.hour}:${time.minute} ${time.period}`
    }
    return null
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !formatDisplayTime() && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatDisplayTime() || <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2">
          {/* Hour selector */}
          <Select value={time.hour} onValueChange={handleHourChange}>
            <SelectTrigger className="w-16 h-10">
              <SelectValue placeholder="12" />
            </SelectTrigger>
            <SelectContent>
              {hours.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-muted-foreground">:</span>

          {/* Minute selector */}
          <Select value={time.minute} onValueChange={handleMinuteChange}>
            <SelectTrigger className="w-16 h-10">
              <SelectValue placeholder="00" />
            </SelectTrigger>
            <SelectContent>
              {minutes.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AM/PM selector */}
          <Select value={time.period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-16 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          {showSaveButton && (
            <Button 
              size="sm" 
              onClick={() => {
                setOpen(false)
                onSave?.()
              }}
              className="w-full"
            >
              Save
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}