import { Router } from 'express';
import { createRequireAuth } from '../auth.js';
import {
  countUnreadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../collab.js';

export function createNotificationsRouter(db) {
  const router = Router();
  const requireAuth = createRequireAuth(db);
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const unreadOnly = String(req.query.unread || '') === '1';
      const items = await listNotifications(db, req.user.id, {
        unreadOnly,
        limit: req.query.limit,
      });
      const unread = await countUnreadNotifications(db, req.user.id);
      return res.json({ success: true, notifications: items, unread });
    } catch (err) {
      console.error('读取通知失败:', err);
      return res.status(500).json({ success: false, message: '读取通知失败' });
    }
  });

  router.post('/read-all', async (req, res) => {
    try {
      await markAllNotificationsRead(db, req.user.id);
      return res.json({ success: true, unread: 0 });
    } catch (err) {
      console.error('标记已读失败:', err);
      return res.status(500).json({ success: false, message: '标记已读失败' });
    }
  });

  router.post('/:id/read', async (req, res) => {
    try {
      const ok = await markNotificationRead(db, req.user.id, req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: '通知不存在' });
      }
      return res.json({
        success: true,
        unread: await countUnreadNotifications(db, req.user.id),
      });
    } catch (err) {
      console.error('标记已读失败:', err);
      return res.status(500).json({ success: false, message: '标记已读失败' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const ok = await deleteNotification(db, req.user.id, req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: '通知不存在' });
      }
      return res.json({
        success: true,
        unread: await countUnreadNotifications(db, req.user.id),
      });
    } catch (err) {
      console.error('删除通知失败:', err);
      return res.status(500).json({ success: false, message: '删除通知失败' });
    }
  });

  return router;
}
