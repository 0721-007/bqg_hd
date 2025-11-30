import { Request, Response } from 'express'
import { pool } from '../db'

export const getChapters = async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params
    const { page = 1, limit = 50 } = req.query as any
    const offset = (Number(page) - 1) * Number(limit)
    const query = `
      SELECT * FROM chapters 
      WHERE content_id = $1 
      ORDER BY chapter_number ASC
      LIMIT $2 OFFSET $3
    `
    const result = await pool.query(query, [contentId, limit, offset])
    const countResult = await pool.query('SELECT COUNT(*) FROM chapters WHERE content_id = $1', [contentId])
    const total = Number(countResult.rows[0].count)
    res.json({ data: result.rows, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } })
  } catch (error) {
    console.error('获取章节列表失败:', error)
    res.status(500).json({ error: '获取章节列表失败' })
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
    const result = await pool.query(query, [chapterId, contentId])
    if (result.rows.length === 0) { return res.status(404).json({ error: '章节不存在' }) }
    res.json(result.rows[0])
  } catch (error) {
    console.error('获取章节详情失败:', error)
    res.status(500).json({ error: '获取章节详情失败' })
  }
}

export const createChapter = async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params
    const { chapter_number, title, content_data, metadata } = req.body
    const contentResult = await pool.query('SELECT id FROM contents WHERE id = $1', [contentId])
    if (contentResult.rows.length === 0) { return res.status(400).json({ error: '内容不存在' }) }
    const existingResult = await pool.query('SELECT id FROM chapters WHERE content_id = $1 AND chapter_number = $2', [contentId, chapter_number])
    if (existingResult.rows.length > 0) { return res.status(400).json({ error: '章节编号已存在' }) }
    const result = await pool.query(
      `INSERT INTO chapters (content_id, chapter_number, title, content_data, metadata) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [contentId, chapter_number, title, JSON.stringify(content_data || {}), JSON.stringify(metadata || {})]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('创建章节失败:', error)
    res.status(500).json({ error: '创建章节失败' })
  }
}

export const updateChapter = async (req: Request, res: Response) => {
  try {
    const { contentId, chapterId } = req.params
    const { chapter_number, title, content_data, metadata, published_at } = req.body
    if (chapter_number !== undefined) {
      const existingResult = await pool.query('SELECT id FROM chapters WHERE content_id = $1 AND chapter_number = $2 AND id != $3', [contentId, chapter_number, chapterId])
      if (existingResult.rows.length > 0) { return res.status(400).json({ error: '章节编号已存在' }) }
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
    if (result.rows.length === 0) { return res.status(404).json({ error: '章节不存在' }) }
    res.json(result.rows[0])
  } catch (error) {
    console.error('更新章节失败:', error)
    res.status(500).json({ error: '更新章节失败' })
  }
}

export const deleteChapter = async (req: Request, res: Response) => {
  try {
    const { contentId, chapterId } = req.params
    const result = await pool.query('DELETE FROM chapters WHERE id = $1 AND content_id = $2 RETURNING id', [chapterId, contentId])
    if (result.rows.length === 0) { return res.status(404).json({ error: '章节不存在' }) }
    res.json({ message: '章节删除成功' })
  } catch (error) {
    console.error('删除章节失败:', error)
    res.status(500).json({ error: '删除章节失败' })
  }
}

