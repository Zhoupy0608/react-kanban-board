import { getRedis, getRedisMode } from './redis.js';

const BOARD_CACHE_TTL_SEC = Number(process.env.BOARD_CACHE_TTL_SEC) || 30;
const memoryBoardCache = new Map();

function boardCacheKey(boardId) {
  return `board:full:${boardId}`;
}

export function getBoardCacheMode() {
  return getRedis() ? 'redis' : 'memory';
}

export async function getCachedBoardFull(boardId) {
  const key = boardCacheKey(boardId);
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  const entry = memoryBoardCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryBoardCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function setCachedBoardFull(boardId, payload) {
  const key = boardCacheKey(boardId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), 'EX', BOARD_CACHE_TTL_SEC);
      return;
    } catch {
      /* fall through */
    }
  }
  memoryBoardCache.set(key, {
    value: payload,
    expiresAt: Date.now() + BOARD_CACHE_TTL_SEC * 1000,
  });
}

export async function invalidateBoardCache(boardId) {
  const key = boardCacheKey(boardId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }
  }
  memoryBoardCache.delete(key);
}

/** 测试/调试 */
export function __clearBoardCacheForTests() {
  memoryBoardCache.clear();
}

export { getRedisMode };
