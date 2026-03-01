# React Kanban Board (高性能看板组件)

一个基于 React 构建的模块化看板系统。采用 **Hooks + Components + Styles** 架构实现，支持双维度原生拖拽、内联编辑及高度自适应布局。

---

## 🚀 核心特性

* **响应式且高度可扩展**：可以轻松插入现有的 React 应用中。
* **双向拖拽**：支持卡片在通道间移动，以及通道（Lane）本身的左右排序。
* **高度自适应**：通道高度随卡片数量自动伸缩，支持内部独立分页滚动。
* **即时编辑**：支持内联编辑卡片内容及通道标题，无需弹窗。
* **自定义元素**：支持自定义元素用于定义通道和卡片外观。
* **事件总线**：触发外部事件（例如：根据来自后端的事件添加或移除卡片）。

---

## ⚙️ 技术文档 (Documentation)

### 1. 必填参数 (Required Parameters)
| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `data` | `Array` | 看板核心数据，包含通道 ID、标题及卡片列表。 |
| `onDragStart` | `Function` | 开始拖动卡片时的回调函数。 |
| `onDrop` | `Function` | 放下卡片并更新数据逻辑的回调。 |

### 2. 可选配置 (Optionable Flags)
| 参数名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `draggable` | `Boolean` | `true` | 是否允许拖拽卡片和通道。 |
| `isEditable` | `Boolean` | `true` | 是否开启内联点击编辑功能。 |
| `draggedCardId` | `String` | `null` | 当前被拖拽卡片的 ID（用于样式反馈）。 |

### 3. 通道专属属性 (Lane Specific Props)
| 属性名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `lane.id` | `String` | 通道的唯一标识符。 |
| `lane.title` | `String` | 通道的标题。 |
| `lane.cards` | `Array` | 属于该通道的卡片对象数组。 |

### 4. 其他功能函数 (Other Functions)
| 函数名 | 说明 | 触发方式 |
| :--- | :--- | :--- |
| `addLane` | 动态添加新列 | 点击页面右侧“添加新列”占位块 |
| `addCard` | 在指定列添加卡片 | 点击通道下方的“+ 添加卡片”按钮 |
| `deleteCard` | 删除指定任务 | 点击卡片右上角的删除图标 |

---

## 🎨 样式自定义 (Style Customization)

你可以通过修改 `src/styles/kanbanStyles.js` 来快速调整视觉风格：

* **通道宽度**：修改 `lane.width` (默认 `280px`)。
* **最大高度**：修改 `lane.maxHeight` (默认 `85vh`) 实现屏幕适配。
* **配色方案**：
    * 通道背景：`#e5eaf3`
    * 卡片背景：`#f8f9fc`
    * 页面背景：`#b0bece`

---

## 🛠️ 快速上手

1. **安装依赖**:
   ```bash
   npm install
2. **启动项目**:

    ```bash
    npm run dev
3. **生产构建**:
    ```bash
    npm run build

---

## 📂 目录结构

```text
src/
├── components/       # UI 组件 (Lane.jsx)
├── hooks/            # 业务逻辑 (useKanban.js)
├── styles/           # 样式定义 (kanbanStyles.js)
├── App.jsx           # 页面入口与组装
└── main.jsx          # React 挂载点