/**
 * Siam Royal Thai Massage & Spa — Cloudflare Pages Advanced Mode Worker
 *
 * Handles:
 *   - All /api/* HTTP routes (replaces Express server)
 *   - Scheduled cron trigger for syncing Google Sheet at midnight AEST
 *
 * Deploy:
 *   wrangler d1 create siam-royal-db
 *   wrangler d1 execute siam-royal-db --file=schema.sql
 *   git push  →  Cloudflare Pages auto-deploys
 */

import { Hono } from 'hono'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Env {
  DB: D1Database
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function therapistToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    avatar: r.avatar,
    specialty: r.specialty,
    color: r.color,
  }
}

function bookingToApi(r: Record<string, unknown>) {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    duration: r.duration,
    therapistId: r.therapist_id,
    clientName: r.client_name,
    serviceId: r.service_id,
    serviceName: r.service_name,
    type: r.type,
    status: r.status,
    note: r.note,
    price: r.price,
  }
}

function attendanceToApi(r: Record<string, unknown>) {
  return {
    therapistId: r.therapist_id,
    date: r.date,
    status: r.status,
    sickReason: r.sick_reason,
    sickNote: r.sick_note,
    therapist: {
      id: r.therapist_id,
      name: r.name,
      nameEn: r.name_en,
      avatar: r.avatar,
      specialty: r.specialty,
      color: r.color,
    },
  }
}

async function checkConflict(
  db: D1Database,
  excludeId: string | null,
  therapistId: string,
  date: string,
  time: string,
  duration: number,
) {
  const { results } = await db
    .prepare(
      `SELECT * FROM bookings WHERE therapist_id = ? AND date = ? AND id != ? AND status != 'completed'`,
    )
    .bind(therapistId, date, excludeId || '')
    .all()

  const startMins = toMins(time)
  const endMins = startMins + Number(duration)
  return (results as Record<string, unknown>[]).find((r) => {
    const s = toMins(r.time as string)
    const e = s + (r.duration as number)
    return startMins < e && endMins > s
  })
}

// ── CORS headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ── Hono app ──────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>()

// CORS preflight
app.options('*', (c) => c.newResponse(null, 204, CORS_HEADERS))

// Add CORS headers to every response
app.use('*', async (c, next) => {
  await next()
  Object.entries(CORS_HEADERS).forEach(([k, v]) => c.header(k, v))
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.get('/api/sync', async (c) => {
  try {
    await syncFromSheet(c.env.DB)
    return c.json({ ok: true })
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : 'sync failed' }, 500)
  }
})

// ── Therapists ────────────────────────────────────────────────────────────────

