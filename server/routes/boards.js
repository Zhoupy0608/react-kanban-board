import { Router } from 'express';
import { createRequireAuth } from '../auth.js';
import {
  createBoard,
  deleteBoard,
  getBoardFull,
  getBoardMeta,
  listActivity,
  listBoards,
  logActivity,
  saveBoardFull,
  updateBoardMeta,
} from '../db.js';
import {
  addBoardMember,
  canEditBoard,
  canManageBoard,
  createComment,
  countComments,
  deleteComment,
  getBoardAccess,
  listBoardMembers,
  listComments,
  removeBoardMember,
  updateBoardMemberRole,
} from '../collab.js';

async function checkAccess(db, boardId, userId) {
  const access = await getBoardAccess(db, boardId, userId);
  if (access) return { access };
  if (!(await getBoardMeta(db, boardId))) return { error: 404, message: '看板不存在' };
  return { error: 403, message: '无权访问该看板' };
}

export function createBoardsRouter(db, realtime = null) {
  const router = Router();
  const requireAuth = createRequireAuth(db);
  router.use(requireAuth);

  const emitBoard = (boardId, type, payload = {}) => {
    realtime?.broadcastBoard(boardId, {
      type,
      boardId,
      at: new Date().toISOString(),
      ...payload,
    });
  };

  router.get('/', async (req, res) => {
    try {
      const boards = await listBoards(db, req.user.id);
      return res.json({ success: true, boards });
    } catch (err) {
      console.error('列出看板失败:', err);
      return res.status(500).json({ success: false, message: '列出看板失败' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, message: '看板标题不能为空' });
      }

      const board = await createBoard(db, {
        ownerId: req.user.id,
        title,
        description,
      });

      await logActivity(db, {
        boardId: board.id,
        userId: req.user.id,
        action: 'board.created',
        summary: `创建了看板「${board.title}」`,
      });

      return res.status(201).json({ success: true, board: { ...board, role: 'owner' } });
    } catch (err) {
      console.error('创建看板失败:', err);
      return res.status(500).json({ success: false, message: '创建看板失败' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      return res.json({
        success: true,
        board: { ...check.access.meta, role: check.access.role },
      });
    } catch (err) {
      console.error('读取看板失败:', err);
      return res.status(500).json({ success: false, message: '读取看板失败' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canEditBoard(check.access)) {
        return res.status(403).json({ success: false, message: '无权编辑该看板' });
      }

      const board = await updateBoardMeta(db, req.params.id, {
        title: req.body?.title,
        description: req.body?.description,
      });

      await logActivity(db, {
        boardId: board.id,
        userId: req.user.id,
        action: 'board.updated',
        summary: `更新了看板「${board.title}」`,
      });
      emitBoard(board.id, 'board.meta', { board });

      return res.json({ success: true, board: { ...board, role: check.access.role } });
    } catch (err) {
      console.error('更新看板失败:', err);
      return res.status(500).json({ success: false, message: '更新看板失败' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canManageBoard(check.access)) {
        return res.status(403).json({ success: false, message: '仅所有者可删除看板' });
      }

      const title = check.access.meta.title;
      const boardId = req.params.id;
      await deleteBoard(db, boardId);
      emitBoard(boardId, 'board.deleted', { title });
      return res.json({ success: true, message: `已删除看板「${title}」` });
    } catch (err) {
      console.error('删除看板失败:', err);
      return res.status(500).json({ success: false, message: '删除看板失败' });
    }
  });

  router.get('/:id/full', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      const full = await getBoardFull(db, req.params.id);
      return res.json({
        success: true,
        role: check.access.role,
        board: {
          id: full.id,
          title: full.title,
          description: full.description,
          updatedAt: full.updatedAt,
          ownerId: full.ownerId,
          contentVersion: full.contentVersion,
        },
        lanes: full.lanes,
      });
    } catch (err) {
      console.error('读取整板失败:', err);
      return res.status(500).json({ success: false, message: '读取整板失败' });
    }
  });

  router.put('/:id/full', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canEditBoard(check.access)) {
        return res.status(403).json({ success: false, message: '只读成员无法编辑看板' });
      }

      const body = req.body;
      const lanes = Array.isArray(body) ? body : body?.lanes;
      if (!Array.isArray(lanes)) {
        return res
          .status(400)
          .json({ success: false, message: '请求体必须是看板列数组或 { lanes }' });
      }

      const expectedVersion = Array.isArray(body)
        ? null
        : body?.baseVersion != null
          ? Number(body.baseVersion)
          : null;
      const force = !Array.isArray(body) && Boolean(body?.force);

      const full = await saveBoardFull(db, req.params.id, lanes, {
        expectedVersion,
        force,
      });

      await logActivity(db, {
        boardId: req.params.id,
        userId: req.user.id,
        action: 'board.synced',
        summary: `${req.user.name || '用户'} 同步了看板内容`,
      });

      const payload = {
        board: {
          id: full.id,
          title: full.title,
          description: full.description,
          updatedAt: full.updatedAt,
          contentVersion: full.contentVersion,
        },
        lanes: full.lanes,
        by: { id: req.user.id, name: req.user.name },
      };
      emitBoard(req.params.id, 'board.updated', payload);

      return res.json({
        success: true,
        message: '看板已同步',
        role: check.access.role,
        ...payload,
      });
    } catch (err) {
      if (err.code === 'VERSION_CONFLICT') {
        const current = err.current;
        return res.status(409).json({
          success: false,
          code: 'VERSION_CONFLICT',
          message: err.message,
          expectedVersion: err.expectedVersion,
          currentVersion: err.currentVersion,
          board: current
            ? {
                id: current.id,
                title: current.title,
                description: current.description,
                updatedAt: current.updatedAt,
                contentVersion: current.contentVersion,
              }
            : null,
          lanes: current?.lanes || [],
        });
      }
      const status = err.status || 500;
      if (status >= 500) console.error('写入整板失败:', err);
      return res.status(status).json({ success: false, message: err.message || '写入整板失败' });
    }
  });

  router.get('/:id/activity', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      const events = await listActivity(db, req.params.id, req.query.limit);
      return res.json({ success: true, events });
    } catch (err) {
      console.error('读取活动失败:', err);
      return res.status(500).json({ success: false, message: '读取活动失败' });
    }
  });

  router.get('/:id/members', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      return res.json({ success: true, members: await listBoardMembers(db, req.params.id) });
    } catch (err) {
      console.error('读取成员失败:', err);
      return res.status(500).json({ success: false, message: '读取成员失败' });
    }
  });

  router.post('/:id/members', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canManageBoard(check.access)) {
        return res.status(403).json({ success: false, message: '仅所有者可邀请成员' });
      }

      const member = await addBoardMember(db, {
        boardId: req.params.id,
        email: req.body?.email,
        role: req.body?.role,
        invitedBy: req.user.id,
      });

      emitBoard(req.params.id, 'member.changed', {
        members: await listBoardMembers(db, req.params.id),
      });
      realtime?.notifyUser(member.userId, {
        type: 'notification',
        at: new Date().toISOString(),
      });

      return res.status(201).json({ success: true, member });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('邀请成员失败:', err);
      return res.status(status).json({ success: false, message: err.message || '邀请失败' });
    }
  });

  router.patch('/:id/members/:userId', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canManageBoard(check.access)) {
        return res.status(403).json({ success: false, message: '仅所有者可修改角色' });
      }
      const member = await updateBoardMemberRole(db, {
        boardId: req.params.id,
        userId: req.params.userId,
        role: req.body?.role,
      });
      if (!member) {
        return res.status(404).json({ success: false, message: '成员不存在' });
      }
      emitBoard(req.params.id, 'member.changed', {
        members: await listBoardMembers(db, req.params.id),
      });
      return res.json({ success: true, member });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message || '更新失败' });
    }
  });

  router.delete('/:id/members/:userId', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      if (!canManageBoard(check.access)) {
        return res.status(403).json({ success: false, message: '仅所有者可移除成员' });
      }
      await removeBoardMember(db, {
        boardId: req.params.id,
        userId: req.params.userId,
        removedBy: req.user.id,
      });
      emitBoard(req.params.id, 'member.changed', {
        members: await listBoardMembers(db, req.params.id),
      });
      return res.json({ success: true });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message || '移除失败' });
    }
  });

  router.get('/:id/cards/:cardId/comments', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      return res.json({
        success: true,
        comments: await listComments(db, req.params.id, req.params.cardId),
      });
    } catch (err) {
      console.error('读取评论失败:', err);
      return res.status(500).json({ success: false, message: '读取评论失败' });
    }
  });

  router.post('/:id/cards/:cardId/comments', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }

      const comment = await createComment(db, {
        boardId: req.params.id,
        cardId: req.params.cardId,
        userId: req.user.id,
        body: req.body?.body,
      });

      const commentCount = await countComments(db, req.params.id, req.params.cardId);
      emitBoard(req.params.id, 'comment.created', {
        cardId: req.params.cardId,
        comment,
        commentCount,
      });

      return res.status(201).json({ success: true, comment, commentCount });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('发表评论失败:', err);
      return res.status(status).json({ success: false, message: err.message || '发表评论失败' });
    }
  });

  router.delete('/:id/comments/:commentId', async (req, res) => {
    try {
      const check = await checkAccess(db, req.params.id, req.user.id);
      if (check.error) {
        return res.status(check.error).json({ success: false, message: check.message });
      }
      const deleted = await deleteComment(db, {
        commentId: req.params.commentId,
        userId: req.user.id,
        isOwner: canManageBoard(check.access),
      });
      if (!deleted) {
        return res.status(404).json({ success: false, message: '评论不存在' });
      }
      const commentCount = await countComments(db, req.params.id, deleted.cardId);
      emitBoard(req.params.id, 'comment.deleted', {
        commentId: req.params.commentId,
        cardId: deleted.cardId,
        commentCount,
      });
      return res.json({ success: true, cardId: deleted.cardId, commentCount });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message || '删除失败' });
    }
  });

  return router;
}
