import { useEffect, useState } from 'react';
import { ApiError, boardsService } from '../services/api';

const ROLE_LABEL = {
  owner: '所有者',
  editor: '可编辑',
  viewer: '只读',
};

export function SharePanel({ boardId, boardTitle, open, onClose, canManage }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !boardId) return undefined;
    let cancelled = false;
    setError('');
    setOkMsg('');
    setMembers([]);
    (async () => {
      try {
        const list = await boardsService.members(boardId);
        if (!cancelled) setMembers(list);
      } catch {
        if (!cancelled) setError('加载成员失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boardId]);

  if (!open) return null;

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    setLoading(true);
    try {
      await boardsService.addMember(boardId, { email, role });
      setEmail('');
      setMembers(await boardsService.members(boardId));
      setOkMsg(`已仅分享当前看板「${boardTitle || '未命名'}」，不会分享你的其他看板`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '邀请失败');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (userId) => {
    setError('');
    setOkMsg('');
    try {
      await boardsService.removeMember(boardId, userId);
      setMembers(await boardsService.members(boardId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '移除失败');
    }
  };

  return (
    <aside className="share-panel" aria-label="成员分享">
      <div className="share-panel-head">
        <div>
          <h2>分享看板</h2>
          <p className="share-board-name">「{boardTitle || '未命名看板'}」</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="share-panel-body">
        <p className="share-hint">
          只分享<strong>当前这块</strong>看板。被邀请人登录后仅能看到这一块，不会获得你的其他看板。
        </p>

        {canManage ? (
          <form className="share-invite" onSubmit={invite}>
            <input
              type="email"
              placeholder="同事邮箱（需已注册）"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">可编辑</option>
              <option value="viewer">只读</option>
            </select>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '邀请中…' : '邀请加入此看板'}
            </button>
          </form>
        ) : (
          <p className="share-hint">你当前是成员，仅所有者可邀请他人。</p>
        )}

        {error ? <div className="auth-error">{error}</div> : null}
        {okMsg ? <div className="share-ok">{okMsg}</div> : null}

        <h3 className="share-section-title">此看板成员</h3>
        <ul className="share-list">
          {members.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.userName}</strong>
                <span>{m.userEmail}</span>
              </div>
              <div className="share-list-actions">
                <em>{ROLE_LABEL[m.role] || m.role}</em>
                {canManage && m.role !== 'owner' ? (
                  <button type="button" onClick={() => remove(m.userId)}>
                    移除
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
