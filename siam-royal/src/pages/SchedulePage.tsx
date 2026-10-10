import { useState, useEffect, useCallback } from 'react'
import { AppState } from '../types'
import { AppData } from '../App'
import { api, Booking, Therapist } from '../api'
import { nowEAT, todayEAT, dateStrEAT } from '../dateUtils'
import BookingModal from '../components/BookingModal'
import '../styles/SchedulePage.css'
import '../styles/common.css'

interface Props {
  state: AppState
  setState: (s: AppState) => void
  data: AppData
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 10)  // 10am–midnight
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
  const dateStr = dateStrEAT(d)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; booking?: Booking; prefillTherapistId?: string; prefillTime?: string }>({ open: false })
  const [slotMenu, setSlotMenu] = useState<{ therapistId: string; time: string; x: number; y: number } | null>(null)
  const [editMenu, setEditMenu] = useState(false)
  const [checkout, setCheckout] = useState<Booking | null>(null)
  const [extraSick, setExtraSick] = useState<string[]>([])
  const [blockMenu, setBlockMenu] = useState<{ booking: Booking; x: number; y: number } | null>(null)
  const [showSummary, setShowSummary] = useState(false)

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


  const handleStatusChange = async (booking: Booking, status: Booking['status']) => {
    if (status === 'completed') { setCheckout(booking); return }
    try {
      const updated = await api.bookings.updateStatus(booking.id, status)
      setBookings(prev => prev.map(b => b.id === booking.id ? updated : b))
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

  const now = nowEAT()
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
          <button className="sch-work-count" onClick={() => setShowSummary(true)} style={{ cursor: 'pointer', border: 'none', background: '#E6F4F2' }}>{realBookings.length} งาน</button>
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
                <button className="danger" onClick={async () => {
                  if (!confirm('รีเซ็ตวันนี้? จะกลับไปหน้าเปิดร้านใหม่')) return
                  try { await api.shopOpen.reset(dateStr) } catch {}
                  setState({
                    currentPage: 'open-shop',
                    selectedDate: todayEAT(),
                    workingTherapists: [],
                    sickTherapists: [],
                    sickLeaveData: [],
                    bookings: [],
                    shopOpened: false,
                    setupDone: false,
                  })
                }}>
                  🔄 รีเซ็ตวันนี้
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
              style={{ background: BG[colorKey], borderColor: ACCENT[colorKey] + '55', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="sch-staff-dot" style={{ background: ACCENT[colorKey] }} />
                <span style={{ fontWeight: 700 }}>{t.nameEn}</span>
              </div>
              <div style={{ fontSize: 10, color: ACCENT[colorKey], paddingLeft: 12 }}>คิว {i + 1}</div>
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

            {allColumns.map((t) => {
              const isSickExtra = extraSick.includes(t.id)
              const tBookings = bookings.filter(b => b.therapistId === t.id && b.serviceId !== 'break' && b.clientName !== 'พัก')
              const colorKey = isSickExtra ? 'gray' : COLORS[activeTherapists.indexOf(t) % COLORS.length]
              return (
                <StaffColumn
                  key={t.id}
                  therapist={t}
                  accent={isSickExtra ? '#E07070' : ACCENT[colorKey]}
                  bg={isSickExtra ? '#FEF0EE' : BG[colorKey]}
                  isSickExtra={isSickExtra}
                  jobCount={tBookings.length}
                  bookings={bookings.filter(b => b.therapistId === t.id)}
                  nowTop={nowTop}
                  onSlotClick={(time, x, y) => setSlotMenu({ therapistId: t.id, time, x, y })}
                  onBlockTap={(b, x, y) => setBlockMenu({ booking: b, x, y })}
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

      {showSummary && (
        <SummaryModal
          bookings={realBookings}
          therapists={allColumns}
          sickTherapistIds={state.sickTherapists}
          selectedDate={state.selectedDate}
          onClose={() => setShowSummary(false)}
        />
      )}

      {blockMenu && (() => {
        const b = blockMenu.booking
        const STATUS_LABEL: Record<string, string> = { confirmed: 'ยืนยัน', 'in-session': 'กำลังนวด', completed: 'เช็คเอ้าท์' }
        const NEXT: Record<string, Booking['status']> = { confirmed: 'in-session', 'in-session': 'completed', completed: 'confirmed' }
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onTouchStart={() => setBlockMenu(null)} onClick={() => setBlockMenu(null)} />
            <div className="sch-menu" style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)', zIndex: 500 }}>
              <button onClick={() => { handleStatusChange(b, NEXT[b.status]); setBlockMenu(null) }}>
                ↗ {STATUS_LABEL[NEXT[b.status]]}
              </button>
              <button onClick={() => { setModal({ open: true, booking: b }); setBlockMenu(null) }}>✏️ แก้ไข</button>
              <button className="danger" onClick={() => { handleDelete(b.id); setBlockMenu(null) }}>🗑 ลบ</button>
              <button onClick={() => setBlockMenu(null)}>✕ ปิด</button>
            </div>
          </>
        )
      })()}
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

function StaffColumn({ therapist, accent, bg, isSickExtra, jobCount, bookings, nowTop, onSlotClick, onBlockTap }: {
  therapist: Therapist; accent: string; bg: string; isSickExtra: boolean; jobCount: number
  bookings: Booking[]; nowTop: number
  onSlotClick: (time: string, x: number, y: number) => void
  onBlockTap: (b: Booking, x: number, y: number) => void
}) {
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)

  const slotToTime = (slot: number) => {
    const maxSlot = HOURS.length * 4 - 1
    const clamped = Math.min(slot, maxSlot)
    const totalMins = clamped * 15 + 10 * 60
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    setHoverSlot(Math.floor(y / Q))
  }

  const handleColClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.sch-booking')) return
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
            {isSickExtra ? '🤒 วันหยุด' : `${jobCount} งาน`}
          </div>
        </div>
      </div>

      <div
        className="sch-col-body"
        style={{ height: HOURS.length * SLOT_H }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverSlot(null)}
        onClick={handleColClick}
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
            key={b.id} booking={b}
            onBlockTap={onBlockTap}
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

function BookingBlock({ booking, onBlockTap }: {
  booking: Booking
  onBlockTap: (b: Booking, x: number, y: number) => void
}) {
  const top = toOffset(booking.time)
  const height = Math.max((booking.duration / 15) * Q - 2, Q - 2)
  const isBreak = booking.serviceId === 'break' || booking.clientName === 'พัก'

  const payment = getPaymentFromNote(booking.note)
  const blockColor = booking.status === 'completed' ? (payment ? PAYMENT_COLOR[payment] : '#888888') : '#6B8FA8'
  const textColor = '#fff'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onBlockTap(booking, e.clientX, e.clientY)
  }

  return (
    <div
      className={`sch-booking status-${booking.status}${isBreak ? ' break-block' : ''}`}
      style={isBreak ? { top, height } : { top, height, background: blockColor, borderLeft: `4px solid ${blockColor}`, color: textColor }}
      onClick={handleClick}
    >
      <div className="sch-bk-name" style={{ color: textColor }}>{booking.serviceName} · {booking.duration}น.</div>
      {height > Q + 4 && booking.price ? (
        <div className="sch-bk-service" style={{ color: textColor + 'CC' }}>{booking.price.toLocaleString()}</div>
      ) : null}
      <div className="sch-bk-status" style={{ color: textColor + 'CC' }}>
        ● {({ confirmed: 'ยืนยัน', 'in-session': 'กำลังนวด', completed: 'เช็คเอ้าท์', arrived: 'มาถึง' } as Record<string, string>)[booking.status] ?? booking.status}
      </div>

    </div>
  )
}

function SummaryModal({ bookings, therapists, sickTherapistIds, selectedDate, onClose }: {
  bookings: Booking[]
  therapists: Therapist[]
  sickTherapistIds: string[]
  selectedDate: Date
  onClose: () => void
}) {
  const totalRevenue = bookings.reduce((s, b) => s + (b.price ?? 0), 0)

  const sorted = [...therapists]
    .map(t => {
      const tbs = bookings.filter(b => b.therapistId === t.id)
      const total = tbs.reduce((s, b) => s + (b.price ?? 0), 0)
      const isSick = sickTherapistIds.includes(t.id)
      const comm = Math.round(total * (isSick ? 0.5 : 0.1))
      return { t, tbs, total, isSick, comm }
    })
    .filter(r => r.tbs.length > 0)
    .sort((a, b) => a.total - b.total)

  const PAYMENT_KEYS = ['Cash', 'CRDB', 'M-Kook', 'Gift Card', 'No pay', 'Other']
  const payMap: Record<string, number> = {}
  for (const b of bookings) {
    const p = getPaymentFromNote(b.note)
    const key = p || 'ยังไม่ชำระ'
    payMap[key] = (payMap[key] ?? 0) + (b.price ?? 0)
  }
  const payEntries = [...PAYMENT_KEYS, 'ยังไม่ชำระ'].map(k => ({ k, v: payMap[k] ?? 0 })).filter(e => e.v > 0)

  // หา max จำนวน booking ในบรรดาหมอทั้งหมด เพื่อสร้าง rows
  const maxRows = Math.max(...sorted.map(r => r.tbs.length), 0)

  const cell: React.CSSProperties = { padding: '4px 4px', fontSize: 11, borderBottom: '1px solid #F0F2F5', borderRight: '1px solid #F0F2F5', verticalAlign: 'top', width: `${100 / sorted.length}%`, maxWidth: 0, wordBreak: 'break-word' }
  const cellR: React.CSSProperties = { ...cell, textAlign: 'right', fontWeight: 600 }
  const headCell: React.CSSProperties = { padding: '6px 4px', fontSize: 10, fontWeight: 800, color: '#1A1A2E', background: '#F7F8FA', borderBottom: '2px solid #ECEEF2', borderRight: '1px solid #ECEEF2', textAlign: 'center', width: `${100 / sorted.length}%`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const sumCell: React.CSSProperties = { padding: '5px 4px', fontSize: 11, fontWeight: 700, background: '#F0F4FF', borderTop: '2px solid #ECEEF2', borderRight: '1px solid #ECEEF2', textAlign: 'right' }
  const commCell: React.CSSProperties = { ...sumCell, fontSize: 10, background: '#F7F8FA' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 600, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxHeight: '88vh', borderRadius: '16px 16px 0 0', overflowY: 'auto', paddingBottom: 24 }}
        onClick={e => e.stopPropagation()}>

        {/* sticky header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #ECEEF2', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>สรุปยอด</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {selectedDate.getDate()}/{selectedDate.getMonth()+1}/{selectedDate.getFullYear()}
          </div>
        </div>

        {/* ── ตารางหลัก col=หมอ row=รายการ ── */}
        <div style={{ margin: '12px 12px 0' }}>
          <table style={{ borderCollapse: 'collapse', border: '1px solid #ECEEF2', width: '100%' }}>
            <thead>
              <tr>
                {sorted.map(({ t, isSick }) => (
                  <th key={t.id} style={headCell}>
                    {t.nameEn}{isSick ? ' 🤒' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, ri) => (
                <tr key={ri}>
                  {sorted.map(({ t, tbs }) => {
                    const b = tbs[ri]
                    return (
                      <td key={t.id} style={cell}>
                        {b ? (
                          <>
                            <div style={{ fontSize: 10, color: '#1A1A2E', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.serviceName} · {b.duration}น.</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#444', marginTop: 1 }}>{b.price != null ? b.price.toLocaleString() : '—'}</div>
                          </>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {/* ยอดรวม */}
              <tr>
                {sorted.map(({ t, total }) => (
                  <td key={t.id} style={sumCell}>{total.toLocaleString()}</td>
                ))}
              </tr>
              {/* ค่าคอม */}
              <tr>
                {sorted.map(({ t, comm, isSick }) => (
                  <td key={t.id} style={{ ...commCell, color: isSick ? '#B00020' : '#2D8C8C' }}>
                    {comm.toLocaleString()}
                    <div style={{ fontSize: 9, color: '#AAA' }}>{isSick ? '50%' : '10%'}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── ช่องทางชำระเงิน ── */}
        {payEntries.length > 0 && (
          <div style={{ margin: '14px 12px 0', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', border: '1px solid #ECEEF2', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...headCell, textAlign: 'left' }}>ช่องทางชำระ</th>
                  <th style={{ ...headCell, textAlign: 'right' }}>ยอด (TZS)</th>
                </tr>
              </thead>
              <tbody>
                {payEntries.map(({ k, v }) => (
                  <tr key={k}>
                    <td style={cell}>{k}</td>
                    <td style={cellR}>{v.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── รายได้รวม ── */}
        <div style={{ margin: '14px 12px 0', background: '#1A1A2E', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>รายได้ร้านวันนี้</span>
          <span style={{ color: '#7FFFDA', fontSize: 15, fontWeight: 800 }}>TZS {totalRevenue.toLocaleString()}</span>
        </div>

        <button onClick={onClose} style={{
          display: 'block', width: 'calc(100% - 24px)', margin: '12px 12px 0',
          padding: '14px', borderRadius: 10, border: 'none',
          background: '#F0F2F5', color: '#1A1A2E', fontSize: 15, fontWeight: 700,
          fontFamily: 'Sarabun, sans-serif', cursor: 'pointer',
        }}>ปิด</button>
      </div>
    </div>
  )
}
