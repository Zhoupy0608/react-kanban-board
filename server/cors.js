import { isProdRuntime } from './auth.js';

/**
 * CORS：通过 CORS_ORIGINS（逗号分隔）配置白名单。
 * - 未配置且开发：反射请求 Origin（便于 Vite / 本机）
 * - 未配置且生产：仅允许无 Origin 的同源请求（浏览器跨域会被拒）
 */
export function buildCorsOptions() {
  const list = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (list.length > 0) {
    return {
      origin(origin, callback) {
        if (!origin || list.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    };
  }

  if (isProdRuntime()) {
    return {
      origin: false,
      credentials: false,
    };
  }

  return {
    origin: true,
    credentials: true,
  };
}
