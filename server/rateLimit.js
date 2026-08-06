/**
 * 简易内存限流（按 IP）。适合单机演示；多实例需换 Redis 等共享存储。
 */
export function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) || Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const max = Number(options.max) || Number(process.env.RATE_LIMIT_MAX) || 30;
  const message = options.message || '请求过于频繁，请稍后再试';
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

  return function rateLimit(req, res, next) {
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
  };
}

/** 测试用：清空限流计数 */
export function __resetRateLimitersForTests() {
  /* no-op placeholder — limiters are per-instance closures */
}
