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

export const getContents = async (req: Request, res: Response) => {
  try {
    const { type, status, tag, mine } = req.query as any
    const onlyMine = mine === '1' || mine === 'true'
    const userForMine = onlyMine ? getOptionalUser(req) : null
    if (onlyMine && !userForMine) {
      return fail(res, 401, '未登录')
    }
    const { page, limit } = parsePagination(req, 20, 100)
    let query = `
      SELECT c.*, ct.name as content_type_name, ct.display_name as content_type_display,
             array_agg(t.name) as tags
      FROM contents c
      JOIN content_types ct ON c.content_type_id = ct.id
      LEFT JOIN content_tags ctg ON c.id = ctg.content_id
      LEFT JOIN tags t ON ctg.tag_id = t.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1
    if (type) { query += ` AND ct.name = $${paramIndex}`; params.push(type); paramIndex++ }
    if (status) { query += ` AND c.status = $${paramIndex}`; params.push(status); paramIndex++ }
    if (tag) { query += ` AND t.name = $${paramIndex}`; params.push(tag); paramIndex++ }
    if (onlyMine && userForMine) { query += ` AND c.author_user_id = $${paramIndex}`; params.push(userForMine.id); paramIndex++ }
    query += ` GROUP BY c.id, ct.id ORDER BY c.created_at DESC`
    const offset = (page - 1) * limit
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)
    const result = await pool.query(query, params)

    let countQuery = `
      SELECT COUNT(DISTINCT c.id)
      FROM contents c
      JOIN content_types ct ON c.content_type_id = ct.id
      LEFT JOIN content_tags ctg ON c.id = ctg.content_id
      LEFT JOIN tags t ON ctg.tag_id = t.id
      WHERE 1=1
    `
    const countParams: any[] = []
    let countParamIndex = 1
    if (type) { countQuery += ` AND ct.name = $${countParamIndex}`; countParams.push(type); countParamIndex++ }
    if (status) { countQuery += ` AND c.status = $${countParamIndex}`; countParams.push(status); countParamIndex++ }
    if (tag) { countQuery += ` AND t.name = $${countParamIndex}`; countParams.push(tag); countParamIndex++ }
    if (onlyMine && userForMine) { countQuery += ` AND c.author_user_id = $${countParamIndex}`; countParams.push(userForMine.id); countParamIndex++ }
    const countResult = await pool.query(countQuery, countParams)
    const total = Number(countResult.rows[0].count)
    return ok(res, { data: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, '获取内容列表成功')
  } catch (error) {
    console.error('获取内容列表失败:', error)
    return fail(res, 500, '获取内容列表失败')
  }
}

export const getContentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const query = `
      SELECT c.*, ct.name as content_type_name, ct.display_name as content_type_display,
             array_agg(t.name) as tags
      FROM contents c
      JOIN content_types ct ON c.content_type_id = ct.id
      LEFT JOIN content_tags ctg ON c.id = ctg.content_id
      LEFT JOIN tags t ON ctg.tag_id = t.id
      WHERE c.id = $1
      GROUP BY c.id, ct.id
    `
    const result = await pool.query(query, [id])
    if (result.rows.length === 0) { return fail(res, 404, '内容不存在') }
    const row = result.rows[0]
    if (row.status !== 'published') {
      const user = getOptionalUser(req)
      const isOwner = user && row.author_user_id && row.author_user_id === user.id
      const isAdmin = isAdminRequest(req)
      if (!isOwner && !isAdmin) {
        return fail(res, 404, '内容不存在')
      }
    }
    return ok(res, row, '获取内容详情成功')
  } catch (error) {
    console.error('获取内容详情失败:', error)
    return fail(res, 500, '获取内容详情失败')
  }
}

export const createContent = async (req: Request, res: Response) => {
  const client = await pool.connect()
  try {
    const { title, description, content_type_id, metadata, tags, cover_image, status } = req.body
    const missing = requireBodyFields(req.body, ['title', 'content_type_id'])
    if (missing) {
      return fail(res, 400, missing)
    }
    const user = (req as any).user as { id: number; username: string; role?: string } | undefined
    if (!user || !user.id) {
      return fail(res, 401, '未登录')
    }
    await client.query('BEGIN')
    const typeResult = await client.query('SELECT id FROM content_types WHERE id = $1', [content_type_id])
    if (typeResult.rows.length === 0) { await client.query('ROLLBACK'); return fail(res, 400, '内容类型不存在') }
    const result = await client.query(
      `INSERT INTO contents (title, description, content_type_id, metadata, cover_image, status, author_user_id, author_username) 
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'draft'), $7, $8) RETURNING *`,
      [title, description, content_type_id, JSON.stringify(metadata || {}), cover_image, status, user.id, user.username]
    )
    const content = result.rows[0]
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName])
        let tagId
        if (tagResult.rows.length === 0) {
          const newTagResult = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName])
          tagId = newTagResult.rows[0].id
        } else { tagId = tagResult.rows[0].id }
        await client.query('INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2)', [content.id, tagId])
      }
    }
    await client.query('COMMIT')
    return ok(res, content, '创建内容成功', 201)
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('创建内容失败:', error)
    return fail(res, 500, error?.message || '创建内容失败')
  } finally {
    client.release()
  }
}

export const updateContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { title, description, metadata, tags, cover_image, status } = req.body
    const user = (req as any).user as { id: number; username: string; role?: string } | undefined
    if (!user || !user.id) {
      return fail(res, 401, '未登录')
    }

    const existing = await pool.query('SELECT id, author_user_id FROM contents WHERE id = $1', [id])
    if (existing.rows.length === 0) { return fail(res, 404, '内容不存在') }
    const row = existing.rows[0]
    if (row.author_user_id && row.author_user_id !== user.id) {
      return fail(res, 403, '无权修改该内容')
    }

    const result = await pool.query(
      `UPDATE contents 
       SET title = $1, description = $2, metadata = $3, cover_image = $4, status = $5,
           author_user_id = COALESCE(author_user_id, $7),
           author_username = COALESCE(author_username, $8),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [title, description, JSON.stringify(metadata || {}), cover_image, status, id, user.id, user.username]
    )
    if (tags !== undefined) {
      await pool.query('DELETE FROM content_tags WHERE content_id = $1', [id])
      if (tags.length > 0) {
        for (const tagName of tags) {
          let tagResult = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName])
          let tagId
          if (tagResult.rows.length === 0) {
            const newTagResult = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName])
            tagId = newTagResult.rows[0].id
          } else { tagId = tagResult.rows[0].id }
          await pool.query('INSERT INTO content_tags (content_id, tag_id) VALUES ($1, $2)', [id, tagId])
        }
      }
    }
    return ok(res, result.rows[0], '更新内容成功')
  } catch (error) {
    console.error('更新内容失败:', error)
    return fail(res, 500, '更新内容失败')
  }
}

export const deleteContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM contents WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) { return fail(res, 404, '内容不存在') }
    return ok(res, { id: result.rows[0].id }, '内容删除成功')
  } catch (error) {
    console.error('删除内容失败:', error)
    return fail(res, 500, '删除内容失败')
  }
}

