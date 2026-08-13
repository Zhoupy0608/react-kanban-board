import { useEffect, useRef, useState } from 'react';
import { formatDueLabel, getDueStatus } from '../utils/cardHelpers';
import { getLaneAccent, getPriorityFromTags } from '../styles/kanbanStyles';
import { LaneAiPanel } from './LaneAiPanel';

const MIN_LANE_WIDTH = 200;
const MAX_LANE_WIDTH = 520;
const DEFAULT_LANE_WIDTH = 280;
const MIN_LANE_HEIGHT = 220;
const MAX_LANE_HEIGHT = 800;

export function Lane({
  lane,
  boardId,
  width = DEFAULT_LANE_WIDTH,
  height = null,
  onWidthChange,
  onHeightChange,
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
  const [resizing, setResizing] = useState(false);
  const menuRef = useRef(null);
  const laneRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const startResizeWidth = (e) => {
    if (!onWidthChange) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = Number(width) || DEFAULT_LANE_WIDTH;
    setResizing(true);

    const onMove = (ev) => {
      const next = Math.min(
        MAX_LANE_WIDTH,
        Math.max(MIN_LANE_WIDTH, startWidth + (ev.clientX - startX))
      );
      onWidthChange(lane.id, next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResizeHeight = (e) => {
    if (!onHeightChange) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const measured = laneRef.current?.getBoundingClientRect()?.height;
    const startHeight = Number(height) || Math.round(measured || MIN_LANE_HEIGHT);
    setResizing(true);

    const onMove = (ev) => {
      const next = Math.min(
        MAX_LANE_HEIGHT,
        Math.max(MIN_LANE_HEIGHT, startHeight + (ev.clientY - startY))
      );
      onHeightChange(lane.id, next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const customHeight = Number(height) > 0 ? Number(height) : null;

  return (
    <div
      ref={laneRef}
      className={`lane${resizing ? ' is-resizing' : ''}${customHeight ? ' has-custom-height' : ''}`}
      style={{
        '--lane-bg': accent.bg,
        '--lane-dot': accent.dot,
        '--lane-width': `${Number(width) || DEFAULT_LANE_WIDTH}px`,
        ...(customHeight ? { '--lane-height': `${customHeight}px` } : null),
      }}
      draggable={!readOnly && !resizing}
      onDragStart={(e) => {
        if (readOnly || resizing) return;
        if (
          e.target.closest(
            'button, input, .kanban-card, .lane-menu, .lane-resize-handle'
          )
        ) {
          return;
        }
        onLaneDragStart(index);
      }}
      onDrop={() => {
        if (readOnly || resizing) return;
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
                {(card.tags || []).length > 0 ? (
                  <div className="card-tags-corner">
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
                ) : null}
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
              <svg
                className="lane-ai-btn-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.5 15.5l.6 2.2 2.2.6-2.2.6-.6 2.2-.6-2.2-2.2-.6 2.2-.6.6-2.2z"
                />
              </svg>
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

      {onWidthChange ? (
        <div
          className="lane-resize-handle lane-resize-handle--x"
          role="separator"
          aria-orientation="vertical"
          aria-label="调节列宽"
          onMouseDown={startResizeWidth}
        />
      ) : null}
      {onHeightChange ? (
        <div
          className="lane-resize-handle lane-resize-handle--y"
          role="separator"
          aria-orientation="horizontal"
          aria-label="调节列高"
          onMouseDown={startResizeHeight}
        />
      ) : null}
    </div>
  );
}
