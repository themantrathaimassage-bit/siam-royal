const fetch = require('node-fetch')
const { db } = require('./db')

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5FfMvPWiTlAeDyrM9IkCRKyabSWxjx5YMUv1AJhnNc-F6JujAE6ZuBdJlF1c_lddAKq1ywNF_0TNH/pub?output=csv'

const COLORS = ['teal', 'blue', 'orange', 'purple', 'green', 'pink', 'gray']
const AVATARS = ['🧖', '💆', '🌿', '🌸', '✨', '🌺', '🍃']

const SERVICE_TYPE = {
  'Thai': 'relaxation', 'Thai Oil': 'relaxation', 'Foot': 'relaxation',
  'Aroma': 'relaxation', 'Back': 'relaxation', 'HotOil': 'relaxation',
  'Deep': 'deep-tissue', 'Sport': 'sports',
  'Stone': 'specialty', 'Herbal': 'specialty', 'Scrub': 'specialty', 'Half': 'relaxation',
}

async function fetchCSV(url) {
  const res = await fetch(url)
  return res.text()
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
  const headers = lines[0]
  return lines.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => obj[h] = row[i] || '')
    return obj
  })
}

async function syncFromSheet() {
  console.log('[Sync] Fetching Google Sheet...')
  try {
    const csv = await fetchCSV(CSV_URL)
    const rows = parseCSV(csv)

    // ── Therapists — ใช้ชื่อจาก Sheet ตรงๆ ──
    const names = [...new Set(rows.map(r => r.People).filter(Boolean))]
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      const id = name.toLowerCase().replace(/\s+/g, '_')
      await db.execute({
        sql: `INSERT INTO therapists (id, name, name_en, avatar, specialty, color, active)
              VALUES (?, ?, ?, ?, ?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_en=excluded.name_en, active=1`,
        args: [id, name, name, AVATARS[i % AVATARS.length], 'Thai massage', COLORS[i % COLORS.length]]
      })
    }
    const activeIds = names.map(n => n.toLowerCase().replace(/\s+/g, '_'))
    if (activeIds.length > 0) {
      await db.execute({
        sql: `UPDATE therapists SET active=0 WHERE id NOT IN (${activeIds.map(() => '?').join(',')})`,
        args: activeIds
      })
    }

    // ── Services — ใช้ชื่อจากคอลัม B (Services) ตรงๆ ──
    const serviceNames = [...new Set(rows.map(r => r.Services).filter(Boolean))]

    // durations จากคอลัม C (Duration) — รวมทุก duration ที่มีใน Sheet
    const durationsPerService = {}
    rows.filter(r => r.Services && r.Duration).forEach(r => {
      if (!durationsPerService[r.Services]) durationsPerService[r.Services] = []
      const d = parseInt(r.Duration)
      if (d && !durationsPerService[r.Services].includes(d)) durationsPerService[r.Services].push(d)
    })
    // sort แต่ละ service
    Object.keys(durationsPerService).forEach(k => durationsPerService[k].sort((a, b) => a - b))

    for (let i = 0; i < serviceNames.length; i++) {
      const name = serviceNames[i]
      const id = name.toLowerCase().replace(/\s+/g, '_')
      const type = SERVICE_TYPE[name] || 'relaxation'
      await db.execute({
        sql: `INSERT INTO services (id, name, name_en, duration, color, type, price, active, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
              ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_en=excluded.name_en, active=1, sort_order=excluded.sort_order`,
        args: [id, name, name, durationsPerService[name]?.[0] || 60, COLORS[i % COLORS.length], type, i]
      })
    }

    // ── Pricing table — {serviceKey: price} เช่น 60Thai: 90000 ──
    const pricing = {}
    rows.filter(r => r.Service && r.Price).forEach(r => {
      pricing[r.Service] = parseInt(r.Price)
    })

    // สร้าง priceKeyMap: service id → typeKey ใน pricing เช่น thai_oil → ThaiOil
    const priceKeyMap = {}
    const durationsFromPricing = {}

    serviceNames.forEach(svcName => {
      const svcId = svcName.toLowerCase().replace(/\s+/g, '_')
      const svcNoSpace = svcName.replace(/\s+/g, '')
      const matchingKey = Object.keys(pricing).find(k => k.replace(/^\d+/, '') === svcNoSpace)
      if (matchingKey) {
        const typeKey = matchingKey.replace(/^\d+/, '')
        priceKeyMap[svcId] = typeKey
        durationsFromPricing[svcId] = Object.keys(pricing)
          .filter(k => k.replace(/^\d+/, '') === typeKey)
          .map(k => parseInt(k.match(/^(\d+)/)[1]))
          .sort((a, b) => a - b)
      }
    })

    const fs = require('fs')
    const path = require('path')
    fs.writeFileSync(
      path.join(__dirname, 'pricing.json'),
      JSON.stringify({ pricing, durations: durationsFromPricing, priceKeyMap }, null, 2)
    )

    console.log(`[Sync] Done — ${names.length} therapists, ${serviceNames.length} services, ${Object.keys(pricing).length} price entries`)
  } catch (e) {
    console.error('[Sync] Failed:', e.message)
  }
}

function scheduleSync() {
  syncFromSheet()
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const msUntilMidnight = midnight - now
  setTimeout(() => {
    syncFromSheet()
    setInterval(syncFromSheet, 24 * 60 * 60 * 1000)
  }, msUntilMidnight)
  console.log(`[Sync] Next sync in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`)
}

module.exports = { syncFromSheet, scheduleSync }
