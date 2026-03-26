// 封装API调用
const BASE_URL = 'http://localhost:5000/api';

export const boardService = {
//   // 获取数据
//   getBoard: () => fetch(`${BASE_URL}/board`).then(res => res.json()),
  
//   // 保存更新
//   updateBoard: (newData) => fetch(`${BASE_URL}/update-board`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(newData)
//   }).then(res => res.json())

  getBoard: async () => { // 获取数据
    try {
      const response = await fetch(`${BASE_URL}/board`);
      
      // 检查网络响应是否正常
      if (!response.ok) {
        throw new Error(`网络响应异常: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("获取看板数据失败:", error);
      throw error; // 抛出错误，让调用它的组件也能感知到
    }
  },

  // 保存更新
  updateBoard: async (newData) => {
    try {
      const response = await fetch(`${BASE_URL}/update-board`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      });

      if (!response.ok) {
        throw new Error(`更新失败: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("同步数据到后端失败:", error);
      throw error;
    }
  }
};