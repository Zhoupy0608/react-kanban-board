import { useMemo, useState } from 'react';
import { CardDrawer } from './components/CardDrawer';
import { FilterBar } from './components/FilterBar';
import { Lane } from './components/Lane';
import { Modal } from './components/Modal';
import { Overview } from './components/Overview';
import { ListView } from './components/ListView';
import { CalendarView } from './components/CalendarView';
import { Toast } from './components/Toast';
import { useKanban } from './hooks/useKanban';
import { styles } from './styles/kanbanStyles';
import { cardMatchesDueFilter, normalizeTags } from './utils/cardHelpers';

const EMPTY_DIALOG = {
  type: null,
  laneId: null,
  text: '',
  tagsText: '',
  dueDate: '',
};

function cardMatchesFilters(card, keyword, selectedTags, dueFilter) {
  if (!cardMatchesDueFilter(card, dueFilter)) return false;

  const tags = card.tags || [];
  const q = keyword.trim().toLowerCase();

  if (q) {
    const inText = (card.text || '').toLowerCase().includes(q);
    const inDesc = (card.description || '').toLowerCase().includes(q);
    const inTags = tags.some((tag) => tag.toLowerCase().includes(q));
    if (!inText && !inDesc && !inTags) return false;
  }

  if (selectedTags.length > 0) {
    const hasAny = selectedTags.some((tag) => tags.includes(tag));
    if (!hasAny) return false;
  }

  return true;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconCal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 17h12l-1.2-2V10a4.8 4.8 0 1 0-9.6 0v5L6 17Z" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function App() {
  const {
    data,
    loading,
    loadError,
    syncError,
    clearToast,
    addLane,
    renameLane,
    deleteLane,
    addCard,
    deleteCard,
    updateCard,
    moveCard,
    onDragStart,
    onDragEnd,
    onDrop,
    onLaneDragStart,
    onLaneDrop,
    draggedCard,
  } = useKanban();

  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [confirm, setConfirm] = useState(null);
  const [drawer, setDrawer] = useState({ laneId: null, cardId: null });
  const [keyword, setKeyword] = useState('');
  const [topKeyword, setTopKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedLaneIds, setSelectedLaneIds] = useState([]);
  const [dueFilter, setDueFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeView, setActiveView] = useState('board'); // overview | board | list | calendar

  const searchKeyword = keyword || topKeyword;
  const onDragOver = (e) => e.preventDefault();
  const closeDialog = () => setDialog(EMPTY_DIALOG);
  const closeDrawer = () => setDrawer({ laneId: null, cardId: null });
  const closeConfirm = () => setConfirm(null);

  const requestDeleteCard = (laneId, cardId, text = '') => {
    setConfirm({ kind: 'card', laneId, cardId, text });
  };

  const requestDeleteLane = (laneId, title = '', cardCount = 0) => {
    setConfirm({ kind: 'lane', laneId, title, cardCount });
  };

  const handleConfirmDelete = () => {
    if (!confirm) return;
    if (confirm.kind === 'card') {
      deleteCard(confirm.laneId, confirm.cardId);
      if (drawer.laneId === confirm.laneId && drawer.cardId === confirm.cardId) {
        closeDrawer();
      }
    } else if (confirm.kind === 'lane') {
      deleteLane(confirm.laneId);
    }
    closeConfirm();
  };

  const allTags = useMemo(() => {
    const set = new Set();
    data.forEach((lane) => {
      (lane.cards || []).forEach((card) => {
        (card.tags || []).forEach((tag) => set.add(tag));
      });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
  }, [data]);

  const totalCards = useMemo(
    () => data.reduce((sum, lane) => sum + (lane.cards?.length || 0), 0),
    [data]
  );

  const filteredData = useMemo(() => {
    return data
      .filter((lane) =>
        selectedLaneIds.length === 0 ? true : selectedLaneIds.includes(lane.id)
      )
      .map((lane) => ({
        ...lane,
        cards: (lane.cards || []).filter((card) =>
          cardMatchesFilters(card, searchKeyword, selectedTags, dueFilter)
        ),
      }));
  }, [data, searchKeyword, selectedTags, selectedLaneIds, dueFilter]);

  const resultCount = useMemo(
    () => filteredData.reduce((sum, lane) => sum + lane.cards.length, 0),
    [filteredData]
  );

  const hasActiveFilters =
    Boolean(searchKeyword.trim()) ||
    selectedTags.length > 0 ||
    selectedLaneIds.length > 0 ||
    dueFilter !== 'all';

  const activeLane = data.find((l) => l.id === drawer.laneId) || null;
  const activeCard = activeLane?.cards.find((c) => c.id === drawer.cardId) || null;

  const openAddCard = (laneId, dueDate = '') => {
    setDialog({
      ...EMPTY_DIALOG,
      type: 'addCard',
      laneId: laneId || data[0]?.id || null,
      text: '',
      tagsText: '',
      dueDate: dueDate || '',
    });
  };

  const openAddLane = () => setDialog({ ...EMPTY_DIALOG, type: 'addLane', text: '' });
  const openRenameLane = (laneId, title) => {
    setDialog({ ...EMPTY_DIALOG, type: 'renameLane', laneId, text: title || '' });
  };

  const goBoard = (opts = {}) => {
    if (opts.laneId) setSelectedLaneIds([opts.laneId]);
    if (opts.tag) setSelectedTags([opts.tag]);
    if (opts.dueFilter) setDueFilter(opts.dueFilter);
    if (opts.laneId || opts.tag || opts.dueFilter) setFilterOpen(true);
    setActiveView('board');
  };

  const handleSubmit = () => {
    const { type, laneId, text, tagsText, dueDate } = dialog;

    if (type === 'addCard') {
      if (!text.trim() || !laneId) return;
      addCard(laneId, text, normalizeTags(tagsText), dueDate);
    } else if (type === 'addLane') {
      if (!text.trim()) return;
      addLane(text);
    } else if (type === 'renameLane') {
      if (!text.trim()) return;
      renameLane(laneId, text);
    }

    closeDialog();
  };

  const dialogTitle = {
    addCard: '新建任务',
    addLane: '添加新列',
    renameLane: '重命名列',
  }[dialog.type];

  const toastMessage = syncError || loadError;

  const viewLabel = {
    overview: '概览',
    list: '列表',
    board: '看板',
    calendar: '日历',
  }[activeView];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">M</div>
        <nav className="sidebar-nav" aria-label="主导航">
          <button
            type="button"
            className={`sidebar-btn${activeView === 'overview' ? ' is-active' : ''}`}
            title="概览"
            aria-label="概览"
            onClick={() => setActiveView('overview')}
          >
            <IconHome />
          </button>
          <button
            type="button"
            className={`sidebar-btn${activeView === 'board' ? ' is-active' : ''}`}
            title="看板"
            aria-label="看板"
            onClick={() => setActiveView('board')}
          >
            <IconBoard />
          </button>
          <button
            type="button"
            className={`sidebar-btn${activeView === 'list' ? ' is-active' : ''}`}
            title="列表"
            aria-label="列表"
            onClick={() => setActiveView('list')}
          >
            <IconList />
          </button>
          <button
            type="button"
            className={`sidebar-btn${activeView === 'calendar' ? ' is-active' : ''}`}
            title="日历"
            aria-label="日历"
            onClick={() => setActiveView('calendar')}
          >
            <IconCal />
          </button>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="sidebar-btn" title="设置" aria-label="设置">
            ⚙
          </button>
        </div>
      </aside>

      <div className="main-pane">
        <header className="topbar">
          <label className="topbar-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={topKeyword}
              onChange={(e) => {
                setTopKeyword(e.target.value);
                setKeyword(e.target.value);
              }}
              placeholder="搜索看板..."
            />
            <kbd>⌘K</kbd>
          </label>
          <div className="topbar-right">
            <button type="button" className="icon-btn" aria-label="通知">
              <IconBell />
            </button>
            <div className="user-chip">
              <span className="user-avatar">M</span>
              MyKanban
            </div>
          </div>
        </header>

        <div className="content-scroll">
          <div className="project-header">
            <div>
              <h1 className="project-title">MyKanban Board</h1>
              <div className="project-meta">
                <span>
                  列数 <strong>{data.length}</strong>
                </span>
                <span>
                  任务 <strong>{totalCards}</strong>
                </span>
                <span className="page-pill" aria-label={`当前页面：${viewLabel}`}>
                  {viewLabel}
                </span>
              </div>
            </div>
            <div className="project-actions">
              <button type="button" className="ghost-btn" onClick={openAddLane}>
                + 新列
              </button>
            </div>
          </div>

          {activeView === 'board' || activeView === 'list' || activeView === 'calendar' ? (
            <FilterBar
              keyword={keyword}
              onKeywordChange={(v) => {
                setKeyword(v);
                setTopKeyword(v);
              }}
              allTags={allTags}
              selectedTags={selectedTags}
              onToggleTag={(tag) =>
                setSelectedTags((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                )
              }
              lanes={data}
              selectedLaneIds={selectedLaneIds}
              onToggleLane={(laneId) =>
                setSelectedLaneIds((prev) =>
                  prev.includes(laneId) ? prev.filter((id) => id !== laneId) : [...prev, laneId]
                )
              }
              dueFilter={dueFilter}
              onDueFilterChange={setDueFilter}
              onClear={() => {
                setKeyword('');
                setTopKeyword('');
                setSelectedTags([]);
                setSelectedLaneIds([]);
                setDueFilter('all');
              }}
              hasActiveFilters={hasActiveFilters}
              resultCount={resultCount}
              filterOpen={{
                open: filterOpen,
                onToggle: () => setFilterOpen((v) => !v),
              }}
              onAddTask={() => openAddCard(data[0]?.id)}
            />
          ) : null}

          {loading ? (
            <div className="board-status">正在加载看板...</div>
          ) : activeView === 'overview' ? (
            <Overview
              lanes={data}
              onOpenCard={(laneId, cardId) => setDrawer({ laneId, cardId })}
              onGoBoard={goBoard}
            />
          ) : activeView === 'board' ? (
            <div className="board-row" style={styles.boardRow}>
              {filteredData.map((lane, index) => {
                const realIndex = data.findIndex((l) => l.id === lane.id);
                return (
                  <Lane
                    key={lane.id}
                    index={realIndex >= 0 ? realIndex : index}
                    lane={lane}
                    addCard={openAddCard}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    deleteCard={requestDeleteCard}
                    onOpenCard={(laneId, cardId) => setDrawer({ laneId, cardId })}
                    onRenameLane={openRenameLane}
                    onDeleteLane={requestDeleteLane}
                    onLaneDragStart={onLaneDragStart}
                    onLaneDrop={onLaneDrop}
                    draggedCardId={draggedCard?.cardId}
                    onDragOver={onDragOver}
                  />
                );
              })}

              <div
                className="add-lane-btn"
                onClick={openAddLane}
                onKeyDown={(e) => e.key === 'Enter' && openAddLane()}
                role="button"
                tabIndex={0}
              >
                + 添加新列
              </div>
            </div>
          ) : activeView === 'list' ? (
            <ListView
              lanes={filteredData}
              allLanes={data}
              onOpenCard={(laneId, cardId) => setDrawer({ laneId, cardId })}
              onMoveCard={moveCard}
              onUpdateDueDate={(laneId, cardId, dueDate) =>
                updateCard(laneId, cardId, { dueDate })
              }
              onDeleteCard={requestDeleteCard}
            />
          ) : (
            <CalendarView
              lanes={filteredData}
              onOpenCard={(laneId, cardId) => setDrawer({ laneId, cardId })}
              onAddCard={(isoDate) => openAddCard(data[0]?.id, isoDate)}
              onUpdateDueDate={(laneId, cardId, dueDate) =>
                updateCard(laneId, cardId, { dueDate })
              }
            />
          )}
        </div>
      </div>

      <Modal
        open={Boolean(dialog.type)}
        title={dialogTitle}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        submitLabel={dialog.type === 'renameLane' ? '保存' : '添加'}
      >
        {(dialog.type === 'addCard' || dialog.type === 'addLane' || dialog.type === 'renameLane') && (
          <>
            <label style={styles.modalLabel}>
              {dialog.type === 'addCard' ? '标题' : '列名称'}
            </label>
            <input
              className="modal-input"
              style={styles.modalInput}
              value={dialog.text}
              placeholder={dialog.type === 'addCard' ? '请输入标题' : '例如：待处理'}
              onChange={(e) => setDialog((prev) => ({ ...prev, text: e.target.value }))}
            />
          </>
        )}

        {dialog.type === 'addCard' && (
          <>
            {data.length > 1 && (
              <>
                <label style={styles.modalLabel}>所属列</label>
                <select
                  className="drawer-select"
                  value={dialog.laneId || ''}
                  onChange={(e) => setDialog((prev) => ({ ...prev, laneId: e.target.value }))}
                >
                  {data.map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label style={styles.modalLabel}>标签（逗号分隔，可选）</label>
            <input
              className="modal-input"
              style={styles.modalInput}
              value={dialog.tagsText}
              placeholder="例如：紧急, 开发"
              onChange={(e) => setDialog((prev) => ({ ...prev, tagsText: e.target.value }))}
            />
            <label style={styles.modalLabel}>截止日期（可选）</label>
            <input
              className="modal-input"
              style={styles.modalInput}
              type="date"
              value={dialog.dueDate}
              onChange={(e) => setDialog((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </>
        )}
      </Modal>

      <CardDrawer
        open={Boolean(activeCard)}
        lane={activeLane}
        card={activeCard}
        lanes={data}
        onClose={closeDrawer}
        onSave={(laneId, cardId, patch) => {
          updateCard(laneId, cardId, patch);
          closeDrawer();
        }}
        onDelete={requestDeleteCard}
        onMove={(fromLaneId, cardId, toLaneId) => {
          moveCard(fromLaneId, cardId, toLaneId);
          setDrawer({ laneId: toLaneId, cardId });
        }}
      />

      <Modal
        open={Boolean(confirm)}
        title={confirm?.kind === 'lane' ? '删除列' : '删除卡片'}
        onClose={closeConfirm}
        onSubmit={handleConfirmDelete}
        submitLabel="确定"
        cancelLabel="取消"
        danger
      >
        <p className="confirm-message">
          {confirm?.kind === 'lane' ? (
            confirm.cardCount > 0 ? (
              <>
                确定删除列 <strong>「{confirm.title}」</strong> 及其{' '}
                <strong>{confirm.cardCount}</strong> 张卡片吗？此操作不可撤销。
              </>
            ) : (
              <>
                确定删除列 <strong>「{confirm.title}」</strong> 吗？此操作不可撤销。
              </>
            )
          ) : (
            <>
              确定删除卡片
              {confirm?.text ? (
                <>
                  {' '}
                  <strong>「{confirm.text}」</strong>
                </>
              ) : null}
              吗？此操作不可撤销。
            </>
          )}
        </p>
      </Modal>

      <Toast message={toastMessage} tone={syncError ? 'error' : 'warn'} onClose={clearToast} />
    </div>
  );
}
