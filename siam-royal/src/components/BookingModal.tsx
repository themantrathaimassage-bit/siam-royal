import { useState, useEffect } from 'react'
import { api, Booking, Therapist, Service } from '../api'
import './BookingModal.css'

interface Props {
  date: string
  therapists: Therapist[]
  services: Service[]
  booking?: Booking
  prefillTherapistId?: string
  prefillTime?: string
  onSave: (b: Booking) => void
  onClose: () => void
}

const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']
const ACCENT: Record<string, string> = {
  teal: '#2D8C8C', blue: '#4A6FA5', orange: '#C07840',
  purple: '#7A6AAA', green: '#4A9B6A', pink: '#B86080', gray: '#7A7A8A'
}
const BG: Record<string, string> = {
  teal: '#E6F4F4', blue: '#EBF0F8', orange: '#FBF2EA',
  purple: '#F2EFF8', green: '#EBF5EE', pink: '#F8EEF3', gray: '#F0F0F2'
}

export default function BookingModal({ date, therapists, services, booking, prefillTherapistId, prefillTime, onSave, onClose }: Props) {
  const isEdit = !!booking

  const [therapistId] = useState(booking?.therapistId || prefillTherapistId || therapists[0]?.id || '')
  const [serviceId, setServiceId] = useState(booking?.serviceId || services[0]?.id || '')
  const [duration, setDuration] = useState(booking?.duration || 60)
  const [note, setNote] = useState(booking?.note || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [durations, setDurations] = useState<Record<string, number[]>>({})
  const [priceKeyMap, setPriceKeyMap] = useState<Record<string, string>>({})

  const time = booking?.time || prefillTime || '10:00'
  const selectedService = services.find(s => s.id === serviceId)
  const selectedTherapist = therapists.find(t => t.id === therapistId)
  const therapistIdx = therapists.findIndex(t => t.id === therapistId)
  const tColor = COLORS[therapistIdx % COLORS.length]

  useEffect(() => {
    api.pricing.get().then(d => {
      setPricing(d.pricing)
      setDurations(d.durations)
      setPriceKeyMap(d.priceKeyMap || {})
    }).catch(() => {})
  }, [])

  // นาทีที่ใช้ได้สำหรับบริการที่เลือก (keyed by service.id)
  const availableDurations = durations[serviceId] || [30, 60, 90, 120]

  // แมทราคาจาก priceKeyMap เช่น thai_oil → ThaiA → 60ThaiA
  const typeKey = priceKeyMap[serviceId] || selectedService?.name.replace(/\s+/g, '') || ''
  const priceKey = typeKey ? `${duration}${typeKey}` : ''
  const price = priceKey ? (pricing[priceKey] ?? null) : null

  // reset duration ถ้าไม่อยู่ใน availableDurations
  useEffect(() => {
    if (availableDurations.length > 0 && !availableDurations.includes(duration)) {
      setDuration(availableDurations[0])
    }
  }, [serviceId, durations])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serviceId) { setError('กรุณาเลือกบริการ'); return }
    setSaving(true); setError('')
    try {
      let saved: Booking
      const payload = {
        therapistId, clientName: '-', serviceId,
        serviceName: selectedService?.name,
        type: selectedService?.type as Booking['type'],
        duration, note: note || undefined,
        price: price ?? undefined,
      }
      if (isEdit) {
        saved = await api.bookings.update(booking!.id, { ...payload, time })
      } else {
        saved = await api.bookings.create({ date, time, ...payload })
      }
      onSave(saved)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
      setSaving(false)
    }
  }

  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="bm-sheet" onClick={e => e.stopPropagation()}>

        <div className="bm-handle" />

        <div className="bm-header">
          <span className="bm-title">{isEdit ? 'แก้ไขนัด' : 'นัดหมายใหม่'}</span>
          <button className="bm-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="bm-form">

          {/* ── บริการ ── */}
          <div className="bm-section-label">บริการ</div>
          <div className="bm-service-grid">
            {services.map(s => (
              <button
                key={s.id} type="button"
                className={`bm-service-btn ${serviceId === s.id ? 'active' : ''}`}
                onClick={() => setServiceId(s.id)}
              >
                <span className="bm-svc-name">{s.name}</span>
              </button>
            ))}
          </div>

          {/* ── นาที ── */}
          <div className="bm-section-label">นาที</div>
          <div className="bm-duration-row">
            {availableDurations.map(d => (
              <button
                key={d} type="button"
                className={`bm-dur-btn ${duration === d ? 'active' : ''}`}
                onClick={() => setDuration(d)}
              >
                {d} นาที
              </button>
            ))}
          </div>

          {/* ── หมายเหตุ ── */}
          <textarea
            className="bm-note"
            placeholder="หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
          />

          {error && <div className="bm-error">{error}</div>}

          {/* ── สรุป ── */}
          {selectedService && selectedTherapist && (
            <div className="bm-summary" style={{ background: BG[tColor], borderColor: ACCENT[tColor] + '55' }}>
              <span className="bm-sum-avatar" style={{ background: ACCENT[tColor] }}>{selectedTherapist.avatar}</span>
              <div className="bm-sum-info">
                <div className="bm-sum-main">{selectedService.name} · {time}</div>
                <div className="bm-sum-sub">
                  {duration} นาที{price !== null ? ` · TZS ${price.toLocaleString()}` : ''}
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="bm-confirm" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'ยืนยันนัดหมาย'}
          </button>
        </form>
      </div>
    </div>
  )
}
