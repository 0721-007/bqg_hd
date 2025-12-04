import { Request, Response } from 'express'
import { pool } from '../db'
import { requireBodyFields, ok, fail } from './utils'

export const getContentTypes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM content_types ORDER BY id')
    return ok(res, result.rows, '获取内容类型列表成功')
  } catch (error) {
    console.error('获取内容类型失败:', error)
    return fail(res, 500, '获取内容类型失败')
  }
}

export const getContentTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('SELECT * FROM content_types WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return fail(res, 404, '内容类型不存在')
    }
    return ok(res, result.rows[0], '获取内容类型详情成功')
  } catch (error) {
    console.error('获取内容类型详情失败:', error)
    return fail(res, 500, '获取内容类型详情失败')
  }
}

export const createContentType = async (req: Request, res: Response) => {
  try {
    const { name, display_name, description, metadata_schema } = req.body
    const missing = requireBodyFields(req.body, ['name', 'display_name'])
    if (missing) {
      return fail(res, 400, missing)
    }
    const exist = await pool.query('SELECT id FROM content_types WHERE name = $1', [name])
    if (exist.rows.length > 0) {
      return fail(res, 409, '内容类型已存在')
    }
    const result = await pool.query(
      'INSERT INTO content_types (name, display_name, description, metadata_schema) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, display_name, description || null, metadata_schema ? JSON.stringify(metadata_schema) : null]
    )
    return ok(res, result.rows[0], '创建内容类型成功', 201)
  } catch (error) {
    console.error('创建内容类型失败:', error)
    return fail(res, 500, '创建内容类型失败')
  }
}

export const updateContentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { display_name, description, metadata_schema } = req.body
    const result = await pool.query(
      'UPDATE content_types SET display_name = COALESCE($1, display_name), description = COALESCE($2, description), metadata_schema = COALESCE($3, metadata_schema) WHERE id = $4 RETURNING *',
      [display_name || null, description || null, metadata_schema ? JSON.stringify(metadata_schema) : null, id]
    )
    if (result.rows.length === 0) {
      return fail(res, 404, '内容类型不存在')
    }
    return ok(res, result.rows[0], '更新内容类型成功')
  } catch (error) {
    console.error('更新内容类型失败:', error)
    return fail(res, 500, '更新内容类型失败')
  }
}

export const deleteContentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const used = await pool.query('SELECT 1 FROM contents WHERE content_type_id = $1 LIMIT 1', [id])
    if (used.rows.length > 0) {
      return fail(res, 400, '该内容类型已被内容引用，无法删除')
    }
    const result = await pool.query('DELETE FROM content_types WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return fail(res, 404, '内容类型不存在')
    }
    return ok(res, { id: result.rows[0].id }, '内容类型删除成功')
  } catch (error) {
    console.error('删除内容类型失败:', error)
    return fail(res, 500, '删除内容类型失败')
  }
}

