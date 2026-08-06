import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError, boardsService } from '../services/api';
import { Modal } from '../components/Modal';
import { NotificationBell } from '../components/NotificationBell';

const BOARD_ACCENTS = [
  { bg: '#fef3c7', bar: '#f5c518', ink: '#92400e' },
  { bg: '#ecfdf5', bar: '#34d399', ink: '#065f46' },
  { bg: '#eff6ff', bar: '#60a5fa', ink: '#1e3a8a' },
  { bg: '#fff1f2', bar: '#fb7185', ink: '#9f1239' },
  { bg: '#f5f3ff', bar: '#a78bfa', ink: '#5b21b6' },
];

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </svg>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚更新';
  if (mins < 60) return `${mins} 分钟前更新`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前更新`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前更新`;
  return new Date(iso).toLocaleString('zh-CN');
}

function BoardCard({ board, index, onDelete, onRenamed }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const accent = BOARD_ACCENTS[index % BOARD_ACCENTS.length];

  useEffect(() => {
    setDraft(board.title);
  }, [board.title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(board.title);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(board.title);
    setEditing(false);
  };

  const saveTitle = async () => {
    const next = draft.trim();
    if (!next || next === board.title) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const updated = await boardsService.update(board.id, { title: next });
      onRenamed?.(updated);
      setEditing(false);
    } catch {
      setDraft(board.title);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className="board-card"
      style={{
        '--board-accent': accent.bar,
        '--board-tint': accent.bg,
        '--board-ink': accent.ink,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="board-card-body">
        {editing ? (
          <input
            ref={inputRef}
            className="board-card-title-input"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveTitle();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onBlur={() => {
              void saveTitle();
            }}
          />
        ) : (
          <div className="board-card-title-row">
            <Link to={`/boards/${board.id}`} className="board-card-title">
              {board.title}
            </Link>
            <button
              type="button"
              className="board-card-edit"
              title="重命名"
              aria-label={`重命名「${board.title}」`}
              onClick={startEdit}
            >
              <IconPencil />
            </button>
          </div>
        )}

        <div className="board-card-stats">
          <span>
            <strong>{board.laneCount ?? 0}</strong> 列
          </span>
          <span>
            <strong>{board.cardCount ?? 0}</strong> 任务
          </span>
          {board.role && board.role !== 'owner' ? (
            <span className="board-card-shared">共享 · {board.role === 'viewer' ? '只读' : '可编辑'}</span>
          ) : null}
        </div>

        <Link to={`/boards/${board.id}`} className="board-card-meta">
          <time dateTime={board.updatedAt}>{formatRelative(board.updatedAt)}</time>
        </Link>
      </div>

      <button
        type="button"
        className="board-card-delete"
        onClick={() => onDelete(board.id)}
        hidden={board.role && board.role !== 'owner'}
        style={board.role && board.role !== 'owner' ? { display: 'none' } : undefined}
      >
        删除
      </button>
    </article>
  );
}

export function BoardListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '' });
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await boardsService.list();
      setBoards(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载看板失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const createBoard = async () => {
    const title = dialog.title.trim();
    if (!title) return;
    try {
      const board = await boardsService.create({ title, description: '' });
      setDialog({ open: false, title: '' });
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败');
    }
  };

  const removeBoard = async () => {
    if (!confirmId) return;
    try {
      await boardsService.remove(confirmId);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除失败');
      setConfirmId(null);
    }
  };

  const handleRenamed = (updated) => {
    setBoards((prev) =>
      prev.map((b) =>
        b.id === updated.id
          ? {
              ...b,
              ...updated,
              laneCount: b.laneCount,
              cardCount: b.cardCount,
            }
          : b
      )
    );
  };

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? '早上好' : greetingHour < 18 ? '下午好' : '晚上好';

  return (
    <div className="boards-shell">
      <div className="boards-atmosphere" aria-hidden="true" />

      <header className="boards-topbar">
        <div className="boards-brand">
          <span className="auth-logo">M</span>
          <div>
            <strong>MyKanban</strong>
            <span>全栈任务工作台</span>
          </div>
        </div>
        <div className="boards-user">
          <NotificationBell />
          <span className="user-chip">
            <span className="user-avatar">{(user?.name || 'U').slice(0, 1)}</span>
            {user?.name}
          </span>
          <button type="button" className="ghost-btn" onClick={logout}>
            退出
          </button>
        </div>
      </header>

      <main className="boards-main">
        <section className="boards-hero">
          <div className="boards-hero-copy">
            <p className="boards-kicker">{greeting}，{user?.name || '朋友'}</p>
            <h1>我的看板</h1>
            <p className="boards-lead">
              拖拽排期、多视图切换，数据按账号隔离持久化。选一块看板继续推进。
            </p>
          </div>
          <button
            type="button"
            className="boards-create-btn"
            onClick={() => setDialog({ open: true, title: '' })}
          >
            + 新建看板
          </button>
        </section>

        {error ? <div className="auth-error boards-error">{error}</div> : null}

        {loading ? (
          <div className="board-status">正在加载看板列表…</div>
        ) : boards.length === 0 ? (
          <div className="boards-empty">
            <div className="boards-empty-icon" aria-hidden="true">
              <IconBoard />
            </div>
            <h2>还没有看板</h2>
            <p>创建第一块看板，开始用多视图管理任务。</p>
            <button
              type="button"
              className="boards-create-btn"
              onClick={() => setDialog({ open: true, title: '' })}
            >
              + 新建看板
            </button>
          </div>
        ) : (
          <div className="boards-grid">
            {boards.map((board, index) => (
              <BoardCard
                key={board.id}
                board={board}
                index={index}
                onDelete={setConfirmId}
                onRenamed={handleRenamed}
              />
            ))}
            <button
              type="button"
              className="board-card-ghost"
              onClick={() => setDialog({ open: true, title: '' })}
              aria-label="新建看板"
              title="新建看板"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        )}
      </main>

      <Modal
        open={dialog.open}
        title="新建看板"
        onClose={() => setDialog({ open: false, title: '' })}
        onSubmit={createBoard}
        submitLabel="创建"
      >
        <label className="modal-field-label">标题</label>
        <input
          className="modal-input"
          value={dialog.title}
          placeholder="例如：产品迭代"
          onChange={(e) => setDialog((prev) => ({ ...prev, title: e.target.value }))}
        />
      </Modal>

      <Modal
        open={Boolean(confirmId)}
        title="删除看板"
        onClose={() => setConfirmId(null)}
        onSubmit={removeBoard}
        submitLabel="确定删除"
        cancelLabel="取消"
        danger
      >
        <p className="confirm-message">确定删除该看板及其全部列与卡片？此操作不可撤销。</p>
      </Modal>
    </div>
  );
}
