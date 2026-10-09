const { createClient } = require('@libsql/client')
const path = require('path')

const db = createClient({ url: 'file:' + path.join(__dirname, 'siam_royal.db') })

async function init() {
  await db.executeMultiple(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS therapists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      avatar TEXT NOT NULL,
      specialty TEXT NOT NULL,
      color TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      duration INTEGER NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      therapist_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'working',
      sick_reason TEXT,
      sick_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(date, therapist_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      therapist_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'relaxation',
      status TEXT NOT NULL DEFAULT 'confirmed',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shop_open_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      opened_at TEXT DEFAULT (datetime('now')),
      opened_by TEXT,
      opened_by_id TEXT
    );
  `)

  // Seed therapists if empty
  const { rows } = await db.execute('SELECT COUNT(*) as c FROM therapists')
  if (rows[0].c === 0) {
    const therapists = [
      ['nk',    'นกนา กิมม่า',   'Nona',  'NK', 'Deep tissue',    '#7B9E87'],
      ['mr',    'มาตา รุจ',      'Mata',  'MR', 'Sports recovery','#8B9BB4'],
      ['ap',    'อาภา ปาเตล',   'Apha',  'AP', 'Relaxation',     '#B4957A'],
      ['dl',    'ดลยา ลี',       'Dolya', 'DL', 'Specialty',      '#9B8DB4'],
      ['gina',  'จีน่า',          'Gina',  'GN', 'Thai massage',   '#7B9E87'],
      ['som',   'สมหมาย ใจดี',   'Som',   'SM', 'Deep tissue',    '#B4957A'],
      ['malee', 'มาลี รักดี',    'Malee', 'ML', 'Relaxation',     '#8B9BB4'],
    ]
    for (const [id, name, name_en, avatar, specialty, color] of therapists) {
      await db.execute({
        sql: 'INSERT INTO therapists (id,name,name_en,avatar,specialty,color) VALUES (?,?,?,?,?,?)',
        args: [id, name, name_en, avatar, specialty, color]
      })
    }
  }

  // Seed services if empty
  const { rows: svcRows } = await db.execute('SELECT COUNT(*) as c FROM services')
  if (svcRows[0].c === 0) {
    const services = [
      ['thai',   'นวดไทย',       'Thai massage',    60, '#7B9E87', 'relaxation',  700],
      ['oil',    'นวดน้ำมัน',    'Oil massage',     60, '#B4957A', 'relaxation',  800],
      ['deep',   'ดีพทิชชู่',    'Deep tissue',     90, '#8B9BB4', 'deep-tissue', 1100],
      ['hot',    'ฮอตสโตน',      'Hot stone',       90, '#9B8DB4', 'specialty',   1200],
      ['sports', 'สปอร์ต',       'Sports recovery', 60, '#7B9E87', 'sports',      900],
      ['foot',   'นวดเท้า',      'Foot massage',    45, '#B4957A', 'relaxation',  500],
      ['herbal', 'ประคบสมุนไพร', 'Herbal compress', 90, '#9B8DB4', 'specialty',   1000],
    ]
    for (const [id, name, name_en, duration, color, type, price] of services) {
      await db.execute({
        sql: 'INSERT INTO services (id,name,name_en,duration,color,type,price) VALUES (?,?,?,?,?,?,?)',
        args: [id, name, name_en, duration, color, type, price]
      })
    }
  }

  console.log('DB ready')
}

module.exports = { db, init }
