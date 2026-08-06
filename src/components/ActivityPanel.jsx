import { useCallback, useEffect, useState } from 'react';
import { boardsService } from '../services/api';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ActivityPanel({ boardId, open, onClose, refreshKey = 0 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!boardId || !open) return;
    setLoading(true);
    try {
      const list = await boardsService.activity(boardId, 40);
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [boardId, open]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!open) return null;

  return (
    <aside className="activity-panel" aria-label="活动日志">
      <div className="activity-panel-head">
        <h2>活动日志</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="activity-panel-body">
        {loading ? (
          <p className="activity-empty">加载中…</p>
        ) : events.length === 0 ? (
          <p className="activity-empty">暂无活动记录</p>
        ) : (
          <ul className="activity-list">
            {events.map((ev) => (
              <li key={ev.id}>
                <div className="activity-summary">{ev.summary}</div>
                <div className="activity-meta">
                  <span>{ev.userName || '系统'}</span>
                  <time dateTime={ev.createdAt}>{formatTime(ev.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
