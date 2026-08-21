/**
 * 限流：优先 Redis（INCR + EXPIRE），未连接时降级内存 Map。
 */
import { getRedis } from './redis.js';

export function createRateLimiter(options = {}) {
  const windowMs =
    Number(options.windowMs) ||
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000;
  const max =
    Number(options.max) || Number(process.env.RATE_LIMIT_MAX) || 30;
  const message = options.message || '请求过于频繁，请稍后再试';
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const hits = new Map();

  function clientKey(req) {
    return (
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  function prune(now) {
    for (const [key, entry] of hits) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }

  function memoryRateLimit(req, res, next) {
    const now = Date.now();
    if (hits.size > 5000) prune(now);

    const key = `${options.name || 'default'}:${clientKey(req)}`;
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      const retrySec = Math.ceil((windowMs - (now - entry.start)) / 1000);
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({ success: false, message });
    }
    return next();
  }

  async function redisRateLimit(req, res, next) {
    const redis = getRedis();
    if (!redis) return memoryRateLimit(req, res, next);

    const key = `ratelimit:${options.name || 'default'}:${clientKey(req)}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));

      if (count > max) {
        res.setHeader('Retry-After', String(Math.max(1, ttl)));
        return res.status(429).json({ success: false, message });
      }
      return next();
    } catch {
      return memoryRateLimit(req, res, next);
    }
  }

  return (req, res, next) => {
    redisRateLimit(req, res, next).catch(() => memoryRateLimit(req, res, next));
  };
}

export function __resetRateLimitersForTests() {
  /* limiters are per-instance closures */
}
