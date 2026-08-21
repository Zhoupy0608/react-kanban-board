import Redis from 'ioredis';

/** @type {import('ioredis').default | null} */
let client = null;
/** @type {'connected' | 'disabled'} */
let mode = 'disabled';

function buildRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return new Redis({
    host: process.env.REDIS_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
}

function redisLabel() {
  return (
    process.env.REDIS_URL?.trim() ||
    `${process.env.REDIS_HOST?.trim() || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
  );
}

/**
 * 连接 Redis。默认必连；仅 REDIS_OPTIONAL=1 或 REDIS_ENABLED=0 时可跳过。
 */
export async function initRedis() {
  if (client) return client;

  if (process.env.REDIS_ENABLED === '0' || process.env.REDIS_OPTIONAL === '1') {
    mode = 'disabled';
    console.warn(
      '[redis] 已跳过连接（REDIS_ENABLED=0 或 REDIS_OPTIONAL=1）。限流/缓存不会跨进程共享。'
    );
    return null;
  }

  const label = redisLabel();
  try {
    client = buildRedis();
    await client.connect();
    await client.ping();
    mode = 'connected';
    console.log(`[redis] 已连接: ${label}`);
    return client;
  } catch (err) {
    try {
      client?.disconnect();
    } catch {
      /* ignore */
    }
    client = null;
    mode = 'disabled';
    throw new Error(
      `Redis 连接失败 (${label}): ${err.message}\n` +
        '请先执行: docker compose up -d\n' +
        '或临时设置 REDIS_OPTIONAL=1 跳过（不推荐）'
    );
  }
}

export function getRedis() {
  return client;
}

export function getRedisMode() {
  return mode === 'connected' ? 'connected' : 'disabled';
}

export async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client?.disconnect();
  }
  client = null;
  mode = 'disabled';
}
