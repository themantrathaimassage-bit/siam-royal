import { useState, useEffect, useRef } from 'react'
import { AppState } from './types'
import { api, Therapist, Service } from './api'
import { todayEAT, dateStrEAT } from './dateUtils'
import OpenShopPage from './pages/OpenShopPage'
import WorkingTodayPage from './pages/WorkingTodayPage'
import SickLeavePage from './pages/SickLeavePage'
import SchedulePage from './pages/SchedulePage'
import './styles/common.css'

export interface AppData {
  therapists: Therapist[]
  services: Service[]
}

const initialState: AppState = {
  currentPage: 'open-shop',
  selectedDate: todayEAT(),
  workingTherapists: [],
  sickTherapists: [],
  sickLeaveData: [],
  bookings: [],
  shopOpened: false,
  setupDone: false,
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [data, setData] = useState<AppData>({ therapists: [], services: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(true)
  const [displayPage, setDisplayPage] = useState<AppState['currentPage']>('open-shop')
  const prevPage = useRef<AppState['currentPage']>('open-shop')

  useEffect(() => {
    const dateStr = dateStrEAT(todayEAT())
    Promise.all([api.therapists.list(), api.services.list(), api.shopOpen.get(dateStr), api.attendance.get(dateStr)])
      .then(([therapists, services, shopLog, attendance]) => {
        setData({ therapists, services })
        if (shopLog) {
          const working = attendance.filter(a => a.status === 'working').map(a => a.therapistId)
          const sick = attendance.filter(a => a.status === 'sick').map(a => a.therapistId)
          setState(prev => ({
            ...prev,
            shopOpened: true,
            setupDone: true,
            workingTherapists: working,
            sickTherapists: sick,
            currentPage: 'schedule',
          }))
          setDisplayPage('schedule')
          prevPage.current = 'schedule'
        }
        setLoading(false)
      })
      .catch(() => {
        setError('ไม่สามารถเชื่อมต่อ server ได้ กรุณาตรวจสอบว่า server กำลังรันอยู่ที่ port 4000')
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Sarabun, sans-serif', fontSize: 18, color: '#2D6E6E' }}>
      กำลังโหลด...
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, fontFamily: 'Sarabun, sans-serif', color: '#c0392b', lineHeight: 1.8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>เชื่อมต่อไม่ได้</div>
      <div>{error}</div>
      <div style={{ marginTop: 16, fontSize: 14, color: '#666' }}>วิธีรัน server:</div>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginTop: 8, fontSize: 13 }}>
        cd server{'\n'}node index.js
      </pre>
    </div>
  )

  const setStateWithTransition = (newState: AppState) => {
    if (newState.currentPage !== prevPage.current) {
      setVisible(false)
      setTimeout(() => {
        setState(newState)
        setDisplayPage(newState.currentPage)
        prevPage.current = newState.currentPage
        setVisible(true)
      }, 180)
    } else {
      setState(newState)
    }
  }

  const props = { state: { ...state, currentPage: displayPage }, setState: setStateWithTransition, data }

  const page = (() => {
    switch (displayPage) {
      case 'open-shop':     return <OpenShopPage    {...props} />
      case 'working-today': return <WorkingTodayPage {...props} />
      case 'sick-leave':    return <SickLeavePage   {...props} />
      case 'schedule':      return <SchedulePage    {...props} />
    }
  })()

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.18s ease' }}>
      {page}
    </div>
  )
}