app.get('/api/therapists', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM therapists WHERE active = 1 ORDER BY name')
      .all()
    return c.json((results as Record<string, unknown>[]).map(therapistToApi))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.post('/api/therapists', async (c) => {
  try {
    const body = await c.req.json() as Record<string, string>
    const { name, name_en, specialty, color } = body
    if (!name || !name_en) return c.json({ error: 'name and name_en required' }, 400)
    const id = name_en.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    const avatar = name_en.slice(0, 2).toUpperCase()
    await c.env.DB
      .prepare('INSERT INTO therapists (id,name,name_en,avatar,specialty,color) VALUES (?,?,?,?,?,?)')
      .bind(id, name, name_en, avatar, specialty || 'Thai massage', color || '#7B9E87')
      .run()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM therapists WHERE id = ?')
      .bind(id)
      .all()
    return c.json(therapistToApi(results[0] as Record<string, unknown>), 201)
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.patch('/api/therapists/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json() as Record<string, string>
    const { name, name_en, specialty, color } = body
    await c.env.DB
      .prepare(
        'UPDATE therapists SET name=COALESCE(?,name), name_en=COALESCE(?,name_en), specialty=COALESCE(?,specialty), color=COALESCE(?,color) WHERE id=?',
      )
      .bind(name || null, name_en || null, specialty || null, color || null, id)
      .run()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM therapists WHERE id = ?')
      .bind(id)
      .all()
    if (!results[0]) return c.json({ error: 'not found' }, 404)
    return c.json(therapistToApi(results[0] as Record<string, unknown>))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// Also handle PUT (same as PATCH)
app.put('/api/therapists/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json() as Record<string, string>
    const { name, name_en, specialty, color } = body
    await c.env.DB
      .prepare(
        'UPDATE therapists SET name=COALESCE(?,name), name_en=COALESCE(?,name_en), specialty=COALESCE(?,specialty), color=COALESCE(?,color) WHERE id=?',
      )
      .bind(name || null, name_en || null, specialty || null, color || null, id)
      .run()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM therapists WHERE id = ?')
      .bind(id)
      .all()
    if (!results[0]) return c.json({ error: 'not found' }, 404)
    return c.json(therapistToApi(results[0] as Record<string, unknown>))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.delete('/api/therapists/:id', async (c) => {
  try {
    await c.env.DB
      .prepare('UPDATE therapists SET active = 0 WHERE id = ?')
      .bind(c.req.param('id'))
      .run()
    return c.json({ ok: true })
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Attendance ────────────────────────────────────────────────────────────────

app.get('/api/attendance', async (c) => {
  try {
    const date = c.req.query('date') || today()
    const { results } = await c.env.DB
      .prepare(
        `SELECT a.*, t.name, t.name_en, t.avatar, t.specialty, t.color
         FROM attendance a JOIN therapists t ON a.therapist_id = t.id
         WHERE a.date = ?`,
      )
      .bind(date)
      .all()
    return c.json((results as Record<string, unknown>[]).map(attendanceToApi))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.post('/api/attendance', async (c) => {
  try {
    const body = await c.req.json() as {
      date: string
      records: { therapistId: string; status?: string; sickReason?: string; sickNote?: string }[]
    }
    const { date, records } = body
    if (!date || !Array.isArray(records)) return c.json({ error: 'date and records required' }, 400)

    for (const r of records) {
      await c.env.DB
        .prepare(
          `INSERT INTO attendance (date, therapist_id, status, sick_reason, sick_note)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(date, therapist_id) DO UPDATE SET
             status = excluded.status,
             sick_reason = excluded.sick_reason,
             sick_note = excluded.sick_note`,
        )
        .bind(date, r.therapistId, r.status || 'working', r.sickReason || null, r.sickNote || null)
        .run()
    }

    await c.env.DB
      .prepare('INSERT OR IGNORE INTO shop_open_log (date) VALUES (?)')
      .bind(date)
      .run()

    const { results } = await c.env.DB
      .prepare(
        `SELECT a.*, t.name, t.name_en, t.avatar, t.specialty, t.color
         FROM attendance a JOIN therapists t ON a.therapist_id = t.id
         WHERE a.date = ?`,
      )
      .bind(date)
      .all()
    return c.json((results as Record<string, unknown>[]).map(attendanceToApi))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.patch('/api/attendance/:therapistId', async (c) => {
  try {
    const date = c.req.query('date') || today()
    const therapistId = c.req.param('therapistId')
    const body = await c.req.json() as { status?: string; sickReason?: string; sickNote?: string }
    const { status, sickReason, sickNote } = body
    await c.env.DB
      .prepare(
        `INSERT INTO attendance (date, therapist_id, status, sick_reason, sick_note)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date, therapist_id) DO UPDATE SET
           status = excluded.status,
           sick_reason = excluded.sick_reason,
           sick_note = excluded.sick_note`,
      )
      .bind(date, therapistId, status || 'working', sickReason || null, sickNote || null)
      .run()
    return c.json({ ok: true })
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Bookings ──────────────────────────────────────────────────────────────────

app.get('/api/bookings', async (c) => {
  try {
    const date = c.req.query('date') || today()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM bookings WHERE date = ? ORDER BY time')
      .bind(date)
      .all()
    return c.json((results as Record<string, unknown>[]).map(bookingToApi))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.get('/api/bookings/:id', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(c.req.param('id'))
      .all()
    if (!results[0]) return c.json({ error: 'not found' }, 404)
    return c.json(bookingToApi(results[0] as Record<string, unknown>))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.post('/api/bookings', async (c) => {
  try {
    const body = await c.req.json() as {
      date: string
      time: string
      duration?: number
      therapistId: string
      clientName: string
      serviceId: string
      serviceName?: string
      type?: string
      note?: string
      price?: number
    }
    const { date, time, duration, therapistId, clientName, serviceId, serviceName, type, note, price } = body

    if (!date || !time || !therapistId || !clientName || !serviceId)
      return c.json({ error: 'date, time, therapistId, clientName, serviceId required' }, 400)

    const conflict = await checkConflict(c.env.DB, null, therapistId, date, time, duration || 60)
    if (conflict) return c.json({ error: 'เวลานี้มีการนัดซ้อนกันอยู่แล้ว' }, 409)

    const id = crypto.randomUUID()

    const { results: svcRows } = await c.env.DB
      .prepare('SELECT * FROM services WHERE id = ?')
      .bind(serviceId)
      .all()
    const svc = svcRows[0] as Record<string, unknown> | undefined

    await c.env.DB
      .prepare(
        `INSERT INTO bookings (id,date,time,duration,therapist_id,client_name,service_id,service_name,type,status,note,price)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        date,
        time,
        duration || svc?.duration || 60,
        therapistId,
        clientName,
        serviceId,
        serviceName || svc?.name || serviceId,
        type || svc?.type || 'relaxation',
        'confirmed',
        note || null,
        price || null,
      )
      .run()

    const { results } = await c.env.DB
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(id)
      .all()
    return c.json(bookingToApi(results[0] as Record<string, unknown>), 201)
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.patch('/api/bookings/:id', async (c) => {
  try {
    const bookingId = c.req.param('id')
    const { results: existing } = await c.env.DB
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(bookingId)
      .all()
    if (!existing[0]) return c.json({ error: 'not found' }, 404)
    const row = existing[0] as Record<string, unknown>

    const body = await c.req.json() as {
      status?: string
      time?: string
      duration?: number
      therapistId?: string
      clientName?: string
      note?: string
      price?: number
    }
    const { status, time, duration, therapistId, clientName, note, price } = body

    if (time || therapistId) {
      const conflict = await checkConflict(
        c.env.DB,
        bookingId,
        therapistId || (row.therapist_id as string),
        row.date as string,
        time || (row.time as string),
        duration || (row.duration as number),
      )
      if (conflict) return c.json({ error: 'เวลานี้มีการนัดซ้อนกันอยู่แล้ว' }, 409)
    }

    await c.env.DB
      .prepare(
        `UPDATE bookings SET
           status      = COALESCE(?, status),
           time        = COALESCE(?, time),
           duration    = COALESCE(?, duration),
           therapist_id = COALESCE(?, therapist_id),
           client_name = COALESCE(?, client_name),
           note        = COALESCE(?, note),
           price       = COALESCE(?, price)
         WHERE id = ?`,
      )
      .bind(
        status || null,
        time || null,
        duration || null,
        therapistId || null,
        clientName || null,
        note || null,
        price || null,
        bookingId,
      )
      .run()

    const { results } = await c.env.DB
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(bookingId)
      .all()
    return c.json(bookingToApi(results[0] as Record<string, unknown>))
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.delete('/api/bookings/:id', async (c) => {
  try {
    await c.env.DB
      .prepare('DELETE FROM bookings WHERE id = ?')
      .bind(c.req.param('id'))
      .run()
    return c.json({ ok: true })
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Services ──────────────────────────────────────────────────────────────────

app.get('/api/services', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort_order, name')
      .all()
    return c.json(
      (results as Record<string, unknown>[]).map((r) => ({
        id: r.id,
        name: r.name,
        nameEn: r.name_en,
        duration: r.duration,
        color: r.color,
        type: r.type,
        price: r.price,
      })),
    )
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.post('/api/services', async (c) => {
  try {
    const body = await c.req.json() as {
      name: string
      name_en: string
      duration?: number
      color?: string
      type?: string
      price?: number
    }
    const { name, name_en, duration, color, type, price } = body
    if (!name || !name_en) return c.json({ error: 'name required' }, 400)
    const id = name_en.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    await c.env.DB
      .prepare('INSERT INTO services (id,name,name_en,duration,color,type,price) VALUES (?,?,?,?,?,?,?)')
      .bind(id, name, name_en, duration || 60, color || '#7B9E87', type || 'relaxation', price || 0)
      .run()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM services WHERE id = ?')
      .bind(id)
      .all()
    return c.json(results[0], 201)
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Shop Open ─────────────────────────────────────────────────────────────────

// IMPORTANT: /history must be registered BEFORE /:date-style routes
app.get('/api/shop-open/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '30')
    const { results } = await c.env.DB
      .prepare('SELECT * FROM shop_open_log ORDER BY date DESC LIMIT ?')
      .bind(limit)
      .all()
    return c.json(results)
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.get('/api/shop-open', async (c) => {
  try {
    const date = c.req.query('date') || today()
    const { results } = await c.env.DB
      .prepare('SELECT * FROM shop_open_log WHERE date = ?')
      .bind(date)
      .all()
    return c.json(results[0] || null)
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

app.post('/api/shop-open', async (c) => {
  try {
    const body = await c.req.json() as { date: string; openedById: string; openedByName?: string }
    const { date, openedById, openedByName } = body
    if (!date || !openedById) return c.json({ error: 'date and openedById required' }, 400)

    await c.env.DB
      .prepare(
        `INSERT INTO shop_open_log (date, opened_by, opened_by_id)
         VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           opened_by = excluded.opened_by,
           opened_by_id = excluded.opened_by_id,
           opened_at = datetime('now')`,
      )
      .bind(date, openedByName || '', openedById)
      .run()

    const { results } = await c.env.DB
      .prepare('SELECT * FROM shop_open_log WHERE date = ?')
      .bind(date)
      .all()
    return c.json(results[0])
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Pricing ───────────────────────────────────────────────────────────────────

app.get('/api/pricing', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT service_key, price FROM pricing')
      .all()

    // Reconstruct the shape the frontend expects:
    // { pricing: { "60Thai": 700, ... }, durations: { thai: [60, 90], ... }, priceKeyMap: { thai: "Thai", ... } }
    const pricing: Record<string, number> = {}
    for (const row of results as { service_key: string; price: number }[]) {
      pricing[row.service_key] = row.price
    }

    // Derive durations and priceKeyMap from the pricing keys (e.g. "60Thai" → duration 60, key "Thai")
    const durations: Record<string, number[]> = {}
    const priceKeyMap: Record<string, string> = {}

    for (const key of Object.keys(pricing)) {
      const match = key.match(/^(\d+)(.+)$/)
      if (!match) continue
      const dur = parseInt(match[1])
      const typeKey = match[2]
      const svcId = typeKey.toLowerCase().replace(/\s+/g, '_')
      if (!durations[svcId]) durations[svcId] = []
      if (!durations[svcId].includes(dur)) durations[svcId].push(dur)
      priceKeyMap[svcId] = typeKey
    }

    // Sort durations
    Object.keys(durations).forEach((k) => durations[k].sort((a, b) => a - b))

    return c.json({ pricing, durations, priceKeyMap })
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500)
  }
})

// ── Google Sheet sync ─────────────────────────────────────────────────────────

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5FfMvPWiTlAeDyrM9IkCRKyabSWxjx5YMUv1AJhnNc-F6JujAE6ZuBdJlF1c_lddAKq1ywNF_0TNH/pub?output=csv'

const COLORS = ['#7B9E87', '#8B9BB4', '#B4957A', '#9B8DB4', '#7B9E87', '#B4957A', '#8B9BB4']
const AVATARS = ['NK', 'MP', 'AP', 'DL', 'GN', 'SM', 'ML']

const SERVICE_TYPE: Record<string, string> = {
  Thai: 'relaxation',
  'Thai Oil': 'relaxation',
  Foot: 'relaxation',
  Aroma: 'relaxation',
  Back: 'relaxation',
  HotOil: 'relaxation',
  Deep: 'deep-tissue',
  Sport: 'sports',
  Stone: 'specialty',
  Herbal: 'specialty',
  Scrub: 'specialty',
  Half: 'relaxation',
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  const headers = lines[0]
  return lines.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] || ''
    })
    return obj
  })
}

async function syncFromSheet(db: D1Database) {
  console.log('[Sync] Fetching Google Sheet...')
  try {
    const res = await fetch(CSV_URL)
    const csv = await res.text()
    const rows = parseCSV(csv)

    // ── Therapists ────────────────────────────────────────────────────────
    const names = [...new Set(rows.map((r) => r.People).filter(Boolean))]
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      const id = name.toLowerCase().replace(/\s+/g, '_')
      const avatar = name.slice(0, 2).toUpperCase()
      await db
        .prepare(
          `INSERT INTO therapists (id, name, name_en, avatar, specialty, color, active)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_en=excluded.name_en, avatar=excluded.avatar, active=1`,
        )
        .bind(id, name, name, avatar, 'Thai massage', COLORS[i % COLORS.length])
        .run()
    }
    const activeIds = names.map((n) => n.toLowerCase().replace(/\s+/g, '_'))
    if (activeIds.length > 0) {
      const placeholders = activeIds.map(() => '?').join(',')
      await db
        .prepare(`UPDATE therapists SET active=0 WHERE id NOT IN (${placeholders})`)
        .bind(...activeIds)
        .run()
    }

    // ── Services ──────────────────────────────────────────────────────────
    const serviceNames = [...new Set(rows.map((r) => r.Services).filter(Boolean))]

    const durationsPerService: Record<string, number[]> = {}
    rows
      .filter((r) => r.Services && r.Duration)
      .forEach((r) => {
        if (!durationsPerService[r.Services]) durationsPerService[r.Services] = []
        const d = parseInt(r.Duration)
        if (d && !durationsPerService[r.Services].includes(d)) durationsPerService[r.Services].push(d)
      })
    Object.keys(durationsPerService).forEach((k) => durationsPerService[k].sort((a, b) => a - b))

    for (let i = 0; i < serviceNames.length; i++) {
      const name = serviceNames[i]
      const id = name.toLowerCase().replace(/\s+/g, '_')
      const type = SERVICE_TYPE[name] || 'relaxation'
      await db
        .prepare(
          `INSERT INTO services (id, name, name_en, duration, color, type, price, active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, name_en=excluded.name_en, active=1, sort_order=excluded.sort_order`,
        )
        .bind(id, name, name, durationsPerService[name]?.[0] || 60, COLORS[i % COLORS.length], type, i)
        .run()
    }

    // deactivate services ที่ไม่อยู่ใน Sheet
    const activeServiceIds = serviceNames.map((n) => n.toLowerCase().replace(/\s+/g, '_'))
    if (activeServiceIds.length > 0) {
      const placeholders = activeServiceIds.map(() => '?').join(',')
      await db.prepare(`UPDATE services SET active=0 WHERE id NOT IN (${placeholders})`).bind(...activeServiceIds).run()
    }

    // ── Pricing ───────────────────────────────────────────────────────────
    const pricing: Record<string, number> = {}
    rows.filter((r) => r.Service && r.Price).forEach((r) => {
      pricing[r.Service] = parseInt(r.Price)
    })

    for (const [serviceKey, price] of Object.entries(pricing)) {
      await db
        .prepare(
          `INSERT INTO pricing (service_key, price) VALUES (?, ?)
           ON CONFLICT(service_key) DO UPDATE SET price=excluded.price`,
        )
        .bind(serviceKey, price)
        .run()
    }

    console.log(
      `[Sync] Done — ${names.length} therapists, ${serviceNames.length} services, ${Object.keys(pricing).length} prices`,
    )
  } catch (e: unknown) {
    console.error('[Sync] Failed:', (e as Error).message)
  }
}

// ── Worker export (Advanced Mode) ─────────────────────────────────────────────

export default {
  // HTTP handler — all /api/* requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  },

  // Cron trigger — runs at 0 17 * * * UTC = midnight AEST (UTC+10) / 1am AEDT (UTC+11)
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncFromSheet(env.DB)
  },
}
