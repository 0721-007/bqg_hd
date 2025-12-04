import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db'
import { parsePagination, requireBodyFields, ok, fail } from './utils'

function getOptionalUser(req: Request): { id: number; username: string; role?: string } | null {
  const auth = req.headers['authorization'] || ''
  const header = Array.isArray(auth) ? auth[0] : auth
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = header.slice(7).trim()
  try {
    const secret = process.env.JWT_SECRET
    if (!secret || !secret.trim()) return null
    const payload = jwt.verify(token, secret) as any
    return { id: payload.userId, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

function isAdminRequest(req: Request): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false
  const provided = (req.headers['x-admin-password'] as string) || (req.body as any)?.password
  return !!provided && provided === adminPassword
}

export const getChapters = async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params
    const { page, limit } = parsePagination(req, 50, 200)
    const contentResult = await pool.query('SELECT id, status, author_user_id FROM contents WHERE id = $1', [contentId])
    if (contentResult.rows.length === 0) { return fail(res, 404, '内容不存在') }
    const content = contentResult.rows[0]
    if (content.status !== 'published') {
      const user = getOptionalUser(req)
      const isOwner = user && content.author_user_id && content.author_user_id === user.id
      const isAdmin = isAdminRequest(req)
      if (!isOwner && !isAdmin) {
        return fail(res, 404, '章节不存在')
      }
    }
    const offset = (page - 1) * limit
    const query = `
      SELECT * FROM chapters 
      WHERE content_id = $1 
      ORDER BY chapter_number ASC
      LIMIT $2 OFFSET $3
    `
    const result = await pool.query(query, [contentId, limit, offset])
    const countResult = await pool.query('SELECT COUNT(*) FROM chapters WHERE content_id = $1', [contentId])
    const total = Number(countResult.rows[0].count)
    return ok(res, { data: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, '获取章节列表成功')
  } catch (error) {
    console.error('获取章节列表失败:', error)
    return fail(res, 500, '获取章节列表失败')
  }
}

export const getChapterById = async (req: Request, res: Response) => {
  try {
    const { contentId, chapterId } = req.params
    const query = `
      SELECT ch.*, c.title as content_title, c.content_type_id, ct.name as content_type_name
      FROM chapters ch
      JOIN contents c ON ch.content_id = c.id
      JOIN content_types ct ON c.content_type_id = ct.id
      WHERE ch.id = $1 AND ch.content_id = $2
    `
    const contentResult = await pool.query('SELECT id, status, author_user_id FROM contents WHERE id = $1', [contentId])
    if (contentResult.rows.length === 0) { return res.status(404).json({ error: '内容不存在' }) }
    const content = contentResult.rows[0]
    if (content.status !== 'published') {
      const user = getOptionalUser(req)
      const isOwner = user && content.author_user_id && content.author_user_id === user.id
      const isAdmin = isAdminRequest(req)
      if (!isOwner && !isAdmin) {
        return fail(res, 404, '章节不存在')
      }
    }
    const result = await pool.query(query, [chapterId, contentId])
    if (result.rows.length === 0) { return fail(res, 404, '章节不存在') }
    return ok(res, result.rows[0], '获取章节详情成功')
  } catch (error) {
    console.error('获取章节详情失败:', error)
    return fail(res, 500, '获取章节详情失败')
  }
}

export const createChapter = async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params
    const { chapter_number, title, content_data, metadata } = req.body
    const missing = requireBodyFields(req.body, ['chapter_number', 'title'])
    if (missing) {
      return fail(res, 400, missing)
    }
    const user = (req as any).user as { id: number; username: string; role?: string } | undefined
    if (!user || !user.id) {
      return fail(res, 401, '未登录')
    }
    const contentResult = await pool.query('SELECT id, author_user_id FROM contents WHERE id = $1', [contentId])
    if (contentResult.rows.length === 0) { return fail(res, 400, '内容不存在') }
    const content = contentResult.rows[0]
    if (content.author_user_id && content.author_user_id !== user.id) {
      return fail(res, 403, '无权为该内容创建章节')
    }
    if (!content.author_user_id) {
      await pool.query('UPDATE contents SET author_user_id = $1, author_username = $2 WHERE id = $3', [user.id, user.username, contentId])
    }
    const existingResult = await pool.query('SELECT id FROM chapters WHERE content_id = $1 AND chapter_number = $2', [contentId, chapter_number])
    if (existingResult.rows.length > 0) { return fail(res, 400, '章节编号已存在') }
    const result = await pool.query(
      `INSERT INTO chapters (content_id, chapter_number, title, content_data, metadata) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [contentId, chapter_number, title, JSON.stringify(content_data || {}), JSON.stringify(metadata || {})]
    )
    return ok(res, result.rows[0], '创建章节成功', 201)
  } catch (error) {
    console.error('创建章节失败:', error)
    return fail(res, 500, '创建章节失败')
  }
}

export const updateChapter = async (req: Request, res: Response) => {
  try {
    const { contentId, chapterId } = req.params
    const { chapter_number, title, content_data, metadata, published_at } = req.body
    const user = (req as any).user as { id: number; username: string; role?: string } | undefined
    if (!user || !user.id) {
      return res.status(401).json({ error: '未登录' })
    }
    const contentResult = await pool.query('SELECT id, author_user_id FROM contents WHERE id = $1', [contentId])
    if (contentResult.rows.length === 0) { return res.status(400).json({ error: '内容不存在' }) }
    const content = contentResult.rows[0]
    if (content.author_user_id && content.author_user_id !== user.id) {
      return fail(res, 403, '无权修改该内容的章节')
    }
    if (!content.author_user_id) {
      await pool.query('UPDATE contents SET author_user_id = $1, author_username = $2 WHERE id = $3', [user.id, user.username, contentId])
    }
    if (chapter_number !== undefined) {
      const existingResult = await pool.query('SELECT id FROM chapters WHERE content_id = $1 AND chapter_number = $2 AND id != $3', [contentId, chapter_number, chapterId])
      if (existingResult.rows.length > 0) { return fail(res, 400, '章节编号已存在') }
    }
    const result = await pool.query(
      `UPDATE chapters 
       SET chapter_number = COALESCE($1, chapter_number),
           title = COALESCE($2, title),
           content_data = COALESCE($3, content_data),
           metadata = COALESCE($4, metadata),
           published_at = COALESCE($5, published_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND content_id = $7 RETURNING *`,
      [chapter_number, title, JSON.stringify(content_data || {}), JSON.stringify(metadata || {}), published_at, chapterId, contentId]
    )
    if (result.rows.length === 0) { return fail(res, 404, '章节不存在') }
    return ok(res, result.rows[0], '更新章节成功')
  } catch (error) {
    console.error('更新章节失败:', error)
    return fail(res, 500, '更新章节失败')
  }
}

export const deleteChapter = async (req: Request, res: Response) => {
  try {
    const { contentId, chapterId } = req.params
    const result = await pool.query('DELETE FROM chapters WHERE id = $1 AND content_id = $2 RETURNING id', [chapterId, contentId])
    if (result.rows.length === 0) { return fail(res, 404, '章节不存在') }
    return ok(res, { id: result.rows[0].id }, '章节删除成功')
  } catch (error) {
    console.error('删除章节失败:', error)
    return fail(res, 500, '删除章节失败')
  }
}

