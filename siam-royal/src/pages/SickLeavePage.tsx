import { useState } from 'react'
import { AppState } from '../types'
import { AppData } from '../App'
import { api } from '../api'
import '../styles/SickLeavePage.css'
import '../styles/common.css'

interface Props {
  state: AppState
  setState: (s: AppState) => void
  data: AppData
}

const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']

export default function SickLeavePage({ state, setState, data }: Props) {
  const [sickList, setSickList] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const available = data.therapists.filter(t => !sickList.includes(t.id) && !state.workingTherapists.includes(t.id))
  const sickTherapists = sickList
    .map(id => data.therapists.find(t => t.id === id))
    .filter(Boolean) as typeof data.therapists

  const add = (id: string) => setSickList(prev => [...prev, id])
  const remove = (id: string) => setSickList(prev => prev.filter(x => x !== id))

  const handleConfirm = async () => {
    setSaving(true)
    setError('')
    try {
      const d = state.selectedDate
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const records = data.therapists.map(t => ({
        therapistId: t.id,
        status: sickList.includes(t.id) ? 'sick' : 'working',
      }))
      await api.attendance.save(dateStr, records)
      setState({
        ...state,
        sickTherapists: sickList,
        sickLeaveData: sickList.map(id => ({ id, reason: '', note: '' })),
        setupDone: true,
        currentPage: 'schedule'
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
      setSaving(false)
    }
  }

  return (
    <div className="page sick-leave-page">
      <div className="top-bar">
        <button className="back-btn" onClick={() => setState({ ...state, currentPage: 'working-today' })}>‹</button>
        <div className="top-bar-title">หยุดงานวันนี้</div>
        <div className="selected-count">{sickList.length > 0 ? `${sickList.length} คน` : '—'}</div>
      </div>

      {/* chip คนที่หยุด */}
      {sickTherapists.length > 0 && (
        <div className="sick-selected-section">
          <div className="section-label">หยุดงานวันนี้</div>
          <div className="working-chips">
            {sickTherapists.map(t => {
              const idx = data.therapists.findIndex(x => x.id === t.id)
              return (
                <div key={t.id} className={`working-chip color-${COLORS[idx % COLORS.length]}`}>
                  <span className="chip-avatar">{t.avatar}</span>
                  <span className="chip-name">{t.name}</span>
                  <button className="chip-remove" onClick={() => remove(t.id)}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* รายชื่อที่ยังไม่ได้หยุด */}
      {available.length > 0 && (
        <div className="sick-available-section">
          <div className="section-label">วันหยุด/ลา/ป่วย</div>
          <div className="sick-available-list">
            {available.map(t => {
              const idx = data.therapists.findIndex(x => x.id === t.id)
              return (
                <div key={t.id} className="available-row">
                  <div className={`avatar-circle ${COLORS[idx % COLORS.length]}`}>{t.avatar}</div>
                  <div className="available-info">
                    <div className="available-name">{t.name}</div>
                    <div className="available-sub">{t.nameEn} · {t.specialty}</div>
                  </div>
                  <button className="add-btn" onClick={() => add(t.id)}>+ เพิ่ม</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {available.length === 0 && (
        <div className="all-added-msg">บันทึกครบทุกคนแล้ว ✓</div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <button className="confirm-btn" onClick={handleConfirm} disabled={saving}>
        {saving ? 'กำลังบันทึก...' : sickList.length === 0 ? 'ไม่มีคนหยุด → เปิดตาราง' : `ยืนยัน · หยุด ${sickList.length} คน →`}
      </button>
    </div>
  )
}
