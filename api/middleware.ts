import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { fail } from './utils'

export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const provided = (req.headers['x-admin-password'] as string) || (req.body?.password as string)

  if (!adminPassword) {
    return next()
  }

  if (!provided || provided !== adminPassword) {
    return fail(res, 401, '未授权：管理员密码错误')
  }

  next()
}

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'] || ''
  const header = Array.isArray(auth) ? auth[0] : auth
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return fail(res, 401, '未登录')
  }
  const token = header.slice(7).trim()
  try {
    const secret = process.env.JWT_SECRET
    if (!secret || !secret.trim()) {
      return fail(res, 500, '服务器未配置 JWT_SECRET')
    }
    const payload = jwt.verify(token, secret) as any
    ;(req as any).user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
    }
    next()
  } catch (err) {
    console.error('用户认证失败:', err)
    return fail(res, 401, '登录已失效')
  }
}

