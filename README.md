# React Kanban Board

一个功能完备、高度可扩展且支持双维度拖拽的 React 看板应用。

## 🚀 关键功能与项目特色
* **响应式且高度可扩展**：采用 Hooks + Components + Styles 分离的模块化架构，易于快速集成。
* **原生双维度拖拽**：实现卡片跨通道移动、通道内排序，以及通道（Lane）本身的左右排序。
* **精细化内联编辑**：支持卡片标题与描述的独立点击编辑，并带有悬停修改提示。
* **智能自适应布局**：高度随内容动态伸缩，长文本自动折行（防止溢出），支持通道内独立滚动。
* **性能优化**：核心组件使用 `React.memo` 配合 `useCallback` 钩子，确保极致的渲染性能。

## ⚙️ 技术参数 (Documentation)

### Callbacks and Handlers
| 函数名 | 触发时机 |
| :--- | :--- |
| addCard | 点击通道底部“添加卡片”按钮时触发 |
| addLane | 点击末尾“添加新列”虚线框时触发 |
| updateCardText | 点击卡片标题部分时触发 |
| updateCardDescription | 点击卡片描述部分时触发 |
| deleteCard | 点击卡片右侧“删除”按钮时触发 |

## 🛠️ 安装与启动

1. **克隆项目**:
   ```bash
   git clone [你的仓库地址]