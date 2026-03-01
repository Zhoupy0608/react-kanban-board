export const styles = {
  lane:{
    background: '#e2e4e7', // 浅灰色背景
    width: '360px',
    borderRadius: '8px',
    padding: '12px',
    marginRight: '8px',
    boxShadow: '0 2px 4px rgba(179, 168, 168, 0.05)',
    display: 'flex',
    height: 'fit-content',
    flexDirection: 'column',
    maxHeight: '85vh',
    alignSelf: 'flex-start',
  },
  card: {
    minHeight: '60px',
    background: '#fefeff',
    padding: '16px',
    marginBottom: '18px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'grab',
    transition: 'all 0.2s ease', // 增加平滑过渡
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    fontSize: '14px',
    color: '#172b4d',
    overflow: 'hidden', // 确保圆角处不会溢出
  },
  addButton: {
    width: '100%',
    padding: '8px',
    marginTop: '4px',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#5e6c84',
    textAlign: 'left',
    fontSize: '14px',
    transition: 'background 0.2s',
  },
  addLaneBtn: {
    minWidth: '280px',
    height: '50px',
    background: 'rgba(255, 255, 255, 0.2)', // 半透明白
    border: '2px dashed #ffffff',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#ffffff',
    fontWeight: 'bold',
    transition: 'background 0.2s',
  },
  deleteBtn: {
    fontSize: '20px', 
    flexShrink: 0, // 强制按钮不被压缩，永远保持原有大小
    border: 'none',
    background: 'none',
    color: '#2b1a4e',
    cursor: 'pointer',
    opacity: 0.6,
    padding: '0 6px',
    borderRadius: '4px',
  }
}