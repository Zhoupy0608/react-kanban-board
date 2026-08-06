import { useEffect, useMemo, useState } from 'react';
import { formatDueLabel, getDueStatus, normalizeTags } from '../utils/cardHelpers';
import { styles } from '../styles/kanbanStyles';
import { ApiError, boardsService } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function CardDrawer({
  open,
  lane,
  card,
  lanes,
  boardId,
  onClose,
  onSave,
  onDelete,
  onMove,
  readOnly = false,
  commentSignal = 0,
  onCommentCountChange,
}) {
  const { user, refreshUser } = useAuth();
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!open || !card) return;
    setText(card.text || '');
    setDescription(card.description || '');
    setTagsText((card.tags || []).join(', '));
    setDueDate(card.dueDate || '');
  }, [open, card]);

  useEffect(() => {
    if (!open || !card || !boardId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const list = await boardsService.listComments(boardId, card.id);
        if (!cancelled) setComments(list);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, card, boardId, commentSignal]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const dueStatus = useMemo(() => getDueStatus(dueDate), [dueDate]);
  const dueHint = formatDueLabel(dueDate);

  if (!open || !card || !lane) return null;

  const handleSave = () => {
    if (readOnly) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(lane.id, card.id, {
      text: trimmed,
      description,
      tags: normalizeTags(tagsText),
      dueDate,
    });
  };

  const submitComment = async (e) => {
    e.preventDefault();
    setCommentError('');
    setCommentLoading(true);
    try {
      // 发送前核对身份，避免其他标签页切换账号后仍用旧界面身份
      await refreshUser();
      const created = await boardsService.addComment(boardId, card.id, commentBody);
      setComments((prev) => {
        const next = [...prev, created];
        onCommentCountChange?.(card.id, next.length);
        return next;
      });
      setCommentBody('');
    } catch (err) {
      setCommentError(err instanceof ApiError ? err.message : '发送失败');
    } finally {
      setCommentLoading(false);
    }
  };

  const removeComment = async (commentId) => {
    if (!commentId || deletingId) return;
    setCommentError('');
    setDeletingId(commentId);
    try {
      await boardsService.deleteComment(boardId, commentId);
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        onCommentCountChange?.(card.id, next.length);
        return next;
      });
    } catch (err) {
      setCommentError(err instanceof ApiError ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="卡片详情"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="drawer-kicker">{lane.title}</p>
            <h2 className="drawer-title">卡片详情</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="drawer-body">
          <label style={styles.modalLabel}>标题</label>
          <input
            className="modal-input"
            style={styles.modalInput}
            value={text}
            disabled={readOnly}
            onChange={(e) => setText(e.target.value)}
          />

          <label style={styles.modalLabel}>描述</label>
          <textarea
            className="modal-textarea"
            style={{ ...styles.modalTextarea, minHeight: 100 }}
            value={description}
            placeholder="补充任务细节..."
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label style={styles.modalLabel}>标签（逗号分隔）</label>
          <input
            className="modal-input"
            style={styles.modalInput}
            value={tagsText}
            placeholder="例如：开发, 紧急"
            disabled={readOnly}
            onChange={(e) => setTagsText(e.target.value)}
          />

          <label style={styles.modalLabel}>截止日期</label>
          <div className="drawer-due-row">
            <input
              className="modal-input"
              style={{ ...styles.modalInput, marginBottom: 0, flex: 1 }}
              type="date"
              value={dueDate}
              disabled={readOnly}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && !readOnly ? (
              <button
                type="button"
                className="drawer-clear-due"
                onClick={() => setDueDate('')}
              >
                清除
              </button>
            ) : null}
          </div>
          {dueHint ? <p className={`due-hint due-hint--${dueStatus}`}>{dueHint}</p> : null}

          {!readOnly ? (
            <>
              <label style={styles.modalLabel}>移动到列</label>
              <select
                className="drawer-select"
                value={lane.id}
                onChange={(e) => {
                  const targetLaneId = e.target.value;
                  if (targetLaneId !== lane.id) onMove(lane.id, card.id, targetLaneId);
                }}
              >
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <div className="comment-block">
            <h3 className="comment-title">评论</h3>
            <p className="comment-hint">支持 @昵称 或 @邮箱前缀 提及成员</p>
            <ul className="comment-list">
              {comments.length === 0 ? (
                <li className="comment-empty">暂无评论</li>
              ) : (
                comments.map((c) => {
                  const isMe = user?.id && c.userId === user.id;
                  return (
                    <li key={c.id} className={isMe ? 'is-mine' : undefined}>
                      <div className="comment-meta">
                        <div className="comment-author">
                          <strong>{c.userName || '未知用户'}</strong>
                          {isMe ? <em className="comment-me">我</em> : null}
                        </div>
                        <div className="comment-meta-right">
                          <time>{new Date(c.createdAt).toLocaleString('zh-CN')}</time>
                          {isMe ? (
                            <button
                              type="button"
                              className="comment-delete"
                              disabled={deletingId === c.id}
                              onClick={() => removeComment(c.id)}
                              aria-label="删除评论"
                              title="删除"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p>{c.body}</p>
                    </li>
                  );
                })
              )}
            </ul>
            <form className="comment-form" onSubmit={submitComment}>
              <p className="comment-as">
                当前登录：<strong>{user?.name || '未登录'}</strong>
              </p>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="写一条评论"
                rows={3}
                disabled={!user}
              />
              {commentError ? <div className="auth-error">{commentError}</div> : null}
              <div className="comment-form-actions">
                <button
                  type="submit"
                  className="comment-submit"
                  disabled={commentLoading || !user || !commentBody.trim()}
                >
                  {commentLoading ? '发送中…' : '发送'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="drawer-footer">
          {!readOnly ? (
            <button
              type="button"
              className="drawer-danger"
              onClick={() => onDelete(lane.id, card.id, card.text)}
            >
              删除卡片
            </button>
          ) : (
            <span />
          )}
          <div className="drawer-footer-actions">
            <button type="button" style={styles.modalCancelBtn} onClick={onClose}>
              关闭
            </button>
            {!readOnly ? (
              <button
                type="button"
                className="modal-submit"
                style={styles.modalSubmitBtn}
                onClick={handleSave}
              >
                保存
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
