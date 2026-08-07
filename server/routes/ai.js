import { Router } from 'express';
import { createRequireAuth } from '../auth.js';
import { getBoardMeta } from '../db.js';
import { canEditBoard, getBoardAccess } from '../collab.js';
import { createRateLimiter } from '../rateLimit.js';
import {
  isAiConfigured,
  polishCardDescription,
  generateCardDescription,
  splitCardIntoTasks,
  splitCardIntoChecklist,
  suggestCardPriority,
  injectLaneTasks,
} from '../ai.js';

function checkEditAccess(db, boardId, userId) {
  const access = getBoardAccess(db, boardId, userId);
  if (access && canEditBoard(access)) return { access };
  if (!getBoardMeta(db, boardId)) return { error: 404, message: '看板不存在' };
  if (access) return { error: 403, message: '只读成员无法使用板内 AI' };
  return { error: 403, message: '无权访问该看板' };
}

export function createAiRouter(db) {
  const router = Router();
  const requireAuth = createRequireAuth(db);
  router.use(requireAuth);

  const aiLimiter = createRateLimiter({
    name: 'ai',
    max: Number(process.env.AI_RATE_LIMIT_MAX) || 30,
    windowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    message: 'AI 请求过于频繁，请稍后再试',
  });

  router.get('/status', (_req, res) => {
    res.json({
      success: true,
      enabled: isAiConfigured(),
      model: isAiConfigured() ? String(process.env.AI_MODEL || 'gpt-4o-mini').trim() : null,
    });
  });

  router.post('/card-polish', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '');
      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!title) {
        return res.status(400).json({ success: false, message: '卡片标题不能为空' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await polishCardDescription({ title, description });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 润色失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 润色失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  router.post('/card-describe', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const title = String(req.body?.title || '').trim();
      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!title) {
        return res.status(400).json({ success: false, message: '卡片标题不能为空' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await generateCardDescription({ title });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 生成描述失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 生成描述失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  router.post('/card-split', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '');
      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!title) {
        return res.status(400).json({ success: false, message: '卡片标题不能为空' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await splitCardIntoTasks({ title, description });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 拆分失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 拆分失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  router.post('/card-checklist', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '');
      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!title) {
        return res.status(400).json({ success: false, message: '卡片标题不能为空' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await splitCardIntoChecklist({ title, description });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 拆清单失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 拆清单失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  router.post('/card-priority', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '');
      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!title) {
        return res.status(400).json({ success: false, message: '卡片标题不能为空' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await suggestCardPriority({ title, description });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 优先级建议失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 优先级建议失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  router.post('/lane-inject', aiLimiter, async (req, res) => {
    try {
      if (!isAiConfigured()) {
        return res.status(503).json({
          success: false,
          message: '未配置 AI_API_KEY，板内 AI 未启用',
          code: 'AI_NOT_CONFIGURED',
        });
      }

      const boardId = String(req.body?.boardId || '').trim();
      const laneTitle = String(req.body?.laneTitle || '').trim();
      const prompt = String(req.body?.prompt || '').trim();
      const existingTitles = Array.isArray(req.body?.existingTitles)
        ? req.body.existingTitles
        : [];

      if (!boardId) {
        return res.status(400).json({ success: false, message: '缺少 boardId' });
      }
      if (!prompt) {
        return res.status(400).json({ success: false, message: '请输入生成说明' });
      }

      const gate = checkEditAccess(db, boardId, req.user.id);
      if (gate.error) {
        return res.status(gate.error).json({ success: false, message: gate.message });
      }

      const result = await injectLaneTasks({ laneTitle, prompt, existingTitles });
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('AI 列注入失败:', err);
      const status = Number(err?.status) || 502;
      return res.status(status).json({
        success: false,
        message: err?.message || 'AI 列注入失败',
        code: err?.code || 'AI_ERROR',
      });
    }
  });

  return router;
}
