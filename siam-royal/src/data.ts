import { Therapist, Booking } from './types'

export const THERAPISTS: Therapist[] = [
  { id: 'nk', name: 'นกนา กิมม่า', nameEn: 'Nona', avatar: 'NK', specialty: 'Deep tissue', color: '#7B9E87' },
  { id: 'mr', name: 'มาตา รุจ', nameEn: 'Mata', avatar: 'MR', specialty: 'Sports recovery', color: '#8B9BB4' },
  { id: 'ap', name: 'อาภา ปาเตล', nameEn: 'Apha', avatar: 'AP', specialty: 'Relaxation', color: '#B4957A' },
  { id: 'dl', name: 'ดลยา ลี', nameEn: 'Dolya', avatar: 'DL', specialty: 'Specialty', color: '#9B8DB4' },
  { id: 'gina', name: 'จีน่า', nameEn: 'Gina', avatar: 'GN', specialty: 'Thai massage', color: '#7B9E87' },
  { id: 'som', name: 'สมหมาย ใจดี', nameEn: 'Som', avatar: 'SM', specialty: 'Deep tissue', color: '#B4957A' },
  { id: 'malee', name: 'มาลี รักดี', nameEn: 'Malee', avatar: 'ML', specialty: 'Relaxation', color: '#8B9BB4' },
]

export const SERVICES = [
  { id: 'thai', name: 'นวดไทย', nameEn: 'Thai massage', duration: 60, color: '#7B9E87' },
  { id: 'oil', name: 'นวดน้ำมัน', nameEn: 'Oil massage', duration: 60, color: '#B4957A' },
  { id: 'deep', name: 'ดีพทิชชู่', nameEn: 'Deep tissue', duration: 90, color: '#8B9BB4' },
  { id: 'hot', name: 'ฮอตสโตน', nameEn: 'Hot stone therapy', duration: 90, color: '#9B8DB4' },
  { id: 'sports', name: 'สปอร์ต', nameEn: 'Sports recovery', duration: 60, color: '#7B9E87' },
  { id: 'foot', name: 'นวดเท้า', nameEn: 'Foot massage', duration: 45, color: '#B4957A' },
]

export const SAMPLE_BOOKINGS: Booking[] = [
  { id: 'b1', clientName: 'สมชาย ใจดี', service: 'นวดไทย', duration: 60, time: '09:00', therapistId: 'gina', status: 'confirmed', type: 'relaxation' },
  { id: 'b2', clientName: 'มาลี รักสวย', service: 'ฮอตสโตน', duration: 90, time: '10:00', therapistId: 'nk', status: 'in-session', type: 'specialty' },
  { id: 'b3', clientName: 'วิชัย แข็งแรง', service: 'ดีพทิชชู่', duration: 90, time: '11:00', therapistId: 'mr', status: 'arrived', type: 'deep-tissue' },
  { id: 'b4', clientName: 'นิดา สุขใจ', service: 'นวดน้ำมัน', duration: 60, time: '13:00', therapistId: 'ap', status: 'confirmed', type: 'relaxation' },
  { id: 'b5', clientName: 'ธนา มั่งมี', service: 'สปอร์ต', duration: 60, time: '14:00', therapistId: 'dl', status: 'confirmed', type: 'sports' },
  { id: 'b6', clientName: 'จันทร์ งามสวย', service: 'นวดเท้า', duration: 45, time: '15:00', therapistId: 'gina', status: 'confirmed', type: 'relaxation' },
  { id: 'b7', clientName: 'ประยุทธ์ ดีงาม', service: 'นวดไทย', duration: 60, time: '09:30', therapistId: 'som', status: 'completed', type: 'relaxation' },
  { id: 'b8', clientName: 'อรทัย ชื่นบาน', service: 'ดีพทิชชู่', duration: 90, time: '11:30', therapistId: 'malee', status: 'confirmed', type: 'deep-tissue' },
]

export const SICK_REASONS = [
  'ไข้',
  'ปวดหัว',
  'ปวดท้อง',
  'ลาพักร้อน',
  'กิจธุระส่วนตัว',
  'อื่นๆ',
]
