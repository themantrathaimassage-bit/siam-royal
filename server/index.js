const express = require('express')
const cors = require('cors')
const path = require('path')
const { init } = require('./db')
const { scheduleSync } = require('./syncSheet')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/therapists', require('./routes/therapists'))
app.use('/api/attendance', require('./routes/attendance'))
app.use('/api/bookings',   require('./routes/bookings'))
app.use('/api/services',   require('./routes/services'))
app.use('/api/shop-open',  require('./routes/shopOpen'))

app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }))

app.get('/api/pricing', (_, res) => {
  try {
    const data = require('./pricing.json')
    res.json(data)
  } catch { res.json({ pricing: {}, durations: {} }) }
})

// Serve frontend build
const dist = path.join(__dirname, '../siam-royal/dist')
app.use(express.static(dist))
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(dist, 'index.html'))
  }
})

const PORT = process.env.PORT || 4000

init().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Siam Royal API running on http://localhost:${PORT}`))
  scheduleSync()
}).catch(e => {
  console.error('DB init failed:', e)
  process.exit(1)
})
