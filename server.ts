import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import router from './api/routes'
import { initDb } from './db'

dotenv.config()

const app = express()
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
const corsAllowCredentials = (process.env.CORS_ALLOW_CREDENTIALS || '').toLowerCase() === 'true'
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: corsAllowCredentials }))
app.use(express.json({ limit: '10mb' }))

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.use('/api', router)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err)
    process.exit(1)
  })

