import { useMemo, useState } from 'react';
import { FancySelect } from './FancySelect';
import { formatDueLabel, getDueStatus } from '../utils/cardHelpers';
import { getLaneAccent } from '../styles/kanbanStyles';

const SORT_OPTIONS = [
  { id: 'dueAsc', label: '截止日期 ↑' },
  { id: 'dueDesc', label: '截止日期 ↓' },
  { id: 'title', label: '标题' },
  { id: 'lane', label: '所属列' },
  { id: 'status', label: '到期状态' },
];

const STATUS_ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3 };

function flattenFiltered(lanes) {
  const rows = [];
  lanes.forEach((lane, laneIndex) => {
    (lane.cards || []).forEach((card) => {
      rows.push({
        ...card,
        laneId: lane.id,
        laneTitle: lane.title,
        laneIndex,
      });
    });
  });
  return rows;
}

function compareDue(a, b, desc = false) {
  const ad = a.dueDate || '';
  const bd = b.dueDate || '';
  if (!ad && !bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  const diff = ad.localeCompare(bd);
  return desc ? -diff : diff;
}

export function ListView({
  lanes,
  allLanes,
  onOpenCard,
  onMoveCard,
  onUpdateDueDate,
  onDeleteCard,
}) {
  const [sortBy, setSortBy] = useState('dueAsc');

  const rows = useMemo(() => {
    const list = flattenFiltered(lanes);
    const sorted = [...list];

    sorted.sort((a, b) => {
      if (sortBy === 'title') return a.text.localeCompare(b.text, 'zh');
      if (sortBy === 'lane') {
        return (
          a.laneIndex - b.laneIndex ||
          a.text.localeCompare(b.text, 'zh')
        );
      }
      if (sortBy === 'status') {
        const sa = STATUS_ORDER[getDueStatus(a.dueDate)];
        const sb = STATUS_ORDER[getDueStatus(b.dueDate)];
        return sa - sb || compareDue(a, b);
      }
      if (sortBy === 'dueDesc') return compareDue(a, b, true);
      return compareDue(a, b, false);
    });

    return sorted;
  }, [lanes, sortBy]);

  const laneOptions = useMemo(
    () =>
      allLanes.map((lane, index) => ({
        id: lane.id,
        label: lane.title,
        dot: getLaneAccent(lane.title, index).dot,
      })),
    [allLanes]
  );

  return (
    <div className="list-view">
      <div className="list-toolbar">
        <label className="list-sort">
          <span>排序</span>
          <FancySelect
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={setSortBy}
            ariaLabel="列表排序"
          />
        </label>
        <span className="filter-meta">共 {rows.length} 条</span>
      </div>

      {rows.length === 0 ? (
        <div className="view-placeholder">
          <h3>暂无任务</h3>
          <p>试试调整筛选条件，或新建一张卡片。</p>
        </div>
      ) : (
        <div className="list-table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>所属列</th>
                <th>标签</th>
                <th>截止日期</th>
                <th>状态</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {rows.map((card) => {
                const status = getDueStatus(card.dueDate);
                const dueLabel = formatDueLabel(card.dueDate) || '未设置';

                return (
                  <tr key={`${card.laneId}-${card.id}`}>
                    <td>
                      <button
                        type="button"
                        className="list-title-btn"
                        onClick={() => onOpenCard(card.laneId, card.id)}
                      >
                        {card.text}
                      </button>
                      {card.description ? (
                        <p className="list-desc">{card.description}</p>
                      ) : null}
                    </td>
                    <td>
                      <div className="list-lane-cell">
                        <FancySelect
                          compact
                          value={card.laneId}
                          options={laneOptions}
                          ariaLabel="所属列"
                          onChange={(toLaneId) => {
                            if (toLaneId !== card.laneId) {
                              onMoveCard(card.laneId, card.id, toLaneId);
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      {(card.tags || []).length === 0 ? (
                        <span className="list-muted">—</span>
                      ) : (
                        <div className="list-tags">
                          {(card.tags || []).map((tag) => (
                            <span key={tag} className="tag-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        className="list-date-input"
                        type="date"
                        value={card.dueDate || ''}
                        onChange={(e) =>
                          onUpdateDueDate(card.laneId, card.id, e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      <span className={`due-badge due-badge--${status}`}>
                        {status === 'none' ? '未排期' : dueLabel}
                      </span>
                    </td>
                    <td className="list-actions">
                      <button
                        type="button"
                        className="list-icon-btn"
                        title="打开详情"
                        onClick={() => onOpenCard(card.laneId, card.id)}
                      >
                        详
                      </button>
                      <button
                        type="button"
                        className="list-icon-btn list-icon-btn--danger"
                        title="删除"
                        onClick={() => onDeleteCard(card.laneId, card.id, card.text)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
