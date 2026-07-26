// 相对路径：开发走 Vite 代理，生产与后端同域，不再写死 localhost
const BASE_URL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

async function request(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }
  return response.json();
}

export const boardService = {
  getBoard: async () => {
    try {
      return await request('/board');
    } catch (error) {
      console.error('获取看板数据失败:', error);
      throw error;
    }
  },

  updateBoard: async (newData) => {
    try {
      return await request('/update-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
    } catch (error) {
      console.error('同步数据到后端失败:', error);
      throw error;
    }
  },
};
