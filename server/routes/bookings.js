const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { randomUUID } = require('crypto')

router.get('/', async (req, res) => {
  try {
    const date = req.query.date || today()
    const { rows } = await db.execute({ sql: 'SELECT * FROM bookings WHERE date = ? ORDER BY time', args: [date] })
    res.json(rows.map(toApi))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [req.params.id] })
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(toApi(rows[0]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { date, time, duration, therapistId, clientName, serviceId, serviceName, type, note, price } = req.body
    if (!date || !time || !therapistId || !clientName || !serviceId)
      return res.status(400).json({ error: 'date, time, therapistId, clientName, serviceId required' })

    const conflict = await checkConflict(null, therapistId, date, time, duration || 60)
    if (conflict) return res.status(409).json({ error: 'เวลานี้มีการนัดซ้อนกันอยู่แล้ว' })

    const id = randomUUID()
    const { rows: svcRows } = await db.execute({ sql: 'SELECT * FROM services WHERE id = ?', args: [serviceId] })
    const svc = svcRows[0]
    await db.execute({
      sql: `INSERT INTO bookings (id,date,time,duration,therapist_id,client_name,service_id,service_name,type,status,note,price)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, date, time, duration || svc?.duration || 60, therapistId, clientName,
             serviceId, serviceName || svc?.name || serviceId,
             type || svc?.type || 'relaxation', 'confirmed', note || null, price || null]
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [id] })
    res.status(201).json(toApi(rows[0]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/:id', async (req, res) => {
  try {
    const { rows: existing } = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [req.params.id] })
    if (!existing[0]) return res.status(404).json({ error: 'not found' })
    const row = existing[0]

    const { status, time, duration, therapistId, clientName, note, price } = req.body

    if (time || therapistId) {
      const conflict = await checkConflict(req.params.id, therapistId || row.therapist_id, row.date, time || row.time, duration || row.duration)
      if (conflict) return res.status(409).json({ error: 'เวลานี้มีการนัดซ้อนกันอยู่แล้ว' })
    }

    await db.execute({
      sql: `UPDATE bookings SET
              status = COALESCE(?, status),
              time = COALESCE(?, time),
              duration = COALESCE(?, duration),
              therapist_id = COALESCE(?, therapist_id),
              client_name = COALESCE(?, client_name),
              note = COALESCE(?, note),
              price = COALESCE(?, price)
            WHERE id = ?`,
      args: [status || null, time || null, duration || null, therapistId || null, clientName || null, note || null, price || null, req.params.id]
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [req.params.id] })
    res.json(toApi(rows[0]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM bookings WHERE id = ?', args: [req.params.id] })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

async function checkConflict(excludeId, therapistId, date, time, duration) {
  const { rows } = await db.execute({
    sql: `SELECT * FROM bookings WHERE therapist_id = ? AND date = ? AND id != ? AND status != 'completed'`,
    args: [therapistId, date, excludeId || '']
  })
  const startMins = toMins(time)
  const endMins = startMins + Number(duration)
  return rows.find(r => {
    const s = toMins(r.time); const e = s + r.duration
    return startMins < e && endMins > s
  })
}

function toMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function today() { return new Date().toISOString().slice(0, 10) }
function toApi(r) {
  return { id: r.id, date: r.date, time: r.time, duration: r.duration,
           therapistId: r.therapist_id, clientName: r.client_name,
           serviceId: r.service_id, serviceName: r.service_name,
           type: r.type, status: r.status, note: r.note, price: r.price }
}

module.exports = router
