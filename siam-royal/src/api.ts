const BASE = '/api'

export interface Therapist {
  id: string
  name: string
  nameEn: string
  avatar: string
  specialty: string
  color: string
}

export interface Service {
  id: string
  name: string
  nameEn: string
  duration: number
  color: string
  type: string
  price: number
}

export interface ShopOpenLog {
  id: number
  date: string
  opened_at: string
  opened_by: string
  opened_by_id: string
}

export interface AttendanceRecord {
  therapistId: string
  date: string
  status: 'working' | 'sick' | 'off'
  sickReason: string | null
  sickNote: string | null
  therapist: Therapist
}

export interface Booking {
  id: string
  date: string
  time: string
  duration: number
  therapistId: string
  clientName: string
  serviceId: string
  serviceName: string
  type: 'deep-tissue' | 'sports' | 'relaxation' | 'specialty'
  status: 'confirmed' | 'arrived' | 'in-session' | 'completed'
  note: string | null
  price: number | null
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) { const msg = await r.json().catch(() => ({ error: r.statusText })); throw new Error(msg.error || r.statusText) }
  return r.json()
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) { const msg = await r.json().catch(() => ({ error: r.statusText })); throw new Error(msg.error || r.statusText) }
  return r.json()
}

async function del(path: string): Promise<void> {
  const r = await fetch(BASE + path, { method: 'DELETE' })
  if (!r.ok) throw new Error(r.statusText)
}

export const api = {
  therapists: {
    list: () => get<Therapist[]>('/therapists'),
    create: (data: { name: string; name_en: string; specialty?: string; color?: string }) => post<Therapist>('/therapists', data),
    update: (id: string, data: Partial<Therapist>) => patch<Therapist>(`/therapists/${id}`, data),
    remove: (id: string) => del(`/therapists/${id}`),
  },
  services: {
    list: () => get<Service[]>('/services'),
  },
  attendance: {
    get: (date: string) => get<AttendanceRecord[]>(`/attendance?date=${date}`),
    save: (date: string, records: { therapistId: string; status: string; sickReason?: string; sickNote?: string }[]) =>
      post<AttendanceRecord[]>('/attendance', { date, records }),
    patch: (therapistId: string, date: string, data: { status: string; sickReason?: string; sickNote?: string }) =>
      patch(`/attendance/${therapistId}?date=${date}`, data),
  },
  bookings: {
    list: (date: string) => get<Booking[]>(`/bookings?date=${date}`),
    create: (data: {
      date: string; time: string; duration?: number; therapistId: string;
      clientName: string; serviceId: string; serviceName?: string; type?: string; note?: string; price?: number
    }) => post<Booking>('/bookings', data),
    updateStatus: (id: string, status: Booking['status']) => patch<Booking>(`/bookings/${id}`, { status }),
    update: (id: string, data: Partial<Booking>) => patch<Booking>(`/bookings/${id}`, data),
    remove: (id: string) => del(`/bookings/${id}`),
  },
  pricing: {
    get: () => get<{ pricing: Record<string, number>; durations: Record<string, number[]>; priceKeyMap: Record<string, string> }>('/pricing'),
  },
  shopOpen: {
    get: (date: string) => get<ShopOpenLog | null>(`/shop-open?date=${date}`),
    save: (date: string, openedById: string, openedByName: string) =>
      post<ShopOpenLog>('/shop-open', { date, openedById, openedByName }),
    history: (limit = 30) => get<ShopOpenLog[]>(`/shop-open/history?limit=${limit}`),
  },
}
