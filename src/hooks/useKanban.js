import { useState, useCallback, useEffect, useRef } from 'react';
import { ApiError, boardsService, getToken } from '../services/api';
import { normalizeCard, normalizeChecklist, normalizePriority, normalizeTags } from '../utils/cardHelpers';

const UNDO_LIMIT = 30;
const SYNC_DEBOUNCE_MS = 280;

/**
 * 乐观更新 + 串行同步队列：
 * - UI 立即反映本地状态，避免拖拽卡顿
 * - 高频写入合并为「最新快照」再落库，并用 generation 丢弃过期响应，防止乱序覆盖
 * - 携带 contentVersion 做乐观锁；409 时采用服务器版本，可选择强制覆盖
 */
export function useKanban(boardId) {
  const [data, setData] = useState([]);
  const [boardMeta, setBoardMeta] = useState(null);
  const [role, setRole] = useState('owner');
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedLaneIdx, setdraggedLaneIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [syncConflict, setSyncConflict] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const dataRef = useRef([]);
  const boardMetaRef = useRef(null);
  const undoStackRef = useRef([]);
  const syncGenRef = useRef(0);
  const pendingBoardRef = useRef(null);
  const syncTimerRef = useRef(null);
  const flushingRef = useRef(false);
  const boardIdRef = useRef(boardId);
  const conflictLocalRef = useRef(null);

  useEffect(() => {
    boardIdRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    boardMetaRef.current = boardMeta;
  }, [boardMeta]);

  const clearToast = useCallback(() => {
    setSyncError(null);
    setLoadError(null);
    setSyncConflict(false);
    conflictLocalRef.current = null;
  }, []);

  /** 冲突后采用服务器版本（本地冲突草稿丢弃） */
  const acceptServerVersion = useCallback(() => {
    conflictLocalRef.current = null;
    setSyncConflict(false);
    setSyncError(null);
  }, []);

  const applyRemoteBoard = useCallback((lanes, meta) => {
    const normalized = (lanes || []).map((lane) => ({
      ...lane,
      cards: (lane.cards || []).map(normalizeCard),
    }));
    dataRef.current = normalized;
    setData(normalized);
    if (meta) {
      setBoardMeta((prev) => {
        const next = { ...prev, ...meta };
        boardMetaRef.current = next;
        return next;
      });
    }
    undoStackRef.current = [];
    setCanUndo(false);
    pendingBoardRef.current = null;
  }, []);

  const flushSync = useCallback(async (options = {}) => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const board = pendingBoardRef.current;
    const id = boardIdRef.current;
    if (!board || !id || flushingRef.current) return;

    flushingRef.current = true;
    pendingBoardRef.current = null;
    const gen = ++syncGenRef.current;
    const force = Boolean(options.force);
    const baseVersion = Number(boardMetaRef.current?.contentVersion) || 1;

    try {
      const res = await boardsService.updateFull(id, {
        lanes: board,
        baseVersion: force ? undefined : baseVersion,
        force,
      });
      if (gen === syncGenRef.current && !pendingBoardRef.current) {
        setSyncError(null);
        setSyncConflict(false);
        conflictLocalRef.current = null;
        if (res?.board) {
          setBoardMeta((prev) => {
            const next = { ...prev, ...res.board };
            boardMetaRef.current = next;
            return next;
          });
        }
      }
    } catch (err) {
      console.error('同步数据到后端失败:', err);
      if (gen !== syncGenRef.current) return;

      if (err instanceof ApiError && err.status === 409 && err.body?.code === 'VERSION_CONFLICT') {
        conflictLocalRef.current = board;
        applyRemoteBoard(err.body.lanes, err.body.board);
        setSyncConflict(true);
        setSyncError(
          '检测到内容冲突：已显示服务器最新版。可保留该版本，或强制覆盖为你刚才的修改。'
        );
        return;
      }

      setSyncError('同步失败：本地已更新，但未写入服务器。请检查后端后重试操作。');
    } finally {
      flushingRef.current = false;
      if (pendingBoardRef.current) {
        void flushSync();
      }
    }
  }, [applyRemoteBoard]);

  const forceOverwriteConflict = useCallback(() => {
    const local = conflictLocalRef.current;
    if (!local) {
      setSyncConflict(false);
      setSyncError(null);
      return;
    }
    dataRef.current = local;
    setData(local);
    pendingBoardRef.current = local;
    setSyncConflict(false);
    setSyncError(null);
    void flushSync({ force: true });
  }, [flushSync]);

  const scheduleSync = useCallback(
    (board) => {
      pendingBoardRef.current = board;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        void flushSync();
      }, SYNC_DEBOUNCE_MS);
    },
    [flushSync]
  );

  useEffect(() => {
    const onBeforeUnload = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      const board = pendingBoardRef.current;
      const id = boardIdRef.current;
      if (!board || !id) return;
      pendingBoardRef.current = null;
      try {
        const body = JSON.stringify({
          lanes: board,
          baseVersion: Number(boardMetaRef.current?.contentVersion) || 1,
        });
        const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        void fetch(`${base}/boards/${id}/full`, {
          method: 'PUT',
          headers,
          body,
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!boardId) return undefined;

    let cancelled = false;
    const initData = async () => {
      setLoading(true);
      undoStackRef.current = [];
      setCanUndo(false);
      pendingBoardRef.current = null;
      try {
        const full = await boardsService.getFull(boardId);
        if (cancelled) return;
        const normalized = (full.lanes || []).map((lane) => ({
          ...lane,
          cards: (lane.cards || []).map(normalizeCard),
        }));
        dataRef.current = normalized;
        setData(normalized);
        setBoardMeta(full.board || null);
        setRole(full.role || 'owner');
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError('无法加载看板，请确认已登录且有权限访问');
          setBoardMeta(null);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initData();
    return () => {
      cancelled = true;
    };
  }, [boardId]);
  const pushUndoSnapshot = useCallback((snapshot) => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(UNDO_LIMIT - 1)),
      structuredClone(snapshot),
    ];
    setCanUndo(true);
  }, []);

  /** 函数式更新，避免闭包陈旧 data 在连续拖拽中丢状态 */
  const commitBoard = useCallback(
    (updater, { recordUndo = false } = {}) => {
      const prev = dataRef.current;
      if (recordUndo) pushUndoSnapshot(prev);

      const next = typeof updater === 'function' ? updater(prev) : updater;
      dataRef.current = next;
      setData(next);
      scheduleSync(next);
      return next;
    },
    [pushUndoSnapshot, scheduleSync]
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return false;
    const snapshot = stack.pop();
    undoStackRef.current = stack;
    setCanUndo(stack.length > 0);
    dataRef.current = snapshot;
    setData(snapshot);
    scheduleSync(snapshot);
    return true;
  }, [scheduleSync]);

  const patchCard = useCallback(
    (laneId, cardId, patch) => {
      commitBoard((prev) =>
        prev.map((lane) =>
          lane.id === laneId
            ? {
                ...lane,
                cards: lane.cards.map((card) =>
                  card.id === cardId ? normalizeCard({ ...card, ...patch }) : card
                ),
              }
            : lane
        )
      );
    },
    [commitBoard]
  );

  const addCard = useCallback(
    (laneId, text, tags = [], dueDate = '', description = '') => {
      const trimmed = (text || '').trim();
      if (!trimmed) return;

      commitBoard((prev) =>
        prev.map((lane) =>
          lane.id === laneId
            ? {
                ...lane,
                cards: [
                  ...lane.cards,
                  normalizeCard({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    text: trimmed,
                    description: String(description || ''),
                    tags: normalizeTags(tags),
                    dueDate: dueDate || '',
                  }),
                ],
              }
            : lane
        )
      );
    },
    [commitBoard]
  );

  const addCards = useCallback(
    (laneId, cards = []) => {
      const prepared = (cards || [])
        .map((c, i) => {
          const text = String(c?.text || c?.title || '').trim();
          if (!text) return null;
          return normalizeCard({
            id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            description: String(c?.description || ''),
            tags: normalizeTags(c?.tags || []),
            dueDate: c?.dueDate || '',
          });
        })
        .filter(Boolean);
      if (!prepared.length) return;

      commitBoard((prev) =>
        prev.map((lane) =>
          lane.id === laneId
            ? { ...lane, cards: [...lane.cards, ...prepared] }
            : lane
        )
      );
    },
    [commitBoard]
  );

  const deleteCard = useCallback(
    (laneId, cardId) => {
      commitBoard(
        (prev) =>
          prev.map((lane) =>
            lane.id === laneId
              ? { ...lane, cards: lane.cards.filter((c) => c.id !== cardId) }
              : lane
          ),
        { recordUndo: true }
      );
    },
    [commitBoard]
  );

  const onDragStart = useCallback((laneId, cardId) => {
    setDraggedCard({ laneId, cardId });
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggedCard(null);
  }, []);

  const onDrop = useCallback(
    (targetLaneId, targetCardId = null) => {
      if (!draggedCard) return;

      const { laneId: sourceLaneId, cardId } = draggedCard;
      commitBoard((prev) => {
        const sourceLane = prev.find((l) => l.id === sourceLaneId);
        const cardToMove = sourceLane?.cards.find((c) => c.id === cardId);
        if (!cardToMove) return prev;

        return prev.map((lane) => {
          let newCards = lane.cards.filter((c) => c.id !== cardId);
          if (lane.id === targetLaneId) {
            if (targetCardId) {
              const targetIndex = newCards.findIndex((c) => c.id === targetCardId);
              newCards.splice(
                targetIndex >= 0 ? targetIndex : newCards.length,
                0,
                cardToMove
              );
            } else {
              newCards.push(cardToMove);
            }
          }
          return { ...lane, cards: newCards };
        });
      });
      setDraggedCard(null);
    },
    [draggedCard, commitBoard]
  );

  const updateCardText = useCallback(
    (laneId, cardId, newText) => {
      const trimmed = (newText || '').trim();
      if (!trimmed) return;
      patchCard(laneId, cardId, { text: trimmed });
    },
    [patchCard]
  );

  const updateCardDescription = useCallback(
    (laneId, cardId, newDesc) => {
      patchCard(laneId, cardId, { description: newDesc ?? '' });
    },
    [patchCard]
  );

  const updateCardTags = useCallback(
    (laneId, cardId, tags = []) => {
      patchCard(laneId, cardId, { tags: normalizeTags(tags) });
    },
    [patchCard]
  );

  const updateCardDueDate = useCallback(
    (laneId, cardId, dueDate = '') => {
      patchCard(laneId, cardId, { dueDate: dueDate || '' });
    },
    [patchCard]
  );

  const updateCard = useCallback(
    (laneId, cardId, patch) => {
      const next = { ...patch };
      if (next.tags !== undefined) next.tags = normalizeTags(next.tags);
      if (next.checklist !== undefined) next.checklist = normalizeChecklist(next.checklist);
      if (next.priority !== undefined) next.priority = normalizePriority(next.priority);
      if (next.text !== undefined) {
        next.text = String(next.text || '').trim();
        if (!next.text) return;
      }
      if (next.dueDate !== undefined) next.dueDate = next.dueDate || '';
      patchCard(laneId, cardId, next);
    },
    [patchCard]
  );

  const onLaneDragStart = useCallback((index) => {
    setdraggedLaneIdx(index);
  }, []);

  const onLaneDrop = useCallback(
    (targetIndex) => {
      if (draggedLaneIdx === null || draggedLaneIdx === targetIndex) return;

      commitBoard((prev) => {
        const newData = [...prev];
        const movedLane = newData.splice(draggedLaneIdx, 1)[0];
        newData.splice(targetIndex, 0, movedLane);
        return newData;
      });
      setdraggedLaneIdx(null);
    },
    [draggedLaneIdx, commitBoard]
  );

  const addLane = useCallback(
    (title) => {
      const trimmed = (title || '').trim();
      if (!trimmed) return;

      commitBoard((prev) => [
        ...prev,
        { id: `lane-${Date.now()}`, title: trimmed, cards: [] },
      ]);
    },
    [commitBoard]
  );

  const renameLane = useCallback(
    (laneId, title) => {
      const trimmed = (title || '').trim();
      if (!trimmed) return;
      commitBoard((prev) =>
        prev.map((lane) => (lane.id === laneId ? { ...lane, title: trimmed } : lane))
      );
    },
    [commitBoard]
  );

  const deleteLane = useCallback(
    (laneId) => {
      commitBoard((prev) => prev.filter((lane) => lane.id !== laneId), {
        recordUndo: true,
      });
    },
    [commitBoard]
  );

  /** 仅更新本地评论数，不触发看板内容同步 */
  const setCardCommentCount = useCallback((cardId, countOrUpdater) => {
    const prev = dataRef.current;
    const next = prev.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => {
        if (card.id !== cardId) return card;
        const nextCount =
          typeof countOrUpdater === 'function'
            ? countOrUpdater(card.commentCount || 0)
            : countOrUpdater;
        return normalizeCard({
          ...card,
          commentCount: Math.max(0, Number(nextCount) || 0),
        });
      }),
    }));
    dataRef.current = next;
    setData(next);
  }, []);

  const moveCard = useCallback(
    (fromLaneId, cardId, toLaneId) => {
      if (fromLaneId === toLaneId) return;

      commitBoard((prev) => {
        const sourceLane = prev.find((l) => l.id === fromLaneId);
        const cardToMove = sourceLane?.cards.find((c) => c.id === cardId);
        if (!cardToMove) return prev;

        return prev.map((lane) => {
          if (lane.id === fromLaneId) {
            return { ...lane, cards: lane.cards.filter((c) => c.id !== cardId) };
          }
          if (lane.id === toLaneId) {
            return { ...lane, cards: [...lane.cards, cardToMove] };
          }
          return lane;
        });
      });
    },
    [commitBoard]
  );

  return {
    data,
    boardMeta,
    role,
    loading,
    loadError,
    syncError,
    syncConflict,
    clearToast,
    acceptServerVersion,
    forceOverwriteConflict,
    canUndo,
    undo,
    applyRemoteBoard,
    setCardCommentCount,
    draggedCard,
    addCard,
    addCards,
    addLane,
    renameLane,
    deleteLane,
    deleteCard,
    updateCard,
    updateCardText,
    updateCardDescription,
    updateCardTags,
    updateCardDueDate,
    moveCard,
    onDragStart,
    onDragEnd,
    onDragOver: (e) => e.preventDefault(),
    onDrop: (targetLaneId, targetCardId = null) => {
      if (!draggedCard) return;
      onDrop(targetLaneId, targetCardId);
    },
    onLaneDragStart,
    onLaneDrop,
  };
}
