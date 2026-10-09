import { useState, useRef } from 'react'
import { AppState } from '../types'
import { AppData } from '../App'
import { api } from '../api'
import { Therapist } from '../api'
import '../styles/OpenShopPage.css'
import '../styles/common.css'

interface Props {
  state: AppState
  setState: (s: AppState) => void
  data: AppData
}

const DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']

export default function OpenShopPage({ state, setState, data }: Props) {
  const d = state.selectedDate
  const dayName = DAYS_TH[d.getDay()]
  const dateKey = d.toISOString().slice(0, 10)

  const [selectedId, setSelectedId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const dateInputRef = useRef<HTMLInputElement>(null)

  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const dateLine1 = `วัน${dayName}ที่ ${d.getDate()} ${MONTHS_TH[d.getMonth()]}`
  const dateLine2 = `ค.ศ. ${d.getFullYear()}`

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return
    const [y, m, day] = e.target.value.split('-').map(Number)
    setState({ ...state, selectedDate: new Date(y, m - 1, day) })
  }

  const filtered = query.trim()
    ? data.therapists.filter(t =>
        t.name.includes(query) || t.nameEn.toLowerCase().includes(query.toLowerCase())
      )
    : data.therapists

  const selectedTherapist = data.therapists.find(t => t.id === selectedId)

  const handleConfirm = async () => {
    if (!selectedId) { setError('กรุณาเลือกพนักงานที่เปิดร้านก่อน'); return }
    setSaving(true)
    setError('')
    try {
      const t = data.therapists.find(th => th.id === selectedId)!
      await api.shopOpen.save(dateKey, t.id, t.name)
      setState({ ...state, shopOpened: true, currentPage: 'working-today' })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
      setSaving(false)
    }
  }

  return (
    <div className="page open-shop-page">
      <div className="page-header">
        <div className="shop-title">Siam Royal Thai massage and Spa</div>
        <label className={`date-pill ${isToday ? 'is-today' : 'not-today'}`}>
          <div className="date-pill-main">
            <span className="date-pill-day">{dateLine1}</span>
            <span className="date-pill-year">{dateLine2}</span>
          </div>
          <span className="date-pill-icon">📅</span>
          {!isToday && <span className="date-pill-warn">⚠️ ไม่ใช่วันนี้</span>}
          <input
            ref={dateInputRef}
            type="date"
            value={dateKey}
            onChange={handleDateChange}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
          />
        </label>
        <div className="page-question">ใครเปิดระบบร้าน?</div>
      </div>

      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="ค้นหาพนักงาน"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      {selectedTherapist && (
        <div className="selected-opener-banner">
          <div className={`avatar-circle ${COLORS[data.therapists.indexOf(selectedTherapist) % COLORS.length]}`}>
            {selectedTherapist.avatar}
          </div>
          <div className="selected-opener-info">
            <div className="selected-opener-label">คนเปิดร้านวันนี้</div>
            <div className="selected-opener-name">{selectedTherapist.name}</div>
          </div>
          <button className="selected-opener-clear" onClick={() => setSelectedId('')}>เปลี่ยน</button>
        </div>
      )}

      <div className="therapist-select-list">
        {filtered.map((t, i) => (
          <TherapistSelectCard
            key={t.id}
            therapist={t}
            colorClass={COLORS[data.therapists.indexOf(t) % COLORS.length]}
            selected={t.id === selectedId}
            onSelect={() => setSelectedId(t.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="no-results">ไม่พบพนักงาน "{query}"</div>
        )}
      </div>

      {error && <div className="open-error-msg">{error}</div>}

      <button
        className="confirm-btn"
        onClick={handleConfirm}
        disabled={saving || !selectedId}
      >
        {saving ? 'กำลังบันทึก...' : selectedId ? `${selectedTherapist?.name} เปิดร้าน →` : 'เลือกคนเปิดร้านก่อน'}
      </button>

    </div>
  )
}

function TherapistSelectCard({ therapist, colorClass, selected, onSelect }: {
  therapist: Therapist; colorClass: string; selected: boolean; onSelect: () => void
}) {
  return (
    <div
      className={`opener-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className={`avatar-circle ${colorClass}`}>{therapist.avatar}</div>
      <div className="opener-info">
        <div className="opener-name">{therapist.name}</div>
      </div>
      <div className={`opener-radio ${selected ? 'checked' : ''}`}>
        {selected && <div className="opener-radio-dot" />}
      </div>
    </div>
  )
}
