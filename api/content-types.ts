import { Request, Response } from 'express'
import { pool } from '../db'

export const getContentTypes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM content_types ORDER BY id')
    res.json(result.rows)
  } catch (error) {
    console.error('获取内容类型失败:', error)
    res.status(500).json({ error: '获取内容类型失败' })
  }
}

export const getContentTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('SELECT * FROM content_types WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '内容类型不存在' })
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('获取内容类型详情失败:', error)
    res.status(500).json({ error: '获取内容类型详情失败' })
  }
}

