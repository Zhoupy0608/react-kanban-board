import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError, boardsService, draftsService } from '../services/api';
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

function IconDraft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}

function IconPublish() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 19V5M12 5l-5 5M12 5l5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DraftCard({ draft, onEdit, onPublish, onDelete, busyId }) {
  const busy = busyId === draft.id;
  return (
    <article className="draft-card">
      <div className="draft-card-body">
        <div className="draft-card-top">
          <span className="draft-badge">草稿</span>
          <time dateTime={draft.updatedAt}>{formatRelative(draft.updatedAt)}</time>
        </div>
        <h3 className="draft-card-title">{draft.title}</h3>
        {draft.description ? (
          <p className="draft-card-desc">{draft.description}</p>
        ) : (
          <p className="draft-card-desc is-empty">暂无描述</p>
        )}
      </div>
      <div className="draft-card-actions">
        <button
          type="button"
          className="draft-icon-btn"
          disabled={busy}
          title="编辑"
          aria-label="编辑草稿"
          onClick={() => onEdit(draft)}
        >
          <IconPencil />
        </button>
        <button
          type="button"
          className="draft-icon-btn draft-icon-btn--publish"
          disabled={busy}
          title={busy ? '处理中…' : '发布为看板'}
          aria-label={busy ? '正在发布' : '发布为看板'}
          onClick={() => onPublish(draft.id)}
        >
          <IconPublish />
        </button>
        <button
          type="button"
          className="draft-icon-btn draft-icon-btn--danger"
          disabled={busy}
          title="删除"
          aria-label="删除草稿"
          onClick={() => onDelete(draft.id)}
        >
          <IconTrash />
        </button>
      </div>
    </article>
  );
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
      className={`board-card${editing ? ' is-editing' : ''}`}
      style={{
        '--board-accent': accent.bar,
        '--board-tint': accent.bg,
        '--board-ink': accent.ink,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {!editing ? (
        <Link
          to={`/boards/${board.id}`}
          className="board-card-hit"
          aria-label={`打开看板「${board.title}」`}
        />
      ) : null}

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
            <h2 className="board-card-title">{board.title}</h2>
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

        <div className="board-card-meta">
          <time dateTime={board.updatedAt}>{formatRelative(board.updatedAt)}</time>
        </div>
      </div>

      <button
        type="button"
        className="board-card-delete"
        title="删除"
        aria-label={`删除看板「${board.title}」`}
        onClick={() => onDelete(board.id)}
        hidden={board.role && board.role !== 'owner'}
        style={board.role && board.role !== 'owner' ? { display: 'none' } : undefined}
      >
        <IconTrash />
      </button>
    </article>
  );
}

export function BoardListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '' });
  const [draftDialog, setDraftDialog] = useState({
    open: false,
    id: null,
    title: '',
    description: '',
  });
  const [confirmId, setConfirmId] = useState(null);
  const [confirmDraftId, setConfirmDraftId] = useState(null);
  const [draftBusyId, setDraftBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [boardsResult, draftsResult] = await Promise.allSettled([
        boardsService.list(),
        draftsService.list(),
      ]);

      if (boardsResult.status === 'fulfilled') {
        setBoards(boardsResult.value);
      } else {
        setBoards([]);
        throw boardsResult.reason;
      }

      if (draftsResult.status === 'fulfilled') {
        setDrafts(draftsResult.value);
      } else {
        setDrafts([]);
        const draftErr = draftsResult.reason;
        const draftMsg =
          draftErr instanceof ApiError ? draftErr.message : '加载草稿失败';
        setError((prev) => prev || `草稿箱暂不可用：${draftMsg}`);
      }
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

  const saveDraft = async () => {
    const title = draftDialog.title.trim();
    if (!title) return;
    try {
      if (draftDialog.id) {
        const updated = await draftsService.update(draftDialog.id, {
          title,
          description: draftDialog.description,
        });
        setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await draftsService.create({
          title,
          description: draftDialog.description,
        });
        setDrafts((prev) => [created, ...prev]);
      }
      setDraftDialog({ open: false, id: null, title: '', description: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存草稿失败');
    }
  };

  const publishDraft = async (id) => {
    setDraftBusyId(id);
    setError('');
    try {
      const board = await draftsService.publish(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setBoards((prev) => [
        {
          ...board,
          role: 'owner',
          laneCount: board.laneCount ?? 3,
          cardCount: board.cardCount ?? 0,
        },
        ...prev,
      ]);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发布草稿失败');
    } finally {
      setDraftBusyId(null);
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

  const removeDraft = async () => {
    if (!confirmDraftId) return;
    try {
      await draftsService.remove(confirmDraftId);
      setDrafts((prev) => prev.filter((d) => d.id !== confirmDraftId));
      setConfirmDraftId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除草稿失败');
      setConfirmDraftId(null);
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
          <Link
            to="/profile"
            className="user-chip"
            title={user?.email || '个人页'}
            aria-label="打开个人页"
          >
            <span className="user-avatar">{(user?.name || 'U').slice(0, 1)}</span>
            {user?.name}
          </Link>
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
        </section>

        {error ? <div className="auth-error boards-error">{error}</div> : null}

        <section className="boards-section" aria-label="看板列表">
          <div className="boards-section-head">
            <h2>
              <IconBoard />
              正式看板
              <span className="drafts-count">{boards.length}</span>
            </h2>
            <button
              type="button"
              className="boards-create-btn"
              onClick={() => setDialog({ open: true, title: '' })}
            >
              + 添加看板
            </button>
          </div>

          {loading ? (
            <div className="board-status">正在加载看板列表…</div>
          ) : boards.length === 0 ? (
            <div className="boards-empty">
              <div className="boards-empty-icon" aria-hidden="true">
                <IconBoard />
              </div>
              <h2>还没有看板</h2>
              <p>创建第一块看板，或从草稿箱发布一块。</p>
              <button
                type="button"
                className="boards-create-btn"
                onClick={() => setDialog({ open: true, title: '' })}
              >
                + 添加看板
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
            </div>
          )}
        </section>

        <section className="drafts-section" aria-label="草稿箱">
          <div className="drafts-section-head">
            <div>
              <h2>
                <IconDraft />
                草稿箱
                <span className="drafts-count">{drafts.length}</span>
              </h2>
              <p>先记下看板想法，完善后再发布成正式看板。</p>
            </div>
            <button
              type="button"
              className="boards-create-btn boards-create-btn--light"
              onClick={() =>
                setDraftDialog({ open: true, id: null, title: '', description: '' })
              }
            >
              + 添加草稿
            </button>
          </div>

          {loading ? null : drafts.length === 0 ? (
            <div className="drafts-empty">
              暂无草稿。点子还没想清楚时，可以先放进草稿箱。
            </div>
          ) : (
            <div className="drafts-grid">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  busyId={draftBusyId}
                  onEdit={(d) =>
                    setDraftDialog({
                      open: true,
                      id: d.id,
                      title: d.title,
                      description: d.description || '',
                    })
                  }
                  onPublish={publishDraft}
                  onDelete={setConfirmDraftId}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal
        open={dialog.open}
        title="添加看板"
        onClose={() => setDialog({ open: false, title: '' })}
        onSubmit={createBoard}
        submitLabel="创建"
      >
        <p className="modal-lead">给看板起个名字，之后可以随时在列表里找到它。</p>
        <div className="modal-field">
          <label className="modal-field-label" htmlFor="new-board-title">
            标题
          </label>
          <input
            id="new-board-title"
            className="modal-input"
            value={dialog.title}
            placeholder="例如：产品迭代"
            autoComplete="off"
            onChange={(e) => setDialog((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={draftDialog.open}
        title={draftDialog.id ? '编辑草稿' : '新建草稿'}
        onClose={() => setDraftDialog({ open: false, id: null, title: '', description: '' })}
        onSubmit={saveDraft}
        submitLabel="保存"
      >
        <p className="modal-lead">草稿不会出现在工作区，发布后才会生成正式看板。</p>
        <div className="modal-field">
          <label className="modal-field-label" htmlFor="draft-title">
            标题
          </label>
          <input
            id="draft-title"
            className="modal-input"
            value={draftDialog.title}
            placeholder="例如：Q4 规划"
            autoComplete="off"
            onChange={(e) => setDraftDialog((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <div className="modal-field">
          <label className="modal-field-label" htmlFor="draft-desc">
            描述（可选）
          </label>
          <textarea
            id="draft-desc"
            className="modal-textarea"
            rows={3}
            value={draftDialog.description}
            placeholder="记下目标、范围或待办要点…"
            onChange={(e) =>
              setDraftDialog((prev) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>
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

      <Modal
        open={Boolean(confirmDraftId)}
        title="删除草稿"
        onClose={() => setConfirmDraftId(null)}
        onSubmit={removeDraft}
        submitLabel="确定删除"
        cancelLabel="取消"
        danger
      >
        <p className="confirm-message">确定删除这份草稿？此操作不可撤销。</p>
      </Modal>
    </div>
  );
}
