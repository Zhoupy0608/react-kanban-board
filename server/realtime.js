/**
 * 轻量 WebSocket 房间：按 boardId / userId 广播实时事件
 */
export function createRealtimeHub() {
  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const boardRooms = new Map();
  /** @type {Map<string, Set<import('ws').WebSocket>>} */
  const userRooms = new Map();

  function add(map, key, ws) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(ws);
  }

  function remove(map, key, ws) {
    const set = map.get(key);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) map.delete(key);
  }

  function send(ws, payload) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  function broadcast(map, key, payload, exceptWs = null) {
    const set = map.get(key);
    if (!set) return;
    for (const client of set) {
      if (exceptWs && client === exceptWs) continue;
      send(client, payload);
    }
  }

  return {
    joinBoard(boardId, ws) {
      add(boardRooms, boardId, ws);
      ws._boardId = boardId;
    },
    joinUser(userId, ws) {
      add(userRooms, userId, ws);
      ws._userId = userId;
    },
    leave(ws) {
      if (ws._boardId) remove(boardRooms, ws._boardId, ws);
      if (ws._userId) remove(userRooms, ws._userId, ws);
    },
    broadcastBoard(boardId, payload, exceptWs = null) {
      broadcast(boardRooms, boardId, payload, exceptWs);
    },
    notifyUser(userId, payload) {
      broadcast(userRooms, userId, payload);
    },
  };
}
