import React, { memo } from 'react';
import { styles } from '../styles/kanbanStyles';

export const Lane = memo(({lane, onDragStart, addCard, onDragOver, onDrop, deleteCard, draggedCardId, updateCardText, updateCardDescription, onLaneDragStart, onLaneDrop, index}) => {
  return(
    <div
      draggable
      onDragStart={() => onLaneDragStart(index)} // 绑定列拖拽开始
      onDrop={(e) => {
        // 逻辑判断：如果是卡片拖过来，走卡片逻辑；如果是列拖过来，走列逻辑
        if (draggedCardId) {
          onDrop(lane.id);
        } else {
          onLaneDrop(index);
        }
      }}
      onDragOver={onDragOver}
      style={ styles.lane }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#000000', margin: 8, paddingLeft: '4px' }}>
          {lane.title}
        </h3>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 渲染卡片 给 Card 增加 Drop 事件 使卡片不仅可以被“拖”，也可以被“放”（插入到指定位置）*/}
        {lane.cards.map(card => (
          <div
            key={card.id} 
            draggable// 开启原生拖拽
            onDragStart={() => onDragStart(lane.id, card.id)}// 开始拖拽
            // 当卡片落在另一张卡片上时，触发 Drop
            onDrop={(e) => {
              e.stopPropagation();// 阻止事件冒泡，避免触发 Lane 的 onDrop 导致 onDrop 被触发两次
              onDrop(lane.id, card.id);
            }}
            onDragOver={onDragOver} // 阻止默认行为 默认是不能拖的
            style={{
              ...styles.card,
              opacity: draggedCardId === card.id ? 0.5 : 1, // 拖动时半透明
              cursor: 'grab', // 提示用户这里可以拖拽
              border: draggedCardId === card.id ? '2px dashed #4c9aff' : 'none' // 拖动时加边框
            }}
          >
            <div style={{ flex: 1, marginRight: '12px', minWidth: 0, wordBreak: 'break-word', whiteSpace: 'normal' }}>
              {/* --- 标题部分 --- */}
              <div
                title="点击修改标题"  // 鼠标悬停提示
                style={{ 
                  fontWeight: 'bold', 
                  fontSize: '18px',
                  marginBottom: '12px', 
                  cursor: 'pointer', // 变成手型提示可点
                  display: 'block' 
                }}
                onClick={(e) => {
                  e.stopPropagation(); // 防止触发列的点击（如果有的话）
                  updateCardText(lane.id, card.id, card.text);
                }}
              >
                {card.text}
              </div>
              {/* --- 描述部分 --- */}
              <div 
                title="点击修改描述" // 鼠标悬停提示
                style={{ 
                  fontSize: '14px', 
                  color: '#5e6c84', 
                  lineHeight: '1.6', 
                  cursor: 'pointer',
                  minHeight: '18px', // 即使没内容也占位，方便点击添加
                  borderBottom: card.description ? 'none' : '1px dashed #ccc' // 没内容时显示虚线
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  updateCardDescription(lane.id, card.id, card.description);
                }}
              >
                {card.description || '点击添加描述...'}
              </div>
            </div>

            <button 
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();// 关键：防止点击删除时也触发编辑
                deleteCard(lane.id, card.id)
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
        onMouseOver={(e) => e.target.style.background = '#e8ecef'}
        onMouseOut={(e) => e.target.style.background = 'transparent'}
      >
      + 添加卡片
      </button>

    </div>
  );
});