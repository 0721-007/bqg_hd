import { Request, Response } from 'express'
import { pool } from '../db'

export const getTags = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name')
    res.json(result.rows)
  } catch (error) {
    console.error('获取标签失败:', error)
    res.status(500).json({ error: '获取标签失败' })
  }
}

export const createTag = async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body
    const result = await pool.query('INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *', [name, color || '#007bff'])
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('创建标签失败:', error)
    res.status(500).json({ error: '创建标签失败' })
  }
}

export const updateTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, color } = req.body
    const result = await pool.query('UPDATE tags SET name = $1, color = $2 WHERE id = $3 RETURNING *', [name, color, id])
    if (result.rows.length === 0) { return res.status(404).json({ error: '标签不存在' }) }
    res.json(result.rows[0])
  } catch (error) {
    console.error('更新标签失败:', error)
    res.status(500).json({ error: '更新标签失败' })
  }
}

export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) { return res.status(404).json({ error: '标签不存在' }) }
    res.json({ message: '标签删除成功' })
  } catch (error) {
    console.error('删除标签失败:', error)
    res.status(500).json({ error: '删除标签失败' })
  }
}

