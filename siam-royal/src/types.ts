export type Page = 'open-shop' | 'working-today' | 'sick-leave' | 'schedule'

export interface Therapist {
  id: string
  name: string
  nameEn: string
  avatar: string
  specialty: string
  color: string
}

export interface Booking {
  id: string
  clientName: string
  service: string
  duration: number
  time: string
  therapistId: string
  status: 'confirmed' | 'arrived' | 'in-session' | 'completed'
  type: 'deep-tissue' | 'sports' | 'relaxation' | 'specialty'
}

export interface AppState {
  currentPage: Page
  selectedDate: Date
  workingTherapists: string[]
  sickTherapists: string[]
  sickLeaveData: {
    id: string
    reason: string
    note: string
  }[]
  bookings: Booking[]
  shopOpened: boolean
  setupDone: boolean
}
