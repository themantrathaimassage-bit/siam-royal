import { useState } from 'react'
import { AppState } from '../types'
import { AppData } from '../App'
import '../styles/WorkingTodayPage.css'
import '../styles/common.css'

interface Props {
  state: AppState
  setState: (s: AppState) => void
  data: AppData
}

const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']

export default function WorkingTodayPage({ state, setState, data }: Props) {
  const [selected, setSelected] = useState<string[]>(state.workingTherapists)

  const add = (id: string) => {
    if (!selected.includes(id)) setSelected(prev => [...prev, id])
  }

  const remove = (id: string) => {
    setSelected(prev => prev.filter(x => x !== id))
  }

  const available = data.therapists.filter(t => !selected.includes(t.id))
  const selectedTherapists = selected
    .map(id => data.therapists.find(t => t.id === id))
    .filter(Boolean) as typeof data.therapists

  const handleConfirm = () => {
    setState({ ...state, workingTherapists: selected, setupDone: false, currentPage: 'sick-leave' })
  }

  return (
    <div className="page working-today-page">
      <div className="top-bar">
        {!state.shopOpened && (
          <button className="back-btn" onClick={() => setState({ ...state, currentPage: 'open-shop' })}>‹</button>
        )}
        <div className="top-bar-title">ทำงานวันนี้</div>
        <div className="selected-count">{selected.length} คน</div>
      </div>

      {/* รายชื่อที่เพิ่มแล้ว */}
      {selectedTherapists.length > 0 && (
        <div className="working-selected-section">
          <div className="section-label">เรียงตามเทิน</div>
          <div className="working-chips">
            {selectedTherapists.map((t, i) => {
              const colorIdx = data.therapists.findIndex(x => x.id === t.id)
              return (
                <div key={t.id} className={`working-chip color-${COLORS[colorIdx % COLORS.length]}`}>
                  <span className="chip-queue">{i + 1}</span>
                  <span className="chip-name">{t.name}</span>
                  <button className="chip-remove" onClick={() => remove(t.id)}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* รายชื่อที่ยังไม่ได้เพิ่ม */}
      {available.length > 0 && (
        <div className="working-available-section">
          <div className="section-label">เพิ่มพนักงาน</div>
          <div className="available-list">
            {available.map((t, i) => {
              const colorIdx = data.therapists.findIndex(x => x.id === t.id)
              return (
                <div key={t.id} className="available-row">
                  <div className={`avatar-circle ${COLORS[colorIdx % COLORS.length]}`}>{t.avatar}</div>
                  <div className="available-info">
                    <div className="available-name">{t.name}</div>
                  </div>
                  <button className="add-btn" onClick={() => add(t.id)}>+ เพิ่มตามคิว</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {available.length === 0 && (
        <div className="all-added-msg">เพิ่มพนักงานครบทุกคนแล้ว ✓</div>
      )}

      <button
        className="confirm-btn"
        onClick={handleConfirm}
        disabled={selected.length === 0}
      >
        {selected.length === 0 ? 'เลือกพนักงานก่อน' : `ยืนยัน ${selected.length} คน →`}
      </button>
    </div>
  )
}
