"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

interface CustomDatePickerProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function CustomDatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  className,
  id
}: CustomDatePickerProps) {
  // Convert string value to Date object
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [open, setOpen] = React.useState(false)
  
  // Generate years from current year to 10 years in the future
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i)
  
  const allMonths = [
    { value: "0", label: "Jan" },
    { value: "1", label: "Feb" },
    { value: "2", label: "Mar" },
    { value: "3", label: "Apr" },
    { value: "4", label: "May" },
    { value: "5", label: "Jun" },
    { value: "6", label: "Jul" },
    { value: "7", label: "Aug" },
    { value: "8", label: "Sep" },
    { value: "9", label: "Oct" },
    { value: "10", label: "Nov" },
    { value: "11", label: "Dec" },
  ]

  // Get available months based on selected year
  const getAvailableMonths = () => {
    const selectedYear = date?.getFullYear() || currentYear
    
    if (selectedYear === currentYear) {
      // For current year, show only current month and future months
      return allMonths.filter(m => parseInt(m.value) >= currentMonth)
    } else {
      // For future years, show all months
      return allMonths
    }
  }

  const months = getAvailableMonths()

  // Disable past dates and weekends
  const isDateDisabled = (checkDate: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Check if date is in the past
    if (checkDate < today) {
      return true
    }
    
    // Check if date is a weekend (0 = Sunday, 6 = Saturday)
    const dayOfWeek = checkDate.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true
    }
    
    return false
  }

  const handleMonthChange = (value: string) => {
    const currentDate = date || new Date()
    const year = currentDate.getFullYear()
    const month = parseInt(value)
    let day = currentDate.getDate()
    
    // Check if the selected day exists in the new month
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    if (day > daysInMonth) {
      day = daysInMonth
    }
    
    // Find the next valid weekday if the selected date is a weekend or past date
    let newDate = new Date(year, month, day)
    while (isDateDisabled(newDate) && day <= daysInMonth) {
      day++
      newDate = new Date(year, month, day)
    }
    
    // If we couldn't find a valid date in this month, set to first valid date of next month
    if (day > daysInMonth) {
      newDate = new Date(year, month + 1, 1)
      while (isDateDisabled(newDate)) {
        newDate.setDate(newDate.getDate() + 1)
      }
    }
    
    setDate(newDate)
    onValueChange?.(format(newDate, "yyyy-MM-dd"))
  }

  const handleYearChange = (value: string) => {
    const currentDate = date || new Date()
    const selectedYear = parseInt(value)
    let selectedMonth = currentDate.getMonth()
    
    // If switching to current year and selected month is in the past, use current month
    if (selectedYear === currentYear && selectedMonth < currentMonth) {
      selectedMonth = currentMonth
    }
    
    const newDate = new Date(selectedYear, selectedMonth, currentDate.getDate())
    setDate(newDate)
    onValueChange?.(format(newDate, "yyyy-MM-dd"))
  }

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate)
    if (newDate) {
      onValueChange?.(format(newDate, "yyyy-MM-dd"))
      // Auto-close the popover after selecting a date
      setOpen(false)
    }
  }

  // Handle previous/next month navigation
  const handlePreviousMonth = () => {
    const currentDate = date || new Date()
    const newMonth = currentDate.getMonth() - 1
    const newYear = currentDate.getFullYear()
    
    // Calculate the target date
    let targetDate: Date
    if (newMonth < 0) {
      targetDate = new Date(newYear - 1, 11, 1) // December of previous year
    } else {
      targetDate = new Date(newYear, newMonth, 1)
    }
    
    // Check if target month is before current month
    const today = new Date()
    const currentYearMonth = today.getFullYear() * 12 + today.getMonth()
    const targetYearMonth = targetDate.getFullYear() * 12 + targetDate.getMonth()
    
    if (targetYearMonth < currentYearMonth) {
      return // Don't allow navigating to past months
    }
    
    // Find a valid date in the target month
    const daysInTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
    let day = Math.min(currentDate.getDate(), daysInTargetMonth)
    
    let newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day)
    
    // Find next valid weekday if needed
    while (isDateDisabled(newDate) && day <= daysInTargetMonth) {
      day++
      newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day)
    }
    
    if (day <= daysInTargetMonth) {
      setDate(newDate)
      onValueChange?.(format(newDate, "yyyy-MM-dd"))
    }
  }

  const handleNextMonth = () => {
    const currentDate = date || new Date()
    const newMonth = currentDate.getMonth() + 1
    const newYear = currentDate.getFullYear()
    
    // Calculate the target date
    let targetDate: Date
    if (newMonth > 11) {
      targetDate = new Date(newYear + 1, 0, 1) // January of next year
    } else {
      targetDate = new Date(newYear, newMonth, 1)
    }
    
    // Check if we're going beyond 10 years from now
    const maxYear = new Date().getFullYear() + 10
    if (targetDate.getFullYear() > maxYear) {
      return
    }
    
    // Find a valid date in the target month
    const daysInTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate()
    let day = Math.min(currentDate.getDate(), daysInTargetMonth)
    
    let newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day)
    
    // Find next valid weekday if needed
    while (isDateDisabled(newDate) && day <= daysInTargetMonth) {
      day++
      newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day)
    }
    
    if (day <= daysInTargetMonth) {
      setDate(newDate)
      onValueChange?.(format(newDate, "yyyy-MM-dd"))
    }
  }

  // Check if previous month button should be disabled
  const isPreviousMonthDisabled = () => {
    const currentDate = date || new Date()
    const today = new Date()
    
    // Check if we're already at current month/year
    return (currentDate.getFullYear() === today.getFullYear() && 
            currentDate.getMonth() === today.getMonth()) ||
           (currentDate.getFullYear() === today.getFullYear() && 
            currentDate.getMonth() < today.getMonth()) ||
           (currentDate.getFullYear() < today.getFullYear())
  }

  // Check if next month button should be disabled
  const isNextMonthDisabled = () => {
    const currentDate = date || new Date()
    const maxYear = new Date().getFullYear() + 10
    
    return (currentDate.getFullYear() === maxYear && currentDate.getMonth() === 11)
  }

  // Format month and year for display
  const getMonthYearDisplay = () => {
    const displayDate = date || new Date()
    return format(displayDate, "MMMM yyyy")
  }

  // Update internal date when external value changes
  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value)
      if (!isNaN(newDate.getTime())) {
        setDate(newDate)
      }
    } else {
      setDate(undefined)
    }
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-3 p-3 border-b">
          {/* Month and Year selectors */}
          <div className="flex items-center gap-2">
            {/* Month selector */}
            <Select 
              value={date?.getMonth().toString() || ""} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="flex-1 h-8 focus:ring-0">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="py-1">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year selector */}
            <Select 
              value={date?.getFullYear().toString() || ""} 
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[90px] h-8 focus:ring-0">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()} className="py-1">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month/Year display with navigation buttons */}
          <div className="flex items-center justify-between px-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePreviousMonth}
              disabled={isPreviousMonthDisabled()}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous month</span>
            </Button>
            
            <div className="text-sm font-medium">
              {getMonthYearDisplay()}
            </div>
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNextMonth}
              disabled={isNextMonthDisabled()}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next month</span>
            </Button>
          </div>
        </div>
        
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          month={date}
          onMonthChange={setDate}
          disabled={isDateDisabled}
          hideCaption={true}
          initialFocus
          className="[&_.rdp-nav]:hidden p-3"
        />
      </PopoverContent>
    </Popover>
  )
}