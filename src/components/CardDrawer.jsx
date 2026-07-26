import { useEffect, useMemo, useState } from 'react';
import { formatDueLabel, getDueStatus, normalizeTags } from '../utils/cardHelpers';
import { styles } from '../styles/kanbanStyles';

export function CardDrawer({
  open,
  lane,
  card,
  lanes,
  onClose,
  onSave,
  onDelete,
  onMove,
}) {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!open || !card) return;
    setText(card.text || '');
    setDescription(card.description || '');
    setTagsText((card.tags || []).join(', '));
    setDueDate(card.dueDate || '');
  }, [open, card]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const dueStatus = useMemo(() => getDueStatus(dueDate), [dueDate]);
  const dueHint = formatDueLabel(dueDate);

  if (!open || !card || !lane) return null;

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(lane.id, card.id, {
      text: trimmed,
      description,
      tags: normalizeTags(tagsText),
      dueDate,
    });
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="卡片详情"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="drawer-kicker">{lane.title}</p>
            <h2 className="drawer-title">卡片详情</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="drawer-body">
          <label style={styles.modalLabel}>标题</label>
          <input
            className="modal-input"
            style={styles.modalInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <label style={styles.modalLabel}>描述</label>
          <textarea
            className="modal-textarea"
            style={{ ...styles.modalTextarea, minHeight: 120 }}
            value={description}
            placeholder="补充任务细节..."
            onChange={(e) => setDescription(e.target.value)}
          />

          <label style={styles.modalLabel}>标签（逗号分隔）</label>
          <input
            className="modal-input"
            style={styles.modalInput}
            value={tagsText}
            placeholder="例如：开发, 紧急"
            onChange={(e) => setTagsText(e.target.value)}
          />

          <label style={styles.modalLabel}>截止日期</label>
          <div className="drawer-due-row">
            <input
              className="modal-input"
              style={{ ...styles.modalInput, marginBottom: 0, flex: 1 }}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && (
              <button
                type="button"
                className="drawer-clear-due"
                onClick={() => setDueDate('')}
              >
                清除
              </button>
            )}
          </div>
          {dueHint && (
            <p className={`due-hint due-hint--${dueStatus}`}>{dueHint}</p>
          )}

          <label style={styles.modalLabel}>移动到列</label>
          <select
            className="drawer-select"
            value={lane.id}
            onChange={(e) => {
              const targetLaneId = e.target.value;
              if (targetLaneId !== lane.id) onMove(lane.id, card.id, targetLaneId);
            }}
          >
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>

        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-danger"
            onClick={() => onDelete(lane.id, card.id, card.text)}
          >
            删除卡片
          </button>
          <div className="drawer-footer-actions">
            <button type="button" style={styles.modalCancelBtn} onClick={onClose}>
              关闭
            </button>
            <button type="button" className="modal-submit" style={styles.modalSubmitBtn} onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
