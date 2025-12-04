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

function resolveSSL(cs: string): boolean | { rejectUnauthorized: false } | undefined {
  const mode = (process.env.PGSSLMODE || process.env.DB_SSL || process.env.POSTGRES_SSL || '').toLowerCase()
  if (mode === 'require' || mode === 'true' || mode === 'on') return { rejectUnauthorized: false }
  if (mode === 'disable' || mode === 'false' || mode === 'off') return false
  if (/sslmode=require|ssl=true/i.test(cs)) return { rejectUnauthorized: false }
  return false
}

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: resolveSSL(connectionString || ''),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 5,
})

export async function initDb() {
  if (!connectionString) {
    console.warn('数据库连接未配置，跳过初始化')
    return
  }
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
    } else {
      const typeCount = await client.query('SELECT COUNT(*)::int AS cnt FROM content_types')
      if ((typeCount.rows[0]?.cnt ?? 0) === 0) {
        await client.query(`INSERT INTO content_types (name, display_name, description, metadata_schema) VALUES 
          ('novel', '小说', '文字小说内容', '{
            "author": {"type": "string", "required": true},
            "genre": {"type": "string", "required": false},
            "total_chapters": {"type": "number", "required": false}
          }'),
          ('comic', '漫画', '图像漫画内容', '{
            "author": {"type": "string", "required": true},
            "artist": {"type": "string", "required": true},
            "total_episodes": {"type": "number", "required": false}
          }'),
          ('audio', '音频', '音频内容', '{
            "narrator": {"type": "string", "required": true},
            "duration": {"type": "number", "required": false},
            "file_format": {"type": "string", "required": false}
          }')`)
        console.log('已填充默认内容类型')
      }
      const tagCount = await client.query('SELECT COUNT(*)::int AS cnt FROM tags')
      if ((tagCount.rows[0]?.cnt ?? 0) === 0) {
        await client.query(`INSERT INTO tags (name, color) VALUES 
          ('玄幻', '#9b59b6'),
          ('都市', '#3498db'),
          ('科幻', '#e74c3c'),
          ('言情', '#e91e63'),
          ('历史', '#f39c12'),
          ('悬疑', '#34495e')`)
        console.log('已填充默认标签')
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'author',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      ALTER TABLE contents
      ADD COLUMN IF NOT EXISTS author_user_id INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS author_username VARCHAR(50)
    `)
  } finally {
    client.release()
  }
}

