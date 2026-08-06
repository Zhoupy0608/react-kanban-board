import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsService } from '../services/api';
import { useRealtime } from '../hooks/useRealtime';

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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await notificationsService.list({ limit: 30 });
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    onEvent: (msg) => {
      if (msg?.type === 'notification' || msg?.type === 'connected') {
        load();
      }
    },
  });

  const markAll = async () => {
    await notificationsService.markAllRead();
    await load();
  };

  const onOpenItem = async (n) => {
    if (!n.isRead) {
      await notificationsService.markRead(n.id);
      await load();
    }
    setOpen(false);
  };

  const onDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id || deletingId) return;
    setDeletingId(id);
    try {
      const data = await notificationsService.remove(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      if (typeof data?.unread === 'number') setUnread(data.unread);
      else await load();
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="icon-btn notif-btn"
        data-tooltip="通知"
        aria-label="通知"
        onClick={() => {
          setOpen((v) => !v);
          load();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 17h12l-1.2-2V10a4.8 4.8 0 1 0-9.6 0v5L6 17Z" />
          <path d="M10 17a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 ? <span className="notif-dot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif-dropdown" role="dialog" aria-label="通知列表">
          <div className="notif-dropdown-head">
            <strong>通知</strong>
            <button type="button" className="ghost-btn" onClick={markAll}>
              全部已读
            </button>
          </div>
          <ul className="notif-list">
            {items.length === 0 ? (
              <li className="notif-empty">暂无通知</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={n.isRead ? '' : 'is-unread'}>
                  <div className="notif-item">
                    {n.boardId ? (
                      <Link
                        to={`/boards/${n.boardId}`}
                        onClick={() => onOpenItem(n)}
                      >
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-body">{n.body}</div>
                        <time>{formatTime(n.createdAt)}</time>
                      </Link>
                    ) : (
                      <button type="button" className="notif-static" onClick={() => onOpenItem(n)}>
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-body">{n.body}</div>
                        <time>{formatTime(n.createdAt)}</time>
                      </button>
                    )}
                    <button
                      type="button"
                      className="notif-delete"
                      aria-label="删除通知"
                      title="删除"
                      disabled={deletingId === n.id}
                      onClick={(e) => onDelete(e, n.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
