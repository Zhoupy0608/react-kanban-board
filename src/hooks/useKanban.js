import { useState, useCallback, useEffect } from 'react';
import { boardService } from '../services/api'; // 引入创建的 api 服务

// const initialData = [
//   { id: 'lane1', title: '待处理', cards: [{ id: 'c1', text: '清洁', description: '用肥皂洗和抛光地板，窗户和门都擦得像抛光，把所有破碎的玻璃都扔掉' }, { id: 'c2', text: '买面包', description: '超市里有新鲜面包' }, { id: 'c3', text: '买水果', description: '苹果和香蕉' }] },
//   { id: 'lane2', title: '进行中', cards: [{ id: 'c4', text: '写博客', description: '人工智能能制作表情包吗' }, { id: 'c5', text: '付房租', description: '转账到银行账户' }] },
//   { id: 'lane3', title: '已完成', cards: [{ id: 'c6', text: '买牛奶', description: '熟食店里有2加仑牛奶' }] },
//   { id: 'lane4', title: '新任务', cards: [] }
// ];

export function useKanban() {
  // const [data, setData] = useState(initialData); 326
  const [data, setData] = useState([]); // 初始数据设为空，等待后端数据
  const [draggedCard, setDraggedCard] = useState(null);// 记录被拖动的卡片信息 {laneId, cardId}
  const [draggedLaneIdx, setdraggedLaneIdx] = useState(null);// 记录被拖动的列索引

  // 只在初始渲染时执行一次 326
  useEffect(() => {
    // boardService.getBoard()
    //   .then(resData => {
    //     setData(resData);
    //   })
    //   .catch(err => console.error("获取数据失败:", err));
    const initData = async () => {
    try {
      const resData = await boardService.getBoard();
      setData(resData);
    } catch (err) {
      console.log("初始化失败，请检查后端服务是否启动");
    }
  };
  
  initData();
  }, []);

  // 封装一个通用的同步函数 326
  const persistData = (newData) => {
    setData(newData);// 更新本地状态
    boardService.updateBoard(newData); //发送给后端
  };

  // 功能 1：添加卡片
  const addCard = useCallback((laneId) => {
    const text = prompt("请输入任务内容:");
    if (!text) return;   
    // setData(prev => prev.map(lane => 
    //   lane.id === laneId ? { ...lane, cards: [...lane.cards, { id: Date.now().toString(), text }] } : lane
    // ));
    const newData = data.map(lane => 
      lane.id === laneId ? { ...lane, cards: [...lane.cards, { id: Date.now().toString(), text }] } : lane
    );
    persistData(newData); // 同步到本地和后端
  }, [data]); // 依赖于 data

  // 功能 2：删除卡片 
  const deleteCard = useCallback((laneId, cardId) => {
    const newData = data.map(lane => 
      lane.id === laneId ? { ...lane, cards: lane.cards.filter(c => c.id !== cardId) } : lane
    );
    persistData(newData);
  }, [data]);// 依赖于 data

  // 功能 3：拖拽卡片 
  // A. 当开始拖拽时：记录身份
  const onDragStart = useCallback((laneId, cardId) => {
    setDraggedCard({ laneId, cardId });
  }, []);

  // B. 当拖拽经过某一列时：必须阻止默认行为，否则 drop 不会触发
  const onDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // C. 当松开鼠标放下时：执行数据搬运 如果 targetCardId 为空，就默认放末尾
  const onDrop = useCallback((targetLaneId, targetCardId = null) => {
    if (!draggedCard) return;

    const { laneId: sourceLaneId, cardId } = draggedCard;
    
    // // 这里使用函数式更新，确保拿到最新的 data 且不依赖外部变量
    // setData(prev => {
    //   const {laneId: sourceLaneId, cardId} = draggedCard;

    //   // 1. 找到该卡片的数据对象
    //   const sourceLane = prev.find(lane => lane.id === sourceLaneId);
    //   const cardToMove = sourceLane.cards.find(card => card.id === cardId);

    //   // 2. 产生新数据：从来源列删除，向目标列添加
    //   return prev.map(lane => {
    //     // 每一列都要先剔除掉正在移动的那张卡片（防止重复或丢失）
    //     let newCards = lane.cards.filter(cards => cards.id !== cardId); // 先不返回

    //     // 向目标列插入卡片
    //     if(lane.id === targetLaneId){
    //       if(targetCardId){
    //         // 找到目标卡片的索引
    //         const targetIndex = newCards.findIndex(card => card.id === targetCardId);
    //         // 在目标位置插入
    //         newCards.splice(targetIndex, 0, cardToMove);
    //       }else{
    //       // 如果没传目标 ID，直接放末尾
    //         newCards.push(cardToMove);
    //       }
    //     }
    //     return{...lane, cards: newCards};
    //   });
    // });
    
    const newData = data.map(lane => { // 计算数据
      // 过滤掉被移动的卡片
      let newCards = lane.cards.filter(c => c.id !== cardId);

      // 如果是目标列，把卡片塞进去
      if (lane.id === targetLaneId) {
        const sourceLane = data.find(l => l.id === sourceLaneId);
        const cardToMove = sourceLane.cards.find(c => c.id === cardId);

        if (targetCardId) {
          const targetIndex = newCards.findIndex(c => c.id === targetCardId);
          newCards.splice(targetIndex, 0, cardToMove);
        } else {
          newCards.push(cardToMove);
        }
      }
      return { ...lane, cards: newCards };
    });

    //同步
    persistData(newData);
    setDraggedCard(null); // 清空临时状态
  }, [draggedCard, data]); // 依赖于拖动的卡片信息和数据

  // 功能 4：单独修改标题
const updateCardText = useCallback((laneId, cardId, oldText) => {
  const newText = prompt('修改任务标题：', oldText);
  if (newText === null || newText === oldText) return; // 取消或没改则跳过

  // setData(prev => prev.map(lane => 
  //   lane.id === laneId ? {
  //     ...lane,
  //     cards: lane.cards.map(card => card.id === cardId ? { ...card, text: newText } : card)
  //   } : lane
  // ));
  const newData = data.map(lane => 
    lane.id === laneId ? {
      ...lane,
      cards: lane.cards.map(card => card.id === cardId ? { ...card, text: newText } : card)
    } : lane
  );
  persistData(newData);
}, [data]);

// 功能 5：单独修改描述
const updateCardDescription = useCallback((laneId, cardId, oldDesc) => {
  const newDesc = prompt('修改任务描述：', oldDesc || '');
  if (newDesc === null || newDesc === oldDesc) return;

  // setData(prev => prev.map(lane => 
  //   lane.id === laneId ? {
  //     ...lane,
  //     cards: lane.cards.map(card => card.id === cardId ? { ...card, description: newDesc } : card)
  //   } : lane
  // ));
  const newData = data.map(lane => 
    lane.id === laneId ? {
      ...lane,
      cards: lane.cards.map(card => card.id === cardId ? { ...card, description: newDesc } : card)
    } : lane
  );
  persistData(newData);
}, [data]);


  // 功能 6：列交换
  // A. 当开始拖拽列时：记录被拖动的列索引
  const onLaneDragStart = (index) => {
    setdraggedLaneIdx(index);
  };
  // B. 鼠标放下时
  const onLaneDrop = (targetIndex) => {
    if(draggedLaneIdx === null || draggedLaneIdx === targetIndex) return;

    const newData = [...data];
    const movedLane = newData.splice(draggedLaneIdx, 1)[0]; // 取出被拖动的列
    newData.splice(targetIndex, 0, movedLane);

    persistData(newData);
    setdraggedLaneIdx(null);
  };

  // 功能 7：新增列
  const addLane = useCallback(() => {
    const title = prompt("请输入新列的名称:");
    if (!title) return;

    const newLane = {
        id: `lane-${Date.now()}`, // 使用时间戳生成唯一ID
        title: title,
        cards: []
    };
    //setData(prev => [...prev, newLane]);
    persistData([...data, newLane]);
  }, [data]);

    return {
        data,
        draggedCard,
        addCard,
        addLane,
        deleteCard,
        updateCardText,
        updateCardDescription,
        onDragStart: (laneId, cardId) => setDraggedCard({ laneId, cardId }),
        // ... 返回所有 App 需要用的方法
        onDragOver: (e) => e.preventDefault(),
        onDrop: (targetLaneId, targetCardId = null) => {
            if (!draggedCard) return;
            onDrop(targetLaneId, targetCardId);
        },
        onLaneDragStart: (index) => setdraggedLaneIdx(index),
        onLaneDrop: (targetIndex) => onLaneDrop(targetIndex)
    };
}

//   return (
//     <div style={{ display: 'flex', padding: '20px', gap: '20px', backgroundColor: '#afbdcc', minHeight: '100vh', minWidth: '100vw' }}>
//       {data.map((lane, index) => (
//         <Lane
//           key={lane.id}
//           index={index}
//           lane={lane}
//           addCard={addCard}
//           onDragStart={onDragStart}
//           onLaneDragStart={onLaneDragStart}
//           onLaneDrop={onLaneDrop}
//           draggedLaneIdx={draggedLaneIdx}
//           onDragOver={onDragOver}
//           onDrop={onDrop}
//           deleteCard={deleteCard}
//           draggedCardId={draggedCard?.cardId}
//           updateCardText={updateCardText}
//           updateCardDescription={updateCardDescription}
//         />
//       ))}
//     </div>
//   );