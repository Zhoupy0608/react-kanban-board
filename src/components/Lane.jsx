import { useEffect, useRef, useState } from 'react';
import { formatDueLabel, getDueStatus, normalizePriority, priorityLabel } from '../utils/cardHelpers';
import { getLaneAccent, getPriorityFromTags } from '../styles/kanbanStyles';
import { LaneAiPanel } from './LaneAiPanel';

export function Lane({
  lane,
  boardId,
  onDragStart,
  onDragEnd,
  addCard,
  onAddCards,
  onDragOver,
  onDrop,
  deleteCard,
  draggedCardId,
  onOpenCard,
  onRenameLane,
  onDeleteLane,
  onLaneDragStart,
  onLaneDrop,
  index,
  readOnly = false,
}) {
  const accent = getLaneAccent(lane.title, index);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div
      className="lane"
      style={{ '--lane-bg': accent.bg, '--lane-dot': accent.dot }}
      draggable={!readOnly}
      onDragStart={(e) => {
        if (readOnly) return;
        if (e.target.closest('button, input, .kanban-card, .lane-menu')) return;
        onLaneDragStart(index);
      }}
      onDrop={() => {
        if (readOnly) return;
        if (draggedCardId) onDrop(lane.id);
        else onLaneDrop(index);
      }}
      onDragOver={onDragOver}
    >
      <div className="lane-header">
        <h3 className="lane-title">
          <span className="lane-dot" />
          {lane.title}
          <span style={{ color: 'var(--ink-faint)', fontWeight: 500, fontSize: 13 }}>
            {lane.cards.length}
          </span>
        </h3>

        {!readOnly ? (
          <div className={`lane-menu${menuOpen ? ' is-open' : ''}`} ref={menuRef}>
            <button
              type="button"
              className="lane-menu-btn"
              aria-label="列操作"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              ···
            </button>
            <div className="lane-menu-pop">
              <button
                type="button"
                className="lane-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onRenameLane(lane.id, lane.title);
                }}
              >
                重命名
              </button>
              <button
                type="button"
                className="lane-menu-item lane-menu-item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDeleteLane(lane.id, lane.title, lane.cards.length);
                }}
              >
                删除列
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lane-cards">
        {lane.cards.map((card) => {
          const dueStatus = getDueStatus(card.dueDate);
          const dueLabel = formatDueLabel(card.dueDate);

          return (
            <div
              key={card.id}
              className={`kanban-card${draggedCardId === card.id ? ' is-dragging' : ''}`}
              draggable={!readOnly}
              onDragStart={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                onDragStart(lane.id, card.id);
              }}
              onDragEnd={onDragEnd}
              onDrop={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                onDrop(lane.id, card.id);
              }}
              onDragOver={onDragOver}
              onClick={() => onOpenCard(lane.id, card.id)}
            >
              <div className="card-top">
                <div className="card-title">{card.text}</div>
                <div className="card-tags-corner">
                  <span
                    className={`card-priority card-priority--${normalizePriority(card.priority)}`}
                  >
                    {priorityLabel(card.priority)}
                  </span>
                  {(card.tags || []).map((tag) => {
                    const tone = getPriorityFromTags([tag])?.tone || 'tag';
                    return (
                      <span
                        key={tag}
                        className={`card-priority card-priority--${tone}`}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>

              {card.description ? (
                <div className="card-desc">{card.description}</div>
              ) : (
                <div className="card-desc is-empty">暂无描述</div>
              )}

              {(card.checklist || []).length > 0 ? (
                <div className="card-checklist-badge">
                  清单{' '}
                  {(card.checklist || []).filter((i) => i.done).length}/
                  {(card.checklist || []).length}
                </div>
              ) : null}

              {dueLabel || (card.commentCount || 0) > 0 ? (
                <div className="card-footer">
                  {dueLabel ? (
                    <span className={`due-badge due-badge--${dueStatus}`}>{dueLabel}</span>
                  ) : null}
                  {(card.commentCount || 0) > 0 ? (
                    <button
                      type="button"
                      className="card-comments-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCard(lane.id, card.id);
                      }}
                    >
                      查看评论
                      {card.commentCount > 1 ? ` · ${card.commentCount}` : ''}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!readOnly ? (
                <button
                  type="button"
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCard(lane.id, card.id, card.text);
                  }}
                  aria-label="删除卡片"
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="lane-footer-actions">
          <button type="button" className="add-card-btn" onClick={() => addCard(lane.id)}>
            + 添加卡片
          </button>
          {boardId && onAddCards ? (
            <button type="button" className="lane-ai-btn" onClick={() => setAiOpen(true)}>
              AI 添加
            </button>
          ) : null}
        </div>
      ) : null}

      <LaneAiPanel
        open={aiOpen}
        boardId={boardId}
        laneTitle={lane.title}
        existingTitles={(lane.cards || []).map((c) => c.text).filter(Boolean)}
        onClose={() => setAiOpen(false)}
        onApply={(cards) => {
          onAddCards?.(lane.id, cards);
          setAiOpen(false);
        }}
      />
    </div>
  );
}
