const express = require('express')
const router = express.Router()
const { db } = require('../db')

// GET log for a date (or today)
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || today()
    const { rows } = await db.execute({
      sql: 'SELECT * FROM shop_open_log WHERE date = ?',
      args: [date]
    })
    res.json(rows[0] || null)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET history — last N days
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30
    const { rows } = await db.execute({
      sql: 'SELECT * FROM shop_open_log ORDER BY date DESC LIMIT ?',
      args: [limit]
    })
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST — บันทึกการเปิดร้าน
// body: { date, openedById, openedByName }
router.post('/', async (req, res) => {
  try {
    const { date, openedById, openedByName } = req.body
    if (!date || !openedById) return res.status(400).json({ error: 'date and openedById required' })

    await db.execute({
      sql: `INSERT INTO shop_open_log (date, opened_by, opened_by_id)
            VALUES (?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
              opened_by = excluded.opened_by,
              opened_by_id = excluded.opened_by_id,
              opened_at = datetime('now')`,
      args: [date, openedByName || '', openedById]
    })

    const { rows } = await db.execute({
      sql: 'SELECT * FROM shop_open_log WHERE date = ?',
      args: [date]
    })
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

function today() { return new Date().toISOString().slice(0, 10) }

module.exports = router
