import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export function LoginPage() {
  const { login, isAuthenticated, booting } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@mykanban.dev');
  const [password, setPassword] = useState('demo1234');
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
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请重试');
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
            <h1>MyKanban</h1>
            <p>全栈任务看板 · 登录后管理你的多块看板</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="auth-foot">
          还没有账号？ <Link to="/register">注册</Link>
          <br />
          <span className="auth-hint">演示账号已预填：demo@mykanban.dev / demo1234</span>
          <br />
          <span className="auth-hint">
            双窗口测协作：各开一个窗口分别登录即可（登录态按窗口隔离，互不影响）
          </span>
        </p>
      </div>
    </div>
  );
}
