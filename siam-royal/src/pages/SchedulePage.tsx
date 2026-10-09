import { useState, useEffect, useCallback } from 'react'
import { AppState } from '../types'
import { AppData } from '../App'
import { api, Booking, Therapist } from '../api'
import BookingModal from '../components/BookingModal'
import '../styles/SchedulePage.css'
import '../styles/common.css'

interface Props {
  state: AppState
  setState: (s: AppState) => void
  data: AppData
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 10)  // 10am–10pm
const SLOT_H = 56       // px per hour
const Q = SLOT_H / 4   // px per 15-min quarter = 14px

const DAYS_TH_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const MONTHS_TH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']

const ACCENT: Record<string, string> = {
  teal: '#2D8C8C', blue: '#4A6FA5', orange: '#C07840',
  purple: '#7A6AAA', green: '#4A9B6A', pink: '#B86080', gray: '#7A7A8A'
}
const BG: Record<string, string> = {
  teal: '#E6F4F4', blue: '#EBF0F8', orange: '#FBF2EA',
  purple: '#F2EFF8', green: '#EBF5EE', pink: '#F8EEF3', gray: '#F0F0F2'
}

function toOffset(time: string) {
  const [h, m] = time.split(':').map(Number)
  return ((h - 10) * 60 + m) / 15 * Q
}

