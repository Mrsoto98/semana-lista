import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err)
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const start = Date.now()
  const res = await pool.query<T>(text, params)
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[db] ${text.slice(0, 80)} — ${Date.now() - start}ms`)
  }
  return res
}
