import { Router } from 'express'
import { authenticateAdmin } from './middleware'

import { getContentTypes, getContentTypeById, createContentType, updateContentType, deleteContentType } from './content-types'

import { 
  getContents, 
  getContentById, 
  createContent, 
  updateContent, 
  deleteContent 
} from './contents'

import { 
  getChapters, 
  getChapterById, 
  createChapter, 
  updateChapter, 
  deleteChapter 
} from './chapters'

import { getTags, createTag, updateTag, deleteTag } from './tags'

const router = Router()

router.get('/content-types', getContentTypes)
router.get('/content-types/:id', getContentTypeById)
router.post('/content-types', authenticateAdmin, createContentType)
router.put('/content-types/:id', authenticateAdmin, updateContentType)
router.delete('/content-types/:id', authenticateAdmin, deleteContentType)

router.get('/contents', getContents)
router.get('/contents/:id', getContentById)
router.post('/contents', authenticateAdmin, createContent)
router.put('/contents/:id', authenticateAdmin, updateContent)
router.delete('/contents/:id', authenticateAdmin, deleteContent)

router.get('/contents/:contentId/chapters', getChapters)
router.get('/contents/:contentId/chapters/:chapterId', getChapterById)
router.post('/contents/:contentId/chapters', authenticateAdmin, createChapter)
router.put('/contents/:contentId/chapters/:chapterId', authenticateAdmin, updateChapter)
router.delete('/contents/:contentId/chapters/:chapterId', authenticateAdmin, deleteChapter)

router.get('/tags', getTags)
router.post('/tags', authenticateAdmin, createTag)
router.put('/tags/:id', authenticateAdmin, updateTag)
router.delete('/tags/:id', authenticateAdmin, deleteTag)

export default router

