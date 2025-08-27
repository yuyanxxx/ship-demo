"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

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

export default function DatePickerDemo() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Date of Birth Picker</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <DateOfBirthPicker />
        </div>
      </div>
    </div>
  )
}


// Date of Birth Picker Component
function DateOfBirthPicker() {
  const [date, setDate] = React.useState<Date>()
  
  // Generate years from 1900 to current year
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i)
  
  const months = [
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


  const handleMonthChange = (value: string) => {
    const currentDate = date || new Date()
    const newDate = new Date(currentDate.getFullYear(), parseInt(value), currentDate.getDate())
    setDate(newDate)
  }

  const handleYearChange = (value: string) => {
    const currentDate = date || new Date()
    const newDate = new Date(parseInt(value), currentDate.getMonth(), currentDate.getDate())
    setDate(newDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Select date of birth</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center gap-2 p-3 border-b">
          {/* Month selector without arrows */}
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

          {/* Year selector without arrows */}
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
        
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          month={date}
          onMonthChange={setDate}
          initialFocus
          className="[&_.rdp-nav]:hidden [&_.rdp-month_caption]:hidden p-3"
        />
      </PopoverContent>
    </Popover>
  )
}

