const express = require('express')
const router = express.Router()
const { db } = require('../db')

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM services WHERE active = 1 ORDER BY sort_order, name')
    res.json(rows.map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, duration: r.duration, color: r.color, type: r.type, price: r.price })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { name, name_en, duration, color, type, price } = req.body
    if (!name || !name_en) return res.status(400).json({ error: 'name required' })
    const id = name_en.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    await db.execute({
      sql: 'INSERT INTO services (id,name,name_en,duration,color,type,price) VALUES (?,?,?,?,?,?,?)',
      args: [id, name, name_en, duration || 60, color || '#7B9E87', type || 'relaxation', price || 0]
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM services WHERE id = ?', args: [id] })
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
