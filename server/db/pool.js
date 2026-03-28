const { Pool } = require('pg');

const poolConfig = {
  database: process.env.DB_NAME || 'brainping',
  user: process.env.DB_USER || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

// Use socket if DB_HOST is empty, TCP otherwise
if (process.env.DB_HOST) {
  poolConfig.host = process.env.DB_HOST;
  poolConfig.port = parseInt(process.env.DB_PORT || '5432');
} else {
  poolConfig.host = '/var/run/postgresql';
}

if (process.env.DB_PASSWORD) {
  poolConfig.password = process.env.DB_PASSWORD;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.log('Slow query:', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

async function getOne(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function getMany(text, params) {
  const res = await query(text, params);
  return res.rows;
}

async function getSetting(key) {
  const row = await getOne('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  await query(
    'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
    [key, value]
  );
}

module.exports = { pool, query, getOne, getMany, getSetting, setSetting };
