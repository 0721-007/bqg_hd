import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { ok, fail } from './utils'

interface JwtPayload {
  userId: number
  username: string
  role: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET 未配置')
  }
  return secret
}

export async function register(req: Request, res: Response) {
  try {
    const { username, password } = req.body as { username?: string; password?: string }
    if (!username || !password || username.trim().length < 3 || password.length < 6) {
      return fail(res, 400, '用户名至少 3 位，密码至少 6 位')
    }

    const client = await pool.connect()
    try {
      const exist = await client.query('SELECT id FROM users WHERE username = $1', [username])
      if (exist.rows.length > 0) {
        return fail(res, 409, '用户名已存在')
      }
      const hash = await bcrypt.hash(password, 10)
      const result = await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
        [username, hash, 'author']
      )
      const user = result.rows[0]
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role } as JwtPayload,
        getJwtSecret(),
        { expiresIn: '7d' }
      )
      return ok(res, { user, token }, '注册成功', 201)
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('注册失败:', err)
    if (err.message && err.message.includes('JWT_SECRET')) {
      return fail(res, 500, '服务器未配置 JWT_SECRET')
    }
    return fail(res, 500, '注册失败')
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body as { username?: string; password?: string }
    if (!username || !password) {
      return fail(res, 400, '用户名和密码必填')
    }

    const result = await pool.query('SELECT id, username, password_hash, role, created_at FROM users WHERE username = $1', [username])
    if (result.rows.length === 0) {
      return fail(res, 401, '用户名或密码错误')
    }
    const user = result.rows[0]
    const okPwd = await bcrypt.compare(password, user.password_hash)
    if (!okPwd) {
      return fail(res, 401, '用户名或密码错误')
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role } as JwtPayload,
      getJwtSecret(),
      { expiresIn: '7d' }
    )

    delete (user as any).password_hash
    return ok(res, { user, token }, '登录成功')
  } catch (err: any) {
    console.error('登录失败:', err)
    if (err.message && err.message.includes('JWT_SECRET')) {
      return fail(res, 500, '服务器未配置 JWT_SECRET')
    }
    return fail(res, 500, '登录失败')
  }
}

export async function me(req: Request, res: Response) {
  try {
    const auth = req.headers['authorization'] || ''
    const token = Array.isArray(auth) ? auth[0] : auth
    if (!token || !token.toLowerCase().startsWith('bearer ')) {
      return fail(res, 401, '未登录')
    }
    const raw = token.slice(7).trim()
    const payload = jwt.verify(raw, getJwtSecret()) as JwtPayload
    return ok(res, { user: { id: payload.userId, username: payload.username, role: payload.role } }, '获取当前用户成功')
  } catch (err: any) {
    console.error('获取当前用户失败:', err)
    return fail(res, 401, '登录已失效')
  }
}
