import { Request, Response } from 'express'
import multer, { StorageEngine } from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticateAdmin } from './middleware'

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

const upload = multer({ storage })

export const uploadImageHandlers = [authenticateAdmin, upload.single('file'), (req: Request, res: Response) => {
  const file = (req as any).file
  if (!file) return res.status(400).json({ error: '未接收到文件' })
  const url = `/uploads/${file.filename}`
  res.status(201).json({ url })
}]
