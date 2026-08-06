const BASE_URL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
export const TOKEN_KEY = 'mykanban_token';

/** 使用 sessionStorage：每个窗口/标签页独立登录态，刷新保留，互不影响 */
function tokenStore() {
  return window.sessionStorage;
}

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function getToken() {
  return tokenStore().getItem(TOKEN_KEY);
}

export function setToken(token) {
  // 清理旧的 localStorage，避免多窗口被串号
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  if (token) tokenStore().setItem(TOKEN_KEY, token);
  else tokenStore().removeItem(TOKEN_KEY);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  tokenStore().removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (response.status === 401) {
    clearToken();
    onUnauthorized?.();
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || `请求失败: ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}

export const authService = {
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  wsTicket: async () => {
    const data = await request('/auth/ws-ticket', { method: 'POST' });
    return data.ticket;
  },
};

export const boardsService = {
  list: async () => {
    const data = await request('/boards');
    return data.boards || [];
  },
  create: async (payload) => {
    const data = await request('/boards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.board;
  },
  get: async (id) => {
    const data = await request(`/boards/${id}`);
    return data.board;
  },
  update: async (id, payload) => {
    const data = await request(`/boards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.board;
  },
  remove: async (id) => request(`/boards/${id}`, { method: 'DELETE' }),
  getFull: async (id) => {
    const data = await request(`/boards/${id}/full`);
    return data;
  },
  updateFull: async (id, { lanes, baseVersion, force = false }) =>
    request(`/boards/${id}/full`, {
      method: 'PUT',
      body: JSON.stringify({ lanes, baseVersion, force }),
    }),
  activity: async (id, limit = 40) => {
    const data = await request(`/boards/${id}/activity?limit=${limit}`);
    return data.events || [];
  },
  members: async (id) => {
    const data = await request(`/boards/${id}/members`);
    return data.members || [];
  },
  addMember: async (id, payload) => {
    const data = await request(`/boards/${id}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.member;
  },
  updateMember: (id, userId, payload) =>
    request(`/boards/${id}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  removeMember: (id, userId) =>
    request(`/boards/${id}/members/${userId}`, { method: 'DELETE' }),
  listComments: async (boardId, cardId) => {
    const data = await request(`/boards/${boardId}/cards/${cardId}/comments`);
    return data.comments || [];
  },
  addComment: async (boardId, cardId, body) => {
    const data = await request(`/boards/${boardId}/cards/${cardId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return data.comment;
  },
  deleteComment: (boardId, commentId) =>
    request(`/boards/${boardId}/comments/${commentId}`, { method: 'DELETE' }),
};

export const notificationsService = {
  list: async (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.unreadOnly) q.set('unread', '1');
    if (opts.limit) q.set('limit', String(opts.limit));
    const data = await request(`/notifications?${q}`);
    return data;
  },
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
  remove: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
};

/** 先换短时 ticket，再拼 WebSocket URL（避免长期 JWT 出现在 query） */
export async function createWsUrl({ boardId } = {}) {
  if (!getToken()) return null;
  const ticket = await authService.wsTicket();
  if (!ticket) return null;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ ticket });
  if (boardId) params.set('boardId', boardId);
  return `${proto}//${window.location.host}/ws?${params}`;
}

/** @deprecated 请使用 createWsUrl；保留同步签名会误用长期 token */
export function getWsUrl({ boardId } = {}) {
  const token = getToken();
  if (!token) return null;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ token });
  if (boardId) params.set('boardId', boardId);
  return `${proto}//${window.location.host}/ws?${params}`;
}

/** @deprecated 兼容旧命名；请使用 boardsService */
export const boardService = {
  getBoard: async (boardId) => {
    const data = await boardsService.getFull(boardId);
    return data.lanes || [];
  },
  updateBoard: (boardId, lanes) =>
    boardsService.updateFull(boardId, { lanes, force: true }),
};
