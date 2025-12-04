import { Request, Response } from 'express'
import { pool } from '../db'
import { requireBodyFields, ok, fail } from './utils'

export const getTags = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name')
    return ok(res, result.rows, '获取标签列表成功')
  } catch (error) {
    console.error('获取标签失败:', error)
    return fail(res, 500, '获取标签失败')
  }
}

export const createTag = async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body
    const missing = requireBodyFields(req.body, ['name'])
    if (missing) {
      return res.status(400).json({ error: missing })
    }
    const result = await pool.query('INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *', [name, color || '#007bff'])
    return ok(res, result.rows[0], '创建标签成功', 201)
  } catch (error) {
    console.error('创建标签失败:', error)
    return fail(res, 500, '创建标签失败')
  }
}

export const updateTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, color } = req.body
    const missing = requireBodyFields(req.body, ['name'])
    if (missing) {
      return fail(res, 400, missing)
    }
    const result = await pool.query('UPDATE tags SET name = $1, color = $2 WHERE id = $3 RETURNING *', [name, color, id])
    if (result.rows.length === 0) { return fail(res, 404, '标签不存在') }
    return ok(res, result.rows[0], '更新标签成功')
  } catch (error) {
    console.error('更新标签失败:', error)
    return fail(res, 500, '更新标签失败')
  }
}

export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) { return fail(res, 404, '标签不存在') }
    return ok(res, { id: result.rows[0].id }, '标签删除成功')
  } catch (error) {
    console.error('删除标签失败:', error)
    return fail(res, 500, '删除标签失败')
  }
}

