const express = require('express')
const router = express.Router()
const { db } = require('../db')

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM therapists WHERE active = 1 ORDER BY name')
    res.json(rows.map(toApi))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', async (req, res) => {
  try {
    const { name, name_en, specialty, color } = req.body
    if (!name || !name_en) return res.status(400).json({ error: 'name and name_en required' })
    const id = name_en.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    const avatar = name_en.slice(0, 2).toUpperCase()
    await db.execute({
      sql: 'INSERT INTO therapists (id,name,name_en,avatar,specialty,color) VALUES (?,?,?,?,?,?)',
      args: [id, name, name_en, avatar, specialty || 'Thai massage', color || '#7B9E87']
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM therapists WHERE id = ?', args: [id] })
    res.status(201).json(toApi(rows[0]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, name_en, specialty, color } = req.body
    await db.execute({
      sql: 'UPDATE therapists SET name=COALESCE(?,name), name_en=COALESCE(?,name_en), specialty=COALESCE(?,specialty), color=COALESCE(?,color) WHERE id=?',
      args: [name || null, name_en || null, specialty || null, color || null, req.params.id]
    })
    const { rows } = await db.execute({ sql: 'SELECT * FROM therapists WHERE id = ?', args: [req.params.id] })
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(toApi(rows[0]))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE therapists SET active = 0 WHERE id = ?', args: [req.params.id] })
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

function toApi(r) {
  return { id: r.id, name: r.name, nameEn: r.name_en, avatar: r.avatar, specialty: r.specialty, color: r.color }
}

module.exports = router
