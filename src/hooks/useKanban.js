import { useState, useCallback, useEffect } from 'react';
import { boardService } from '../services/api';
import { normalizeCard, normalizeTags } from '../utils/cardHelpers';

export function useKanban() {
  const [data, setData] = useState([]);
  const [draggedCard, setDraggedCard] = useState(null);
  const [draggedLaneIdx, setdraggedLaneIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const resData = await boardService.getBoard();
        const normalized = (resData || []).map((lane) => ({
          ...lane,
          cards: (lane.cards || []).map(normalizeCard),
        }));
        setData(normalized);
        setLoadError(null);
      } catch {
        setLoadError('无法加载看板，请确认后端已启动（npm run server）');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  const clearToast = useCallback(() => {
    setSyncError(null);
    setLoadError(null);
  }, []);

  const persistData = useCallback(async (newData) => {
    setData(newData);
    try {
      await boardService.updateBoard(newData);
      setSyncError(null);
    } catch (err) {
      console.error('同步数据到后端失败:', err);
      setSyncError('同步失败：本地已更新，但未写入服务器。请检查后端后重试操作。');
    }
  }, []);

  const patchCard = useCallback((laneId, cardId, patch) => {
    const newData = data.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            cards: lane.cards.map((card) =>
              card.id === cardId ? normalizeCard({ ...card, ...patch }) : card
            ),
          }
        : lane
    );
    persistData(newData);
  }, [data, persistData]);

  const addCard = useCallback((laneId, text, tags = [], dueDate = '') => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const newData = data.map((lane) =>
      lane.id === laneId
        ? {
            ...lane,
            cards: [
              ...lane.cards,
              normalizeCard({
                id: Date.now().toString(),
                text: trimmed,
                description: '',
                tags: normalizeTags(tags),
                dueDate: dueDate || '',
              }),
            ],
          }
        : lane
    );
    persistData(newData);
  }, [data, persistData]);

  const deleteCard = useCallback((laneId, cardId) => {
    const newData = data.map((lane) =>
      lane.id === laneId
        ? { ...lane, cards: lane.cards.filter((c) => c.id !== cardId) }
        : lane
    );
    persistData(newData);
  }, [data, persistData]);

  const onDragStart = useCallback((laneId, cardId) => {
    setDraggedCard({ laneId, cardId });
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggedCard(null);
  }, []);

  const onDrop = useCallback((targetLaneId, targetCardId = null) => {
    if (!draggedCard) return;

    const { laneId: sourceLaneId, cardId } = draggedCard;
    const sourceLane = data.find((l) => l.id === sourceLaneId);
    const cardToMove = sourceLane?.cards.find((c) => c.id === cardId);
    if (!cardToMove) {
      setDraggedCard(null);
      return;
    }

    const newData = data.map((lane) => {
      let newCards = lane.cards.filter((c) => c.id !== cardId);

      if (lane.id === targetLaneId) {
        if (targetCardId) {
          const targetIndex = newCards.findIndex((c) => c.id === targetCardId);
          newCards.splice(targetIndex >= 0 ? targetIndex : newCards.length, 0, cardToMove);
        } else {
          newCards.push(cardToMove);
        }
      }
      return { ...lane, cards: newCards };
    });

    persistData(newData);
    setDraggedCard(null);
  }, [draggedCard, data, persistData]);

  const updateCardText = useCallback((laneId, cardId, newText) => {
    const trimmed = (newText || '').trim();
    if (!trimmed) return;
    patchCard(laneId, cardId, { text: trimmed });
  }, [patchCard]);

  const updateCardDescription = useCallback((laneId, cardId, newDesc) => {
    patchCard(laneId, cardId, { description: newDesc ?? '' });
  }, [patchCard]);

  const updateCardTags = useCallback((laneId, cardId, tags = []) => {
    patchCard(laneId, cardId, { tags: normalizeTags(tags) });
  }, [patchCard]);

  const updateCardDueDate = useCallback((laneId, cardId, dueDate = '') => {
    patchCard(laneId, cardId, { dueDate: dueDate || '' });
  }, [patchCard]);

  const updateCard = useCallback((laneId, cardId, patch) => {
    const next = { ...patch };
    if (next.tags !== undefined) next.tags = normalizeTags(next.tags);
    if (next.text !== undefined) {
      next.text = String(next.text || '').trim();
      if (!next.text) return;
    }
    if (next.dueDate !== undefined) next.dueDate = next.dueDate || '';
    patchCard(laneId, cardId, next);
  }, [patchCard]);

  const onLaneDragStart = useCallback((index) => {
    setdraggedLaneIdx(index);
  }, []);

  const onLaneDrop = useCallback((targetIndex) => {
    if (draggedLaneIdx === null || draggedLaneIdx === targetIndex) return;

    const newData = [...data];
    const movedLane = newData.splice(draggedLaneIdx, 1)[0];
    newData.splice(targetIndex, 0, movedLane);

    persistData(newData);
    setdraggedLaneIdx(null);
  }, [data, draggedLaneIdx, persistData]);

  const addLane = useCallback((title) => {
    const trimmed = (title || '').trim();
    if (!trimmed) return;

    persistData([
      ...data,
      { id: `lane-${Date.now()}`, title: trimmed, cards: [] },
    ]);
  }, [data, persistData]);

  const renameLane = useCallback((laneId, title) => {
    const trimmed = (title || '').trim();
    if (!trimmed) return;
    const newData = data.map((lane) =>
      lane.id === laneId ? { ...lane, title: trimmed } : lane
    );
    persistData(newData);
  }, [data, persistData]);

  const deleteLane = useCallback((laneId) => {
    persistData(data.filter((lane) => lane.id !== laneId));
  }, [data, persistData]);

  const moveCard = useCallback((fromLaneId, cardId, toLaneId) => {
    if (fromLaneId === toLaneId) return;
    const sourceLane = data.find((l) => l.id === fromLaneId);
    const cardToMove = sourceLane?.cards.find((c) => c.id === cardId);
    if (!cardToMove) return;

    const newData = data.map((lane) => {
      if (lane.id === fromLaneId) {
        return { ...lane, cards: lane.cards.filter((c) => c.id !== cardId) };
      }
      if (lane.id === toLaneId) {
        return { ...lane, cards: [...lane.cards, cardToMove] };
      }
      return lane;
    });
    persistData(newData);
  }, [data, persistData]);

  return {
    data,
    loading,
    loadError,
    syncError,
    clearToast,
    draggedCard,
    addCard,
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
