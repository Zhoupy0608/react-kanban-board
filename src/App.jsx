import { useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { Lane } from './components/Lane';
import { Modal } from './components/Modal';
import { useKanban } from './hooks/useKanban';
import { styles } from './styles/kanbanStyles';

const EMPTY_DIALOG = {
  type: null,
  laneId: null,
  cardId: null,
  text: '',
  description: '',
  tagsText: '',
};

function parseTagsText(tagsText) {
  return [...new Set(
    String(tagsText || '')
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
  )];
}

function cardMatchesFilters(card, keyword, selectedTags) {
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

export default function App() {
  const {
    data,
    addLane,
    addCard,
    deleteCard,
    updateCardText,
    updateCardDescription,
    updateCardTags,
    onDragStart,
    onDrop,
    onLaneDragStart,
    onLaneDrop,
    draggedCard,
  } = useKanban();

  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [keyword, setKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedLaneIds, setSelectedLaneIds] = useState([]);

  const onDragOver = (e) => e.preventDefault();
  const closeDialog = () => setDialog(EMPTY_DIALOG);

  const allTags = useMemo(() => {
    const set = new Set();
    data.forEach((lane) => {
      (lane.cards || []).forEach((card) => {
        (card.tags || []).forEach((tag) => set.add(tag));
      });
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
  }, [data]);

  const filteredData = useMemo(() => {
    return data
      .filter((lane) =>
        selectedLaneIds.length === 0 ? true : selectedLaneIds.includes(lane.id)
      )
      .map((lane) => ({
        ...lane,
        cards: (lane.cards || []).filter((card) =>
          cardMatchesFilters(card, keyword, selectedTags)
        ),
      }));
  }, [data, keyword, selectedTags, selectedLaneIds]);

  const resultCount = useMemo(
    () => filteredData.reduce((sum, lane) => sum + lane.cards.length, 0),
    [filteredData]
  );

  const hasActiveFilters =
    Boolean(keyword.trim()) || selectedTags.length > 0 || selectedLaneIds.length > 0;

  const openAddCard = (laneId) => {
    setDialog({ ...EMPTY_DIALOG, type: 'addCard', laneId, text: '', tagsText: '' });
  };

  const openEditText = (laneId, cardId, text) => {
    setDialog({ ...EMPTY_DIALOG, type: 'editText', laneId, cardId, text: text || '' });
  };

  const openEditDescription = (laneId, cardId, description) => {
    setDialog({
      ...EMPTY_DIALOG,
      type: 'editDescription',
      laneId,
      cardId,
      description: description || '',
    });
  };

  const openEditTags = (laneId, cardId, tags = []) => {
    setDialog({
      ...EMPTY_DIALOG,
      type: 'editTags',
      laneId,
      cardId,
      tagsText: (tags || []).join(', '),
    });
  };

  const openAddLane = () => {
    setDialog({ ...EMPTY_DIALOG, type: 'addLane', text: '' });
  };

  const handleSubmit = () => {
    const { type, laneId, cardId, text, description, tagsText } = dialog;

    if (type === 'addCard') {
      if (!text.trim()) return;
      addCard(laneId, text, parseTagsText(tagsText));
    } else if (type === 'editText') {
      if (!text.trim()) return;
      updateCardText(laneId, cardId, text);
    } else if (type === 'editDescription') {
      updateCardDescription(laneId, cardId, description);
    } else if (type === 'editTags') {
      updateCardTags(laneId, cardId, parseTagsText(tagsText));
    } else if (type === 'addLane') {
      if (!text.trim()) return;
      addLane(text);
    }

    closeDialog();
  };

  const dialogTitle = {
    addCard: '添加卡片',
    editText: '修改标题',
    editDescription: '修改描述',
    editTags: '修改标签',
    addLane: '添加新列',
  }[dialog.type];

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleLane = (laneId) => {
    setSelectedLaneIds((prev) =>
      prev.includes(laneId) ? prev.filter((id) => id !== laneId) : [...prev, laneId]
    );
  };

  return (
    <div style={styles.appShell}>
      <FilterBar
        keyword={keyword}
        onKeywordChange={setKeyword}
        allTags={allTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        lanes={data}
        selectedLaneIds={selectedLaneIds}
        onToggleLane={toggleLane}
        onClear={() => {
          setKeyword('');
          setSelectedTags([]);
          setSelectedLaneIds([]);
        }}
        hasActiveFilters={hasActiveFilters}
        resultCount={resultCount}
      />

      <div style={styles.boardRow}>
        {filteredData.map((lane, index) => {
          // 拖拽列顺序必须对应原始 data 的真实 index
          const realIndex = data.findIndex((l) => l.id === lane.id);
          return (
            <Lane
              key={lane.id}
              index={realIndex >= 0 ? realIndex : index}
              lane={lane}
              addCard={openAddCard}
              onDragStart={onDragStart}
              onDrop={onDrop}
              deleteCard={deleteCard}
              updateCardText={openEditText}
              updateCardDescription={openEditDescription}
              updateCardTags={openEditTags}
              onLaneDragStart={onLaneDragStart}
              onLaneDrop={onLaneDrop}
              draggedCardId={draggedCard?.cardId}
              onDragOver={onDragOver}
            />
          );
        })}

        <div
          style={styles.addLaneBtn}
          onClick={openAddLane}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
        >
          + 添加新列
        </div>
      </div>

      <Modal
        open={Boolean(dialog.type)}
        title={dialogTitle}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        submitLabel={dialog.type?.startsWith('add') ? '添加' : '保存'}
      >
        {(dialog.type === 'addCard' || dialog.type === 'editText' || dialog.type === 'addLane') && (
          <>
            <label style={styles.modalLabel}>
              {dialog.type === 'addLane' ? '列名称' : '标题'}
            </label>
            <input
              style={styles.modalInput}
              value={dialog.text}
              placeholder={dialog.type === 'addLane' ? '例如：待处理' : '请输入标题'}
              onChange={(e) => setDialog((prev) => ({ ...prev, text: e.target.value }))}
            />
          </>
        )}

        {dialog.type === 'addCard' && (
          <>
            <label style={styles.modalLabel}>标签（逗号分隔，可选）</label>
            <input
              style={styles.modalInput}
              value={dialog.tagsText}
              placeholder="例如：开发, 紧急"
              onChange={(e) => setDialog((prev) => ({ ...prev, tagsText: e.target.value }))}
            />
          </>
        )}

        {dialog.type === 'editDescription' && (
          <>
            <label style={styles.modalLabel}>描述</label>
            <textarea
              style={styles.modalTextarea}
              value={dialog.description}
              placeholder="请输入描述"
              onChange={(e) =>
                setDialog((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </>
        )}

        {dialog.type === 'editTags' && (
          <>
            <label style={styles.modalLabel}>标签（逗号分隔）</label>
            <input
              style={styles.modalInput}
              value={dialog.tagsText}
              placeholder="例如：开发, 紧急"
              onChange={(e) => setDialog((prev) => ({ ...prev, tagsText: e.target.value }))}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
