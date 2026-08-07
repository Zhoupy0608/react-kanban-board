import { useEffect, useState } from 'react';
import { ApiError, aiService } from '../services/api';

/**
 * 列级 AI 注入：输入自然语言 → 预览勾选 → 确认后由父组件写入看板。
 */
export function LaneAiPanel({ open, boardId, laneTitle, existingTitles = [], onClose, onApply }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    setBusy(false);
    setError('');
    setPreview(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const generate = async (e) => {
    e?.preventDefault?.();
    const text = prompt.trim();
    if (!text || busy) return;
    setError('');
    setBusy(true);
    setPreview(null);
    try {
      const data = await aiService.laneInject({
        boardId,
        laneTitle,
        prompt: text,
        existingTitles,
      });
      const cards = (data.cards || []).map((c, i) => ({
        key: `${i}-${c.title}`,
        title: c.title,
        description: c.description || '',
        selected: true,
      }));
      if (!cards.length) {
        setError('未生成有效任务，请换个说法再试');
      } else {
        setPreview(cards);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '生成失败');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key) => {
    setPreview((prev) =>
      (prev || []).map((c) => (c.key === key ? { ...c, selected: !c.selected } : c))
    );
  };

  const apply = () => {
    if (!preview) return;
    const selected = preview.filter((c) => c.selected);
    if (!selected.length) {
      setError('请至少勾选一张任务');
      return;
    }
    onApply(
      selected.map((c) => ({
        title: c.title,
        description: c.description,
      }))
    );
  };

  return (
    <div
      className="lane-ai-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="lane-ai-panel"
        role="dialog"
        aria-modal="true"
        aria-label="AI 添加到列"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="lane-ai-head">
          <div>
            <p className="lane-ai-kicker">列 · {laneTitle || '未命名'}</p>
            <h3 className="lane-ai-title">AI 添加任务</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <form className="lane-ai-form" onSubmit={generate}>
          <label className="lane-ai-label">用一句话说明要生成什么</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：搭建 CI/CD 流水线；或：本周用户调研相关任务"
            rows={3}
            disabled={busy}
          />
          <p className="ai-assist-hint">先预览勾选，确认后再写入该列；不会自动改库。</p>
          {error ? <div className="auth-error">{error}</div> : null}
          <div className="lane-ai-actions">
            <button type="button" className="lane-ai-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="lane-ai-primary" disabled={busy || !prompt.trim()}>
              {busy ? '生成中…' : preview ? '重新生成' : '生成预览'}
            </button>
          </div>
        </form>

        {preview ? (
          <div className="ai-preview lane-ai-preview">
            <div className="ai-preview-head">
              <strong>预览（{preview.filter((c) => c.selected).length}/{preview.length}）</strong>
              <button type="button" className="ai-preview-apply" onClick={apply}>
                创建勾选卡片
              </button>
            </div>
            <ul className="ai-split-list">
              {preview.map((c) => (
                <li key={c.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={() => toggle(c.key)}
                    />
                    <span>
                      <strong>{c.title}</strong>
                      {c.description ? <em>{c.description}</em> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