export default function SchedulePage({ state, setState, data }: Props) {
  const d = state.selectedDate
  const dateStr = d.toISOString().slice(0, 10)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; booking?: Booking; prefillTherapistId?: string; prefillTime?: string }>({ open: false })
  const [slotMenu, setSlotMenu] = useState<{ therapistId: string; time: string; x: number; y: number } | null>(null)
  const [editMenu, setEditMenu] = useState(false)
  const [checkout, setCheckout] = useState<Booking | null>(null)
  // คนหยุดที่กดเพิ่มเข้าตารางชั่วคราว (มาช่วยงานในวันหยุด)
  const [extraSick, setExtraSick] = useState<string[]>([])

  const workingOrdered = state.workingTherapists
    .map(id => data.therapists.find(t => t.id === id))
    .filter(Boolean) as typeof data.therapists
  const activeTherapists = workingOrdered.filter(t => !state.sickTherapists.includes(t.id))

  // คนหยุดที่ถูกเพิ่มเข้าตาราง
  const sickInGrid = extraSick
    .map(id => data.therapists.find(t => t.id === id))
    .filter(Boolean) as typeof data.therapists

  // คอลัมทั้งหมด = คนทำงาน + คนหยุดที่เพิ่มเข้า
  const allColumns = [...activeTherapists, ...sickInGrid]

  const sickTherapists = state.sickTherapists
    .map(id => data.therapists.find(t => t.id === id))
    .filter(Boolean) as typeof data.therapists
  const sickNotInGrid = sickTherapists.filter(t => !extraSick.includes(t.id))

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try { setBookings(await api.bookings.list(dateStr)) }
    finally { setLoading(false) }
  }, [dateStr])

  useEffect(() => { loadBookings() }, [loadBookings])

  const changeDate = (offset: number) => {
    const nd = new Date(state.selectedDate)
    nd.setDate(nd.getDate() + offset)
    setState({ ...state, selectedDate: nd })
  }

  const handleStatusChange = async (booking: Booking, status: Booking['status']) => {
    if (status === 'completed') { setCheckout(booking); return }
    try {
      const updated = await api.bookings.updateStatus(booking.id, status)
      setBookings(prev => prev.map(b => b.id === booking.id ? updated : b))
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const handleTimeChange = async (id: string, newTime: string) => {
    try {
      const updated = await api.bookings.update(id, { time: newTime })
      setBookings(prev => prev.map(b => b.id === id ? updated : b))
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const handleCheckout = async (booking: Booking, payment: string, promotion: string) => {
    try {
      const updated = await api.bookings.update(booking.id, { status: 'completed', note: [payment, promotion].filter(Boolean).join(' · ') || booking.note })
      setBookings(prev => prev.map(b => b.id === booking.id ? updated : b))
      setCheckout(null)
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ลบการนัดหมายนี้?')) return
    await api.bookings.remove(id)
    setBookings(prev => prev.filter(b => b.id !== id))
  }

  const handleSave = (saved: Booking) => {
    setBookings(prev => {
      const idx = prev.findIndex(b => b.id === saved.id)
      return idx >= 0 ? prev.map(b => b.id === saved.id ? saved : b) : [...prev, saved]
    })
    setModal({ open: false })
  }

  const handleBreak = async (therapistId: string, time: string) => {
    setSlotMenu(null)
    try {
      const saved = await api.bookings.create({
        date: dateStr, time, therapistId,
        clientName: 'พัก', serviceId: 'break',
        serviceName: 'พักเบรก', type: 'relaxation', duration: 30,
      })
      setBookings(prev => [...prev, saved])
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const now = new Date()
  const nowTop = ((now.getHours() - 10) * 60 + now.getMinutes()) / 15 * Q
  const fullDateStr = `วัน${DAYS_TH_FULL[d.getDay()]}ที่ ${d.getDate()} ${MONTHS_TH_FULL[d.getMonth()]} ค.ศ. ${d.getFullYear()}`

  // นับเฉพาะ booking จริง ไม่นับพัก
  const realBookings = bookings.filter(b => b.serviceId !== 'break' && b.clientName !== 'พัก')

  return (
    <div className="page schedule-page">

      {/* ── Top bar ── */}
      <div className="sch-topbar">
        <div className="sch-topbar-left">
          <div className="sch-logo">Siam Royal</div>
          <div className="sch-topdate-full">{fullDateStr}</div>
        </div>
        <div className="sch-topbar-right">
          <div className="sch-work-count">{realBookings.length} งาน</div>
          <div style={{ position: 'relative' }}>
            <button className="sch-edit-btn" onClick={() => setEditMenu(v => !v)}>✏️ แก้ไข</button>
            {editMenu && (
              <div className="sch-edit-menu" onClick={() => setEditMenu(false)}>
                <button onClick={() => setState({ ...state, currentPage: 'working-today' })}>
                  👥 คนทำงาน
                </button>
                <button onClick={() => setState({ ...state, currentPage: 'sick-leave' })}>
                  🤒 คนหยุด
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Staff pills ── */}
      <div className="sch-staff-bar">
        {activeTherapists.map((t, i) => {
          const colorKey = COLORS[i % COLORS.length]
          return (
            <div key={t.id} className="sch-staff-pill"
              style={{ background: BG[colorKey], borderColor: ACCENT[colorKey] + '55' }}>
              <span className="sch-staff-dot" style={{ background: ACCENT[colorKey] }} />
              {t.nameEn}
            </div>
          )
        })}
        {/* คนหยุดที่เพิ่มเข้าตารางแล้ว */}
        {sickInGrid.map(t => (
          <div key={t.id} className="sch-staff-pill sick-in-grid">
            <span className="sch-staff-dot" style={{ background: '#E07070' }} />
            {t.nameEn}
            <button className="sch-pill-remove" onClick={() => setExtraSick(prev => prev.filter(id => id !== t.id))}>✕</button>
          </div>
        ))}
        {/* คนหยุดที่ยังไม่ได้เพิ่ม — กดเพื่อเพิ่มคอลัม */}
        {sickNotInGrid.map(t => (
          <button key={t.id} className="sch-staff-pill sick-btn" onClick={() => setExtraSick(prev => [...prev, t.id])}>
            🤒 {t.name} <span className="sch-pill-plus">+ เพิ่ม</span>
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="sch-loading">กำลังโหลด...</div>
      ) : (
        <div className="sch-grid-wrap">
          <div className="sch-columns">
            {/* time gutter — sticky inside the same scroll container */}
            <div className="sch-time-col">
              <div className="sch-time-spacer" />
              {HOURS.map(h => (
                <div key={h} className="sch-time-cell">
                  <span className="sch-time-label">
                    {h < 12 ? `${h}:00` : h === 12 ? '12:00' : `${h - 12}:00`}
                    <em>{h < 12 ? 'am' : 'pm'}</em>
                  </span>
                </div>
              ))}
            </div>

            {allColumns.map((t, i) => {
              const isSickExtra = extraSick.includes(t.id)
              const queueNum = isSickExtra ? 0 : state.workingTherapists.indexOf(t.id) + 1
              const tBookings = bookings.filter(b => b.therapistId === t.id && b.serviceId !== 'break' && b.clientName !== 'พัก')
              const colorKey = isSickExtra ? 'gray' : COLORS[activeTherapists.indexOf(t) % COLORS.length]
              return (
                <StaffColumn
                  key={t.id}
                  therapist={t}
                  color={colorKey}
                  accent={isSickExtra ? '#E07070' : ACCENT[colorKey]}
                  bg={isSickExtra ? '#FEF0EE' : BG[colorKey]}
                  queueNum={queueNum}
                  isSickExtra={isSickExtra}
                  jobCount={tBookings.length}
                  bookings={bookings.filter(b => b.therapistId === t.id)}
                  nowTop={nowTop}
                  onSlotClick={(time, x, y) => setSlotMenu({ therapistId: t.id, time, x, y })}
                  onEdit={b => setModal({ open: true, booking: b })}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onTimeChange={handleTimeChange}
                />
              )
            })}
          </div>
        </div>
      )}


      {/* ── Slot type picker ── */}
      {slotMenu && (
        <div className="slot-menu-overlay" onClick={() => setSlotMenu(null)}>
          <div className="slot-menu" style={{ top: slotMenu.y, left: slotMenu.x }} onClick={e => e.stopPropagation()}>
            <div className="slot-menu-time">{slotMenu.time}</div>
            <button className="slot-menu-btn booking" onClick={() => {
              const { therapistId, time } = slotMenu
              setSlotMenu(null)
              setModal({ open: true, prefillTherapistId: therapistId, prefillTime: time })
            }}>
              <span>👤</span> บุ๊คลูกค้า
            </button>
            <button className="slot-menu-btn break" onClick={() => handleBreak(slotMenu.therapistId, slotMenu.time)}>
              <span>☕</span> เวลาพัก
            </button>
          </div>
        </div>
      )}

      {modal.open && (
        <BookingModal
          date={dateStr}
          therapists={activeTherapists}
          services={data.services}
          booking={modal.booking}
          prefillTherapistId={modal.prefillTherapistId}
          prefillTime={modal.prefillTime}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}
      {checkout && (
        <CheckoutModal
          booking={checkout}
          onConfirm={handleCheckout}
          onClose={() => setCheckout(null)}
        />
      )}
    </div>
  )
}

const PAYMENTS = ['Cash', 'CRDB', 'M-Kook', 'Gift Card', 'No pay', 'Other']
const PROMOS = ['10 free 1', 'Review', 'Custom']

function CheckoutModal({ booking, onConfirm, onClose }: {
  booking: Booking
  onConfirm: (b: Booking, payment: string, promo: string) => void
  onClose: () => void
}) {
  const [payment, setPayment] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [promo, setPromo] = useState('')

  return (
    <div className="bm-overlay" onClick={onClose}>
      <div className="bm-sheet" onClick={e => e.stopPropagation()}>
        <div className="bm-handle" />
        <div className="bm-header">
          <span className="bm-title">เช็คเอ้าท์</span>
          <button className="bm-close" onClick={onClose}>✕</button>
        </div>
        <div className="bm-form">
          <div className="bm-sum-main" style={{ marginBottom: 12 }}>
            {booking.serviceName} · {booking.duration} นาที
          </div>

          <div className="bm-section-label">ช่องทางชำระเงิน</div>
          <div className="bm-duration-row" style={{ flexWrap: 'wrap' }}>
            {PAYMENTS.map(p => (
              <button key={p} type="button"
                className={`bm-dur-btn ${payment === p ? 'active' : ''}`}
                onClick={() => setPayment(p)}>
                {p}
              </button>
            ))}
          </div>

          {!showPromo && (
            <button type="button" className="bm-dur-btn" style={{ marginTop: 12 }}
              onClick={() => setShowPromo(true)}>
              + เพิ่มโปรโมชั่น
            </button>
          )}

          {showPromo && (
            <>
              <div className="bm-section-label" style={{ marginTop: 12 }}>โปรโมชั่น</div>
              <div className="bm-duration-row" style={{ flexWrap: 'wrap' }}>
                {PROMOS.map(p => (
                  <button key={p} type="button"
                    className={`bm-dur-btn ${promo === p ? 'active' : ''}`}
                    onClick={() => setPromo(prev => prev === p ? '' : p)}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            className="bm-confirm" style={{ marginTop: 16 }}
            disabled={!payment}
            onClick={() => onConfirm(booking, payment, promo)}>
            ยืนยันเช็คเอ้าท์
          </button>
        </div>
      </div>
    </div>
  )
}

function StaffColumn({ therapist, color, accent, bg, queueNum, isSickExtra, jobCount, bookings, nowTop, onSlotClick, onEdit, onStatusChange, onDelete, onTimeChange }: {
  therapist: Therapist; color: string; accent: string; bg: string; queueNum: number; isSickExtra: boolean; jobCount: number
  bookings: Booking[]; nowTop: number
  onSlotClick: (time: string, x: number, y: number) => void
  onEdit: (b: Booking) => void
  onStatusChange: (b: Booking, s: Booking['status']) => void
  onDelete: (id: string) => void
  onTimeChange: (id: string, newTime: string) => void
}) {
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)
  const totalSlots = HOURS.length * 4

  const slotToTime = (slot: number) => {
    const totalMins = slot * 15 + 10 * 60
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    setHoverSlot(Math.floor(y / Q))
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slot = Math.floor(y / Q)
    onSlotClick(slotToTime(slot), e.clientX, e.clientY)
  }

  return (
    <div className="sch-col">
      <div className="sch-col-header" style={{ borderBottom: `3px solid ${accent}` }}>
        <div className="sch-col-avatar" style={{ background: bg, color: accent }}>
          {therapist.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sch-col-name">{therapist.nameEn}</div>
          <div className="sch-col-room">
            {isSickExtra ? '🤒 วันหยุด' : `คิว ${queueNum}`} · {jobCount} งาน
          </div>
        </div>
      </div>

      <div
        className="sch-col-body"
        style={{ height: HOURS.length * SLOT_H }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverSlot(null)}
        onClick={handleClick}
      >
        {/* hour lines */}
        {HOURS.map((_, i) => (
          <div key={i} className="sch-hour-line" style={{ top: i * SLOT_H }} />
        ))}
        {/* quarter lines at :15, :30, :45 of each hour */}
        {HOURS.map((_, hi) => [1, 2, 3].map(q => (
          <div key={`${hi}-${q}`} className={q === 2 ? 'sch-half-line' : 'sch-quarter-line'} style={{ top: hi * SLOT_H + q * Q }} />
        )))}
        {/* hover highlight */}
        {hoverSlot !== null && (
          <div className="sch-hover-slot" style={{ top: hoverSlot * Q, height: Q }} />
        )}
        {/* now line */}
        {nowTop > 0 && nowTop < HOURS.length * SLOT_H && (
          <div className="sch-now-line" style={{ top: nowTop }} />
        )}
        {/* bookings */}
        {bookings.map(b => (
          <BookingBlock
            key={b.id} booking={b} accent={accent} bg={bg}
            onEdit={onEdit} onStatusChange={onStatusChange} onDelete={onDelete} onTimeChange={onTimeChange}
          />
        ))}
      </div>
    </div>
  )
}

const PAYMENT_COLOR: Record<string, string> = {
  'Cash': '#B8A000',
  'CRDB': '#1A6E2E',
  'M-Kook': '#B00020',
  'Gift Card': '#6A3AAA',
  'No pay': '#1A6EA0',
  'Other': '#6A3AAA',
}

function getPaymentFromNote(note: string | null): string {
  if (!note) return ''
  for (const p of Object.keys(PAYMENT_COLOR)) {
    if (note.includes(p)) return p
  }
  return ''
}

function BookingBlock({ booking, accent, bg, onEdit, onStatusChange, onDelete, onTimeChange }: {
  booking: Booking; accent: string; bg: string
  onEdit: (b: Booking) => void
  onStatusChange: (b: Booking, s: Booking['status']) => void
  onDelete: (id: string) => void
  onTimeChange: (id: string, newTime: string) => void
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState<number | null>(null)
  const [dragTop, setDragTop] = useState<number | null>(null)
  const top = toOffset(booking.time)
  const height = Math.max((booking.duration / 15) * Q - 2, Q - 2)
  const isBreak = booking.serviceId === 'break' || booking.clientName === 'พัก'

  const STATUS_LABEL: Record<string, string> = { confirmed: 'ยืนยัน', 'in-session': 'กำลังนวด', completed: 'เช็คเอ้าท์' }
  const NEXT: Record<string, Booking['status']> = { confirmed: 'in-session', 'in-session': 'completed', completed: 'confirmed' }

  const payment = getPaymentFromNote(booking.note)
  const blockColor = booking.status === 'completed' ? (payment ? PAYMENT_COLOR[payment] : '#888888') : '#6B8FA8'
  const blockBg = blockColor
  const textColor = '#fff'

  const handlePointerDown = (e: React.PointerEvent) => {
    if (menuPos) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragOffsetY(e.clientY - (e.currentTarget.parentElement?.getBoundingClientRect().top ?? 0) - top)
    setDragTop(top)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragOffsetY === null) return
    e.stopPropagation()
    const colTop = e.currentTarget.parentElement?.getBoundingClientRect().top ?? 0
    const rawTop = e.clientY - colTop - dragOffsetY
    const snapped = Math.round(rawTop / Q) * Q
    const maxTop = HOURS.length * SLOT_H - height - 2
    setDragTop(Math.max(0, Math.min(snapped, maxTop)))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragOffsetY === null) return
    e.stopPropagation()
    const moved = dragTop !== null && Math.abs(dragTop - top) > Q / 2
    if (moved && dragTop !== null) {
      const totalMins = Math.round(dragTop / Q) * 15 + 10 * 60
      const h = Math.floor(totalMins / 60)
      const m = totalMins % 60
      const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      onTimeChange(booking.id, newTime)
    } else if (!moved) {
      setMenuPos({ x: e.clientX, y: e.clientY })
    }
    setDragOffsetY(null)
    setDragTop(null)
  }

  const displayTop = dragTop !== null ? dragTop : top

  return (
    <div
      className={`sch-booking status-${booking.status}${isBreak ? ' break-block' : ''}${dragOffsetY !== null ? ' dragging' : ''}`}
      style={isBreak ? { top: displayTop, height } : { top: displayTop, height, background: blockBg, borderLeft: `4px solid ${blockColor}`, color: textColor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="sch-bk-name" style={{ color: textColor }}>{booking.serviceName} · {booking.duration}น.</div>
      {height > Q + 4 && booking.price ? (
        <div className="sch-bk-service" style={{ color: textColor + 'CC' }}>{booking.price.toLocaleString()}</div>
      ) : null}
      <div className="sch-bk-status" style={{ color: textColor + 'CC' }}>
        ● {STATUS_LABEL[booking.status] ?? booking.status}
      </div>

      {menuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onPointerDown={e => { e.stopPropagation(); setMenuPos(null) }} />
          <div className="sch-menu" style={{ top: menuPos.y, left: menuPos.x }} onPointerDown={e => e.stopPropagation()}>
            <button onClick={() => { onStatusChange(booking, NEXT[booking.status]); setMenuPos(null) }}>
              ↗ {STATUS_LABEL[NEXT[booking.status]]}
            </button>
            <button onClick={() => { onEdit(booking); setMenuPos(null) }}>✏️ แก้ไข</button>
            <button className="danger" onClick={() => { onDelete(booking.id); setMenuPos(null) }}>🗑 ลบ</button>
            <button onClick={() => setMenuPos(null)}>✕ ปิด</button>
          </div>
        </>
      )}
    </div>
  )
}
