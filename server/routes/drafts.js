import { Router } from 'express';
import { createRequireAuth } from '../auth.js';
import {
  createBoardDraft,
  deleteBoardDraft,
  getBoardDraft,
  listBoardDrafts,
  logActivity,
  publishBoardDraft,
  updateBoardDraft,
} from '../db.js';

export function createDraftsRouter(db) {
  const router = Router();
  const requireAuth = createRequireAuth(db);
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const drafts = await listBoardDrafts(db, req.user.id);
      return res.json({ success: true, drafts });
    } catch (err) {
      console.error('列出草稿失败:', err);
      return res.status(500).json({ success: false, message: '列出草稿失败' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, message: '草稿标题不能为空' });
      }
      const draft = await createBoardDraft(db, {
        userId: req.user.id,
        title,
        description,
      });
      return res.status(201).json({ success: true, draft });
    } catch (err) {
      console.error('创建草稿失败:', err);
      return res.status(500).json({ success: false, message: '创建草稿失败' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const draft = await updateBoardDraft(db, req.params.id, req.user.id, {
        title: req.body?.title,
        description: req.body?.description,
      });
      if (!draft) {
        return res.status(404).json({ success: false, message: '草稿不存在' });
      }
      return res.json({ success: true, draft });
    } catch (err) {
      console.error('更新草稿失败:', err);
      return res.status(500).json({ success: false, message: '更新草稿失败' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const ok = await deleteBoardDraft(db, req.params.id, req.user.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: '草稿不存在' });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('删除草稿失败:', err);
      return res.status(500).json({ success: false, message: '删除草稿失败' });
    }
  });

  router.post('/:id/publish', async (req, res) => {
    try {
      const existing = await getBoardDraft(db, req.params.id, req.user.id);
      if (!existing) {
        return res.status(404).json({ success: false, message: '草稿不存在' });
      }
      const result = await publishBoardDraft(db, req.params.id, req.user.id);
      if (!result) {
        return res.status(404).json({ success: false, message: '草稿不存在' });
      }

      await logActivity(db, {
        boardId: result.board.id,
        userId: req.user.id,
        action: 'board.created',
        summary: `从草稿发布了看板「${result.board.title}」`,
      });

      return res.status(201).json({
        success: true,
        board: { ...result.board, role: 'owner' },
      });
    } catch (err) {
      console.error('发布草稿失败:', err);
      return res.status(500).json({ success: false, message: '发布草稿失败' });
    }
  });

  return router;
}
