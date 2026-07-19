import React, { memo } from 'react';
import { styles } from '../styles/kanbanStyles';

export const Lane = memo(({
  lane,
  onDragStart,
  addCard,
  onDragOver,
  onDrop,
  deleteCard,
  draggedCardId,
  updateCardText,
  updateCardDescription,
  updateCardTags,
  onLaneDragStart,
  onLaneDrop,
  index,
}) => {
  return (
    <div
      draggable
      onDragStart={() => onLaneDragStart(index)}
      onDrop={() => {
        if (draggedCardId) {
          onDrop(lane.id);
        } else {
          onLaneDrop(index);
        }
      }}
      onDragOver={onDragOver}
      style={styles.lane}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000', margin: 8, paddingLeft: '4px' }}>
          {lane.title}
          <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: '#5e6c84' }}>
            ({lane.cards.length})
          </span>
        </h3>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {lane.cards.map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={() => onDragStart(lane.id, card.id)}
            onDrop={(e) => {
              e.stopPropagation();
              onDrop(lane.id, card.id);
            }}
            onDragOver={onDragOver}
            style={{
              ...styles.card,
              opacity: draggedCardId === card.id ? 0.5 : 1,
              cursor: 'grab',
              border: draggedCardId === card.id ? '2px dashed #4c9aff' : 'none',
            }}
          >
            <div style={{ flex: 1, marginRight: '12px', minWidth: 0, wordBreak: 'break-word', whiteSpace: 'normal' }}>
              <div
                title="点击修改标题"
                style={{
                  fontWeight: 'bold',
                  fontSize: '18px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateCardText(lane.id, card.id, card.text);
                }}
              >
                {card.text}
              </div>

              <div
                title="点击修改描述"
                style={{
                  fontSize: '14px',
                  color: '#5e6c84',
                  lineHeight: '1.6',
                  cursor: 'pointer',
                  minHeight: '18px',
                  borderBottom: card.description ? 'none' : '1px dashed #ccc',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateCardDescription(lane.id, card.id, card.description);
                }}
              >
                {card.description || '点击添加描述...'}
              </div>

              {(card.tags || []).length > 0 ? (
                <div
                  style={styles.tagList}
                  title="点击修改标签"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCardTags(lane.id, card.id, card.tags || []);
                  }}
                >
                  {(card.tags || []).map((tag) => (
                    <span key={tag} style={styles.tagChip}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span
                  style={styles.tagEditHint}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCardTags(lane.id, card.id, []);
                  }}
                >
                  点击添加标签...
                </span>
              )}
            </div>

            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteCard(lane.id, card.id);
              }}
              style={styles.deleteBtn}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => addCard(lane.id)}
        style={styles.addButton}
        onMouseOver={(e) => (e.target.style.background = '#e8ecef')}
        onMouseOut={(e) => (e.target.style.background = 'transparent')}
      >
        + 添加卡片
      </button>
    </div>
  );
});
