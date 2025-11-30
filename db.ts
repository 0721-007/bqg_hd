import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

function getConnectionString(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRESQL_URL,
  ]
  for (const u of candidates) {
    if (u && u.trim()) return u.trim()
  }
  const host = process.env.PGHOST || process.env.POSTGRES_HOST
  const port = process.env.PGPORT || process.env.POSTGRES_PORT
  const user = process.env.PGUSER || process.env.POSTGRES_USER
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB
  if (host && port && user && password && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
  }
  return null
}

const connectionString = getConnectionString()

if (!connectionString) {
  throw new Error('数据库连接未配置，请设置 DATABASE_URL 或 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE')
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

export async function initDb() {
  const client = await pool.connect()
  try {
    const check = await client.query("SELECT to_regclass('public.content_types') AS exists")
    const exists = check.rows[0]?.exists
    if (!exists) {
      const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20241130_content_schema.sql')
      const sql = fs.readFileSync(sqlPath, 'utf-8')
      await client.query(sql)
      await client.query("SELECT setval(pg_get_serial_sequence('content_types','id'), COALESCE((SELECT MAX(id) FROM content_types), 1))")
      await client.query("SELECT setval(pg_get_serial_sequence('contents','id'), COALESCE((SELECT MAX(id) FROM contents), 1))")
      await client.query("SELECT setval(pg_get_serial_sequence('chapters','id'), COALESCE((SELECT MAX(id) FROM chapters), 1))")
      await client.query("SELECT setval(pg_get_serial_sequence('tags','id'), COALESCE((SELECT MAX(id) FROM tags), 1))")
      console.log('数据库初始化完成')
    }
  } finally {
    client.release()
  }
}

