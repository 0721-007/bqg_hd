import { Request, Response } from 'express'
import multer, { StorageEngine } from 'multer'
import path from 'path'
import fs from 'fs'
import OSS from 'ali-oss'

const target = (process.env.STORAGE_TARGET || 'local').toLowerCase()

let upload: ReturnType<typeof multer>

if (target === 'oss') {
  const memory = multer.memoryStorage()
  upload = multer({ storage: memory, limits: { fileSize: 10 * 1024 * 1024 } })
} else {
  const uploadsDir = path.resolve(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const storage: StorageEngine = multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: any, destination: string) => void) => cb(null, uploadsDir),
    filename: (_req: Request, file: Express.Multer.File, cb: (error: any, filename: string) => void) => {
      const ext = path.extname(file.originalname)
      const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`
      cb(null, name)
    }
  })
  upload = multer({ storage })
}

function buildOssClient() {
  const endpoint = process.env.OSS_ENDPOINT || ''
  const region = process.env.OSS_REGION || ''
  const bucket = process.env.OSS_BUCKET || ''
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID || ''
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || ''
  const options: any = { bucket }
  if (endpoint) options.endpoint = endpoint
  if (region && !endpoint) options.region = region
  options.accessKeyId = accessKeyId
  options.accessKeySecret = accessKeySecret
  return new OSS(options)
}

export const uploadImageHandlers = [upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file
  if (!file) return res.status(400).json({ error: '未接收到文件' })

  if (target === 'oss') {
    const client = buildOssClient()
    const ext = path.extname(file.originalname) || ''
    const key = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`
    try {
      await client.put(key, file.buffer, { headers: { 'Content-Type': file.mimetype } })
    } catch (e) {
      return res.status(500).json({ error: '上传到 OSS 失败' })
    }
    const base = process.env.OSS_PUBLIC_BASE_URL
    const url = base ? `${base.replace(/\/$/, '')}/${key}` : `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${key}`
    return res.status(201).json({ url })
  }

  const url = `/uploads/${file.filename}`
  return res.status(201).json({ url })
}]
