import React from 'react';
import { Lane } from './components/Lane';
import { useKanban } from './hooks/useKanban';
import { styles } from './styles/kanbanStyles';

export default function App() {
  const { 
    data, addLane, addCard, deleteCard, updateCardText, 
    updateCardDescription, onDragStart, onDrop,
    onLaneDragStart, onLaneDrop, draggedCard
  } = useKanban();

  const onDragOver = (e) => e.preventDefault();

  return (
    <div style={{ 
        display: 'flex', 
        padding: '20px', 
        backgroundColor: '#b0bece', 
        minHeight: '100vh', 
        minWidth: '100vw', 
        gap: '8px' ,
        alignItems: 'flex-start',
        overflowX: 'auto', // 如果列太多，允许横向滚动
      }}>
      {data.map((lane, index) => (
        <Lane
          key={lane.id}
          index={index}
          lane={lane}
          addCard={addCard}
          onDragStart={onDragStart}
          onDrop={onDrop}
          deleteCard={deleteCard}
          updateCardText={updateCardText}
          updateCardDescription={updateCardDescription}
          onLaneDragStart={onLaneDragStart}
          onLaneDrop={onLaneDrop}
          draggedCardId={draggedCard?.cardId}
          onDragOver={onDragOver}
        />
      ))}

      {/* --- 新增：添加列按钮 --- */}
      <div 
          style={styles.addLaneBtn} 
          onClick={addLane}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
          + 添加新列
      </div>
    </div>
  );
}