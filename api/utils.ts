import { Request, Response } from 'express'

export interface Pagination {
  page: number
  limit: number
}

export function parsePagination(req: Request, defaultLimit = 20, maxLimit = 100): Pagination {
  const rawPage = (req.query.page ?? 1) as any
  const rawLimit = (req.query.limit ?? defaultLimit) as any
  let page = Number(rawPage) || 1
  let limit = Number(rawLimit) || defaultLimit
  if (page < 1) page = 1
  if (limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit
  return { page, limit }
}

export function requireBodyFields(body: any, fields: string[]): string | null {
  const missing: string[] = []
  for (const field of fields) {
    const value = body?.[field]
    if (value === undefined || value === null) {
      missing.push(field)
      continue
    }
    if (typeof value === 'string' && value.trim() === '') {
      missing.push(field)
    }
  }
  if (missing.length > 0) {
    return `缺少必填字段: ${missing.join(', ')}`
  }
  return null
}

export interface ApiSuccess<T = any> {
  code: 0
  msg: string
  data: T
}

export interface ApiError {
  code: number
  msg: string
  data: null
}

export function ok<T>(res: Response, data: T, msg = '请求已成功处理', status = 200) {
  const body: ApiSuccess<T> = { code: 0, msg, data }
  return res.status(status).json(body)
}

export function fail(res: Response, status: number, msg: string, code?: number) {
  const body: ApiError = { code: code ?? status, msg, data: null }
  return res.status(status).json(body)
}
