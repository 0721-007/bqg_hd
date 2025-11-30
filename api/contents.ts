import { Request, Response } from 'express'
import { pool } from '../db'

export const getContents = async (req: Request, res: Response) => {
  try {
    const { type, status, tag, page = 1, limit = 20 } = req.query as any
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
    query += ` GROUP BY c.id, ct.id ORDER BY c.created_at DESC`
    const offset = (Number(page) - 1) * Number(limit)
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
    if (tag) { countQuery += ` AND t.name = $${countParamIndex}`; countParams.push(tag) }
    const countResult = await pool.query(countQuery, countParams)
    const total = Number(countResult.rows[0].count)
    res.json({ data: result.rows, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } })
  } catch (error) {
    console.error('获取内容列表失败:', error)
    res.status(500).json({ error: '获取内容列表失败' })
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
    if (result.rows.length === 0) { return res.status(404).json({ error: '内容不存在' }) }
    res.json(result.rows[0])
  } catch (error) {
    console.error('获取内容详情失败:', error)
    res.status(500).json({ error: '获取内容详情失败' })
  }
}

export const createContent = async (req: Request, res: Response) => {
  const client = await pool.connect()
  try {
    const { title, description, content_type_id, metadata, tags, cover_image, status } = req.body
    await client.query('BEGIN')
    const typeResult = await client.query('SELECT id FROM content_types WHERE id = $1', [content_type_id])
    if (typeResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: '内容类型不存在' }) }
    const result = await client.query(
      `INSERT INTO contents (title, description, content_type_id, metadata, cover_image, status) 
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'draft')) RETURNING *`,
      [title, description, content_type_id, JSON.stringify(metadata || {}), cover_image, status]
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
    res.status(201).json(content)
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('创建内容失败:', error)
    res.status(500).json({ error: error?.message || '创建内容失败' })
  } finally {
    client.release()
  }
}

export const updateContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { title, description, metadata, tags, cover_image, status } = req.body
    const result = await pool.query(
      `UPDATE contents 
       SET title = $1, description = $2, metadata = $3, cover_image = $4, status = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [title, description, JSON.stringify(metadata || {}), cover_image, status, id]
    )
    if (result.rows.length === 0) { return res.status(404).json({ error: '内容不存在' }) }
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
    res.json(result.rows[0])
  } catch (error) {
    console.error('更新内容失败:', error)
    res.status(500).json({ error: '更新内容失败' })
  }
}

export const deleteContent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await pool.query('DELETE FROM contents WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) { return res.status(404).json({ error: '内容不存在' }) }
    res.json({ message: '内容删除成功' })
  } catch (error) {
    console.error('删除内容失败:', error)
    res.status(500).json({ error: '删除内容失败' })
  }
}

