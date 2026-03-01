import React, { useState } from 'react';

// 初始数据：这就是你之前在 react-trello 里找不到的数据源
const initialData = [
  { id: 'lane1', title: '待处理', cards: [{ id: 'c1', text: '学习核心 JS' }] },
  { id: 'lane2', title: '进行中', cards: [{ id: 'c2', text: '手写看板项目' }] }
];

export default function MyKanban() {
  const [data, setData] = useState(initialData);

  // 功能 1：添加卡片 (面试必问的 State 修改)
  const addCard = (laneId) => {
    const text = prompt("请输入任务内容:");
    if (!text) return;
    
    const newData = data.map(lane => {
      if (lane.id === laneId) {
        return { ...lane, cards: [...lane.cards, { id: Date.now().toString(), text }] };
      }
      return lane;
    });
    setData(newData);
  };

  return (
    <div style={{ display: 'flex', padding: '20px', gap: '20px', backgroundColor: '#f4f5f7', minHeight: '100vh' }}>
      {data.map(lane => (
        <div key={lane.id} style={{ background: '#ebecf0', width: '250px', borderRadius: '5px', padding: '10px' }}>
          <h3 style={{ fontSize: '16px' }}>{lane.title}</h3>
          
          {/* 渲染卡片 */}
          {lane.cards.map(card => (
            <div key={card.id} style={{ background: '#fff', padding: '10px', marginBottom: '8px', borderRadius: '3px', boxShadow: '0 1px 0 rgba(9,30,66,.25)' }}>
              {card.text}
            </div>
          ))}

          <button onClick={() => addCard(lane.id)} style={{ width: '100%', padding: '5px', cursor: 'pointer' }}>
            + 添加卡片
          </button>
        </div>
      ))}
    </div>
  );
}