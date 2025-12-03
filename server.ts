import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import router from './api/routes'
import path from 'path'
import fs from 'fs'
import { uploadImageHandlers } from './api/upload'
import { initDb } from './db'

dotenv.config()

const app = express()
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const corsAllowCredentials = (process.env.CORS_ALLOW_CREDENTIALS || '').toLowerCase() === 'true'
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: corsAllowCredentials }))
app.use(express.json({ limit: '10mb' }))
const storageTarget = (process.env.STORAGE_TARGET || 'local').toLowerCase()
if (storageTarget === 'local') {
  const uploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir))
}

const pkgJsonPath = path.resolve(process.cwd(), 'package.json')
let appVersion = 'unknown'
try {
  const s = fs.readFileSync(pkgJsonPath, 'utf-8')
  const pkg = JSON.parse(s)
  if (pkg && typeof pkg.version === 'string') appVersion = pkg.version
} catch {}

let dbReady = false

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', dbReady })
})

app.get('/', (req: Request, res: Response) => {
  res.send('ok')
})

app.get('/version', (req: Request, res: Response) => {
  res.json({ version: appVersion })
})

app.use('/api', router)
app.post('/api/upload', ...uploadImageHandlers)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

function startListen() {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`)
  })
}

async function initDbWithRetry() {
  try {
    await initDb()
    dbReady = true
  } catch (err) {
    console.error('数据库初始化失败:', err)
    setTimeout(() => initDbWithRetry(), 10000)
  }
}

startListen()
initDbWithRetry()

