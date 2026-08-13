import { Router } from 'express';
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserProfile,
} from '../db.js';
import {
  createRequireAuth,
  hashPassword,
  revokeUserTokens,
  signToken,
  signWsTicket,
  verifyPassword,
} from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';

export function createAuthRouter(db) {
  const router = Router();
  const requireAuth = createRequireAuth(db);
  const authLimiter = createRateLimiter({
    name: 'auth',
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    message: '登录/注册尝试过多，请稍后再试',
  });

  router.post('/register', authLimiter, (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const name = String(req.body?.name || '').trim();
      const password = String(req.body?.password || '');

      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: '请输入有效邮箱' });
      }
      if (!name || name.length < 2) {
        return res.status(400).json({ success: false, message: '昵称至少 2 个字符' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: '密码至少 6 位' });
      }
      if (getUserByEmail(db, email)) {
        return res.status(409).json({ success: false, message: '该邮箱已注册' });
      }

      const user = createUser(db, {
        email,
        name,
        passwordHash: hashPassword(password),
      });
      const token = signToken(user);
      return res.status(201).json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
      });
    } catch (err) {
      console.error('注册失败:', err);
      return res.status(500).json({ success: false, message: '注册失败' });
    }
  });

  router.post('/login', authLimiter, (req, res) => {
    try {
      const email = String(req.body?.email || '').trim();
      const password = String(req.body?.password || '');
      const row = getUserByEmail(db, email);

      if (!row || !verifyPassword(password, row.password_hash)) {
        return res.status(401).json({ success: false, message: '邮箱或密码错误' });
      }

      const user = {
        id: row.id,
        email: row.email,
        name: row.name,
        created_at: row.created_at,
        tokenVersion: row.tokenVersion,
      };
      const token = signToken(user);
      return res.json({
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
      });
    } catch (err) {
      console.error('登录失败:', err);
      return res.status(500).json({ success: false, message: '登录失败' });
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = getUserById(db, req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
    });
  });

  router.patch('/me', requireAuth, (req, res) => {
    try {
      const name = String(req.body?.name ?? '').trim();
      const email = String(req.body?.email ?? '').trim().toLowerCase();

      if (!name || name.length < 2) {
        return res.status(400).json({ success: false, message: '昵称至少 2 个字符' });
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: '请输入有效邮箱' });
      }

      const user = updateUserProfile(db, req.user.id, { name, email });
      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }

      const token = signToken(user);
      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
        },
      });
    } catch (err) {
      if (err?.code === 'EMAIL_TAKEN') {
        return res.status(409).json({ success: false, message: err.message || '该邮箱已被占用' });
      }
      console.error('更新资料失败:', err);
      return res.status(500).json({ success: false, message: '更新资料失败' });
    }
  });

  router.post('/logout', requireAuth, (req, res) => {
    try {
      revokeUserTokens(db, req.user.id);
      return res.json({ success: true, message: '已退出，当前令牌已失效' });
    } catch (err) {
      console.error('退出失败:', err);
      return res.status(500).json({ success: false, message: '退出失败' });
    }
  });

  /** 换取短时 WS 票据，避免长期 JWT 出现在 URL / 代理日志中 */
  router.post('/ws-ticket', requireAuth, (req, res) => {
    try {
      const user = getUserById(db, req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }
      const ticket = signWsTicket(user);
      const expiresIn = process.env.WS_TICKET_EXPIRES || '60s';
      return res.json({ success: true, ticket, expiresIn });
    } catch (err) {
      console.error('签发 WS 票据失败:', err);
      return res.status(500).json({ success: false, message: '签发票据失败' });
    }
  });

  return router;
}
