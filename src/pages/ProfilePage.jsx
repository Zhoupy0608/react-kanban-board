import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { ApiError, boardsService } from '../services/api';

function formatJoined(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [boardCount, setBoardCount] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.id, user?.name, user?.email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await boardsService.list();
        if (!cancelled) setBoardCount(list.length);
      } catch {
        if (!cancelled) setBoardCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const dirty =
    name.trim() !== (user?.name || '') ||
    email.trim().toLowerCase() !== (user?.email || '').toLowerCase();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const onSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setSuccess('资料已保存');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setError('');
    setSuccess('');
  };

  const initial = (name.trim() || user?.name || 'U').slice(0, 1);

  return (
    <div className="boards-shell">
      <div className="boards-atmosphere" aria-hidden="true" />

      <header className="boards-topbar">
        <Link to="/" className="boards-brand">
          <span className="auth-logo">M</span>
          <div>
            <strong>MyKanban</strong>
            <span>全栈任务工作台</span>
          </div>
        </Link>
        <div className="boards-user">
          <NotificationBell />
          <button type="button" className="ghost-btn" onClick={onLogout}>
            退出
          </button>
        </div>
      </header>

      <main className="profile-main">
        <Link to="/" className="profile-back">
          ← 返回看板列表
        </Link>

        <section className="profile-card">
          <div className="profile-hero">
            <span className="profile-avatar" aria-hidden="true">
              {initial}
            </span>
            <div>
              <h1 className="profile-name">{name.trim() || user?.name || '用户'}</h1>
              <p className="profile-email">{email.trim() || user?.email || '—'}</p>
            </div>
          </div>

          <form className="profile-form" onSubmit={onSave}>
            <div className="profile-field">
              <label htmlFor="profile-name">昵称</label>
              <input
                id="profile-name"
                className="modal-input"
                value={name}
                autoComplete="nickname"
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  setSuccess('');
                }}
                required
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-email">邮箱</label>
              <input
                id="profile-email"
                className="modal-input"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSuccess('');
                }}
                required
              />
            </div>

            <dl className="profile-meta profile-meta--readonly">
              <div>
                <dt>注册时间</dt>
                <dd>{formatJoined(user?.created_at)}</dd>
              </div>
              <div>
                <dt>我的看板</dt>
                <dd>{boardCount == null ? '…' : `${boardCount} 块`}</dd>
              </div>
            </dl>

            {error ? <div className="auth-error">{error}</div> : null}
            {success ? <div className="profile-success">{success}</div> : null}

            <div className="profile-actions">
              <button
                type="submit"
                className="boards-create-btn"
                disabled={saving || !dirty}
              >
                {saving ? '保存中…' : '保存修改'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={saving || !dirty}
                onClick={onReset}
              >
                撤销
              </button>
              <Link to="/" className="profile-link-btn">
                查看全部看板
              </Link>
              <button type="button" className="profile-logout" onClick={onLogout}>
                退出登录
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
