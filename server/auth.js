import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserById, bumpTokenVersion } from './db.js';

const DEFAULT_DEV_SECRET = 'mykanban-dev-secret-change-me';
const ACCESS_EXPIRES = process.env.JWT_EXPIRES || '7d';
const WS_TICKET_EXPIRES = process.env.WS_TICKET_EXPIRES || '60s';

export function isProdRuntime() {
  return process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
}

export function assertAuthConfig() {
  if (process.env.JWT_SECRET) return;
  if (isProdRuntime()) {
    const err = new Error(
      '生产环境必须设置环境变量 JWT_SECRET（随机长字符串），拒绝使用默认密钥启动。'
    );
    err.code = 'JWT_SECRET_REQUIRED';
    throw err;
  }
  console.warn(
    '[auth] 未设置 JWT_SECRET，开发环境使用默认密钥。生产部署前请务必配置。'
  );
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProdRuntime()) {
    throw new Error('生产环境缺少 JWT_SECRET');
  }
  return DEFAULT_DEV_SECRET;
}

export function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(String(password), hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      tv: Number(user.tokenVersion) || 0,
      typ: 'access',
    },
    getJwtSecret(),
    { expiresIn: ACCESS_EXPIRES }
  );
}

export function signWsTicket(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      tv: Number(user.tokenVersion) || 0,
      typ: 'ws',
    },
    getJwtSecret(),
    { expiresIn: WS_TICKET_EXPIRES }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function payloadToUser(payload) {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    tokenVersion: Number(payload.tv) || 0,
  };
}

export function createRequireAuth(db) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, message: '未登录或 Token 缺失' });
    }

    try {
      const payload = verifyToken(match[1]);
      if (payload.typ && payload.typ !== 'access') {
        return res.status(401).json({ success: false, message: 'Token 类型无效' });
      }
      const user = await getUserById(db, payload.sub);
      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }
      const tv = Number(payload.tv) || 0;
      if (tv !== (Number(user.tokenVersion) || 0)) {
        return res.status(401).json({ success: false, message: 'Token 已失效，请重新登录' });
      }
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        tokenVersion: user.tokenVersion,
      };
      return next();
    } catch {
      return res.status(401).json({ success: false, message: 'Token 无效或已过期' });
    }
  };
}

export async function authenticateWsCredential(db, tokenOrTicket) {
  const payload = verifyToken(tokenOrTicket);
  const userRow = await getUserById(db, payload.sub);
  if (!userRow) {
    const err = new Error('user missing');
    err.status = 401;
    throw err;
  }
  const tv = Number(payload.tv) || 0;
  if (tv !== (Number(userRow.tokenVersion) || 0)) {
    const err = new Error('token revoked');
    err.status = 401;
    throw err;
  }
  if (payload.typ === 'ws' || payload.typ === 'access' || !payload.typ) {
    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      tokenVersion: userRow.tokenVersion,
      typ: payload.typ || 'access',
    };
  }
  const err = new Error('invalid token type');
  err.status = 401;
  throw err;
}

export async function revokeUserTokens(db, userId) {
  return bumpTokenVersion(db, userId);
}

export { payloadToUser };
