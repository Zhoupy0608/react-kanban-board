import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export function RegisterPage() {
  const { register, isAuthenticated, booting } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!booting && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="auth-logo">M</span>
          <div>
            <h1>创建账号</h1>
            <p>注册后即可创建多块看板并持久化到 SQLite</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            昵称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="至少 2 个字符"
              required
              minLength={2}
            />
          </label>
          <label>
            邮箱
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              required
              minLength={6}
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '创建中…' : '注册'}
          </button>
        </form>

        <p className="auth-foot">
          已有账号？ <Link to="/login">登录</Link>
        </p>
      </div>
    </div>
  );
}
