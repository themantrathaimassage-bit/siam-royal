const express = require('express')
const router = express.Router()
const { db } = require('../db')

// GET attendance for a date
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || today()
    const { rows } = await db.execute({
      sql: `SELECT a.*, t.name, t.name_en, t.avatar, t.specialty, t.color
            FROM attendance a JOIN therapists t ON a.therapist_id = t.id
            WHERE a.date = ?`,
      args: [date]
    })
    res.json(rows.map(toApi))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST bulk upsert attendance for a day
// body: { date, records: [{ therapistId, status, sickReason, sickNote }] }
router.post('/', async (req, res) => {
  try {
    const { date, records } = req.body
    if (!date || !Array.isArray(records)) return res.status(400).json({ error: 'date and records required' })

    for (const r of records) {
      await db.execute({
        sql: `INSERT INTO attendance (date, therapist_id, status, sick_reason, sick_note)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(date, therapist_id) DO UPDATE SET
                status = excluded.status,
                sick_reason = excluded.sick_reason,
                sick_note = excluded.sick_note`,
        args: [date, r.therapistId, r.status || 'working', r.sickReason || null, r.sickNote || null]
      })
    }

    await db.execute({ sql: 'INSERT OR IGNORE INTO shop_open_log (date) VALUES (?)', args: [date] })

    const { rows } = await db.execute({
      sql: `SELECT a.*, t.name, t.name_en, t.avatar, t.specialty, t.color
            FROM attendance a JOIN therapists t ON a.therapist_id = t.id
            WHERE a.date = ?`,
      args: [date]
    })
    res.json(rows.map(toApi))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH single therapist
router.patch('/:therapistId', async (req, res) => {
  try {
    const date = req.query.date || today()
    const { status, sickReason, sickNote } = req.body
    await db.execute({
      sql: `INSERT INTO attendance (date, therapist_id, status, sick_reason, sick_note)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date, therapist_id) DO UPDATE SET
              status = excluded.status,
              sick_reason = excluded.sick_reason,
              sick_note = excluded.sick_note`,
      args: [date, req.params.therapistId, status || 'working', sickReason || null, sickNote || null]
    })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

function today() { return new Date().toISOString().slice(0, 10) }

function toApi(r) {
  return {
    therapistId: r.therapist_id,
    date: r.date,
    status: r.status,
    sickReason: r.sick_reason,
    sickNote: r.sick_note,
    therapist: { id: r.therapist_id, name: r.name, nameEn: r.name_en, avatar: r.avatar, specialty: r.specialty, color: r.color }
  }
}

module.exports = router
