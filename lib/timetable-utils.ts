// Timetable utility functions for member dashboard

export type SlotStatus =
  | 'available'        // Green - Coach free, clickable
  | 'booked'           // Gray - Lesson scheduled (not member's)
  | 'my-lesson'        // Blue - Member's confirmed lesson
  | 'my-pending'       // Yellow - Member's pending request
  | 'coach-suggested'  // Purple - Coach suggested different time (needs response)
  | 'unavailable'      // Light gray - Coach not available
  | 'training'         // Orange - Training group session

export interface TimeSlot {
  time: string      // "09:00", "09:30", etc.
  displayName: string // "9:00 AM", "9:30 AM", etc.
}

export interface DayData {
  date: Date
  dateString: string // "2025-01-16"
  dayName: string    // "Monday", "Tuesday", etc.
  dayShort: string   // "Mon", "Tue", etc.
  isToday: boolean
}

export interface AvailabilitySlot {
  startTime: string
  endTime: string
}

export interface ScheduledLesson {
  id: string
  startTime: string
  endTime: string
  lessonType: string
  status: string
  isMine: boolean
}

export interface PendingRequest {
  id: string
  requestedTime: string
  requestedDuration: number
  lessonType: string
}

export interface CoachSuggestedRequest {
  id: string
  originalDate: string
  originalTime: string
  suggestedDate: string
  suggestedTime: string
  requestedDuration: number
  lessonType: string
  adminNotes: string | null
}

export interface DayAvailability {
  dayOfWeek: number
  coachAvailability: AvailabilitySlot[]
  scheduledLessons: ScheduledLesson[]
  pendingRequests: PendingRequest[]
  coachSuggestedRequests?: CoachSuggestedRequest[] // Requests where coach suggested different time
  fullyBookedSlots?: string[] // Time slots where all courts are booked
}

// Generate time slots from 9 AM to midnight in 30-min increments
export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []

  // 9 AM to 11:30 PM
  for (let hour = 9; hour <= 23; hour++) {
    slots.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      displayName: formatTimeDisplay(hour, 0),
    })
    slots.push({
      time: `${hour.toString().padStart(2, '0')}:30`,
      displayName: formatTimeDisplay(hour, 30),
    })
  }

  // Midnight
  slots.push({
    time: '00:00',
    displayName: '12:00 AM',
  })

  return slots
}

// Format time for display (e.g., 9:00 AM)
export function formatTimeDisplay(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
}

// Parse time string to get hour and minute
export function parseTime(time: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = time.split(':')
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  }
}

// Convert time to minutes since midnight for comparison
export function timeToMinutes(time: string): number {
  const { hour, minute } = parseTime(time)
  // Handle midnight case
  if (hour === 0 && minute === 0) {
    return 24 * 60 // Treat as end of day
  }
  return hour * 60 + minute
}

// Check if a time is within a range
export function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  const t = timeToMinutes(time)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return t >= start && t < end
}

// Get slot status for a specific time on a specific day
export function getSlotStatus(
  time: string,
  dayData: DayAvailability | undefined,
  isPastDate: boolean
): { status: SlotStatus; lessonType?: string; lessonId?: string; requestId?: string; coachSuggestion?: CoachSuggestedRequest } {
  // If no data or past date, mark as unavailable
  if (!dayData || isPastDate) {
    return { status: 'unavailable' }
  }

  // Check if there's a coach-suggested time at this slot (show at SUGGESTED time)
  if (dayData.coachSuggestedRequests) {
    for (const suggestion of dayData.coachSuggestedRequests) {
      const suggestionEndTime = calculateEndTime(suggestion.suggestedTime, suggestion.requestedDuration)
      if (isTimeInRange(time, suggestion.suggestedTime, suggestionEndTime)) {
        return {
          status: 'coach-suggested',
          lessonType: suggestion.lessonType,
          requestId: suggestion.id,
          coachSuggestion: suggestion,
        }
      }
    }
  }

  // Check if it's the member's pending request (check full duration)
  for (const request of dayData.pendingRequests) {
    const requestEndTime = calculateEndTime(request.requestedTime, request.requestedDuration)
    if (isTimeInRange(time, request.requestedTime, requestEndTime)) {
      return {
        status: 'my-pending',
        lessonType: request.lessonType,
        requestId: request.id,
      }
    }
  }

  // Check if there's a scheduled lesson at this time
  for (const lesson of dayData.scheduledLessons) {
    if (isTimeInRange(time, lesson.startTime, lesson.endTime)) {
      if (lesson.isMine) {
        return {
          status: 'my-lesson',
          lessonType: lesson.lessonType,
          lessonId: lesson.id,
        }
      }
      return {
        status: 'booked',
        lessonType: lesson.lessonType,
      }
    }
  }

  // Check if coach is available at this time
  for (const slot of dayData.coachAvailability) {
    if (isTimeInRange(time, slot.startTime, slot.endTime)) {
      // Check if all courts are booked at this time
      if (dayData.fullyBookedSlots?.includes(time)) {
        return { status: 'unavailable' }
      }
      return { status: 'available' }
    }
  }

  // Not available
  return { status: 'unavailable' }
}

// Get week days starting from a given date (Monday start)
export function getWeekDays(startDate: Date): DayData[] {
  const days: DayData[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    date.setHours(0, 0, 0, 0)

    days.push({
      date,
      dateString: formatDateString(date),
      dayName: dayNames[date.getDay()],
      dayShort: dayShorts[date.getDay()],
      isToday: date.getTime() === today.getTime(),
    })
  }

  return days
}

// Format date as YYYY-MM-DD
export function formatDateString(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get start of week (Monday)
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Add weeks to a date
export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

// Format week range for display (e.g., "Jan 13 - 19, 2025")
export function formatWeekRange(startDate: Date): string {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
  const startDay = startDate.getDate()
  const endDay = endDate.getDate()
  const year = endDate.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
}

// Check if a date is in the past
export function isPastDate(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate < today
}

// Calculate end time based on start time and duration
export function calculateEndTime(startTime: string, durationHours: number): string {
  const { hour, minute } = parseTime(startTime)
  const totalMinutes = hour * 60 + minute + durationHours * 60
  const endHour = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
}

// Slot status colors for styling
export const slotStatusStyles: Record<SlotStatus, { bg: string; border: string; text: string; hover?: string }> = {
  available: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    hover: 'hover:bg-green-100 cursor-pointer',
  },
  booked: {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-500',
  },
  'my-lesson': {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
  },
  'my-pending': {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
  },
  'coach-suggested': {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-700',
  },
  unavailable: {
    bg: 'bg-gray-50',
    border: 'border-gray-100',
    text: 'text-gray-400',
  },
  training: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-700',
  },
}
