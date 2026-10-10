// Tanzania EAT = UTC+3
const TZ = 'Africa/Dar_es_Salaam'

export function nowEAT(): Date {
  // แปลง UTC เป็น EAT โดยใช้ Intl
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parseInt(s.find(p => p.type === t)!.value)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

export function todayEAT(): Date {
  const n = nowEAT()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

export function dateStrEAT(d: Date): string {
  // d คือ local Date object ที่ได้จาก todayEAT() แล้ว — แค่ format เป็น YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
