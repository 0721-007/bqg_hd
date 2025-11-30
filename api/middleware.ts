import { Request, Response, NextFunction } from 'express'

export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const provided = (req.headers['x-admin-password'] as string) || (req.body?.password as string)

  if (!adminPassword) {
    return next()
  }

  if (!provided || provided !== adminPassword) {
    return res.status(401).json({ error: '未授权：管理员密码错误' })
  }

  next()
}

