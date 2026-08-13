import { useEffect, useMemo, useState } from 'react';
import {
  formatDueLabel,
  getDueStatus,
  normalizeChecklist,
  normalizeTags,
} from '../utils/cardHelpers';
import { styles } from '../styles/kanbanStyles';
import { ApiError, aiService, boardsService } from '../services/api';
import { useAuth } from '../context/AuthContext';

function newChecklistItem(text = '') {
  return {
    id: `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    done: false,
  };
}

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
  onAddCards,
  readOnly = false,
  commentSignal = 0,
  onCommentCountChange,
}) {
  const { user, refreshUser } = useAuth();
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [aiBusy, setAiBusy] = useState(null);
  const [aiError, setAiError] = useState('');
  const [descPreview, setDescPreview] = useState(null);
  const [descPreviewKind, setDescPreviewKind] = useState(null);
  const [splitPreview, setSplitPreview] = useState(null);
  const [checklistPreview, setChecklistPreview] = useState(null);

  useEffect(() => {
    if (!open || !card) return;
    setText(card.text || '');
    setDescription(card.description || '');
    setTagsText((card.tags || []).join(', '));
    setDueDate(card.dueDate || '');
    setChecklist(normalizeChecklist(card.checklist));
    setNewItemText('');
    setAiError('');
    setAiBusy(null);
    setDescPreview(null);
    setDescPreviewKind(null);
    setSplitPreview(null);
    setChecklistPreview(null);
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
  const checklistDone = checklist.filter((i) => i.done).length;

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
      checklist: normalizeChecklist(checklist),
    });
  };

  const addChecklistItem = (e) => {
    e?.preventDefault?.();
    const t = newItemText.trim();
    if (!t || readOnly) return;
    setChecklist((prev) => [...prev, newChecklistItem(t)].slice(0, 40));
    setNewItemText('');
  };

  const runPolish = async () => {
    if (readOnly || aiBusy) return;
    const title = text.trim();
    if (!title) {
      setAiError('请先填写卡片标题');
      return;
    }
    setAiError('');
    setSplitPreview(null);
    setChecklistPreview(null);
    setAiBusy('polish');
    try {
      const data = await aiService.polish({ boardId, title, description });
      setDescPreview(String(data.description || ''));
      setDescPreviewKind('polish');
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : '润色失败');
      setDescPreview(null);
      setDescPreviewKind(null);
    } finally {
      setAiBusy(null);
    }
  };

  const runDescribe = async () => {
    if (readOnly || aiBusy) return;
    const title = text.trim();
    if (!title) {
      setAiError('请先填写卡片标题');
      return;
    }
    setAiError('');
    setSplitPreview(null);
    setChecklistPreview(null);
    setAiBusy('describe');
    try {
      const data = await aiService.describe({ boardId, title });
      setDescPreview(String(data.description || ''));
      setDescPreviewKind('describe');
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : '生成描述失败');
      setDescPreview(null);
      setDescPreviewKind(null);
    } finally {
      setAiBusy(null);
    }
  };

  const applyDescPreview = () => {
    if (!descPreview) return;
    setDescription(descPreview);
    setDescPreview(null);
    setDescPreviewKind(null);
  };

  const runSplit = async () => {
    if (readOnly || aiBusy) return;
    const title = text.trim();
    if (!title) {
      setAiError('请先填写卡片标题');
      return;
    }
    setAiError('');
    setDescPreview(null);
    setDescPreviewKind(null);
    setChecklistPreview(null);
    setAiBusy('split');
    try {
      const data = await aiService.split({ boardId, title, description });
      const cards = (data.cards || []).map((c, i) => ({
        key: `${i}-${c.title}`,
        title: c.title,
        description: c.description || '',
        selected: true,
      }));
      setSplitPreview(cards);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : '拆分失败');
      setSplitPreview(null);
    } finally {
      setAiBusy(null);
    }
  };

  const runChecklistSplit = async () => {
    if (readOnly || aiBusy) return;
    const title = text.trim();
    if (!title) {
      setAiError('请先填写卡片标题');
      return;
    }
    setAiError('');
    setDescPreview(null);
    setDescPreviewKind(null);
    setSplitPreview(null);
    setAiBusy('checklist');
    try {
      const data = await aiService.checklist({ boardId, title, description });
      const items = (data.items || []).map((item, i) => ({
        key: `${i}-${item.text}`,
        text: item.text,
        selected: true,
      }));
      setChecklistPreview(items);
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : '拆清单失败');
      setChecklistPreview(null);
    } finally {
      setAiBusy(null);
    }
  };

  const toggleSplitCard = (key) => {
    setSplitPreview((prev) =>
      (prev || []).map((c) => (c.key === key ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleChecklistPreview = (key) => {
    setChecklistPreview((prev) =>
      (prev || []).map((c) => (c.key === key ? { ...c, selected: !c.selected } : c))
    );
  };

  const applySplit = () => {
    if (!splitPreview || !onAddCards) return;
    const selected = splitPreview.filter((c) => c.selected);
    if (!selected.length) {
      setAiError('请至少勾选一张子任务');
      return;
    }
    onAddCards(
      lane.id,
      selected.map((c) => ({
        title: c.title,
        description: c.description,
      }))
    );
    setSplitPreview(null);
  };

  const applyChecklistPreview = () => {
    if (!checklistPreview) return;
    const selected = checklistPreview.filter((c) => c.selected);
    if (!selected.length) {
      setAiError('请至少勾选一条清单');
      return;
    }
    setChecklist((prev) =>
      normalizeChecklist([
        ...prev,
        ...selected.map((c) => newChecklistItem(c.text)),
      ])
    );
    setChecklistPreview(null);
  };

  const submitComment = async (e) => {
    e.preventDefault();
    setCommentError('');
    setCommentLoading(true);
    try {
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

          {!readOnly ? (
            <div className="ai-assist">
              <div className="ai-assist-actions">
                <button
                  type="button"
                  className="ai-assist-btn"
                  disabled={Boolean(aiBusy)}
                  onClick={runDescribe}
                >
                  {aiBusy === 'describe' ? '生成中…' : 'AI 生成描述'}
                </button>
                <button
                  type="button"
                  className="ai-assist-btn"
                  disabled={Boolean(aiBusy)}
                  onClick={runPolish}
                >
                  {aiBusy === 'polish' ? '润色中…' : 'AI 润色描述'}
                </button>
                <button
                  type="button"
                  className="ai-assist-btn"
                  disabled={Boolean(aiBusy)}
                  onClick={runChecklistSplit}
                >
                  {aiBusy === 'checklist' ? '拆分中…' : 'AI 拆到清单'}
                </button>
                <button
                  type="button"
                  className="ai-assist-btn"
                  disabled={Boolean(aiBusy) || !onAddCards}
                  onClick={runSplit}
                >
                  {aiBusy === 'split' ? '拆分中…' : 'AI 拆成卡片'}
                </button>
              </div>
              <p className="ai-assist-hint">
                「拆到清单」写在本卡内；「拆成卡片」在同列新建多张卡。均先预览再写入。
              </p>
              {aiError ? <div className="auth-error">{aiError}</div> : null}

              {descPreview != null ? (
                <div className="ai-preview">
                  <div className="ai-preview-head">
                    <strong>
                      {descPreviewKind === 'describe' ? '生成预览' : '润色预览'}
                    </strong>
                    <div className="ai-preview-actions">
                      <button
                        type="button"
                        className="ai-preview-ghost"
                        onClick={() => {
                          setDescPreview(null);
                          setDescPreviewKind(null);
                        }}
                      >
                        丢弃
                      </button>
                      <button
                        type="button"
                        className="ai-preview-apply"
                        onClick={applyDescPreview}
                      >
                        应用到描述
                      </button>
                    </div>
                  </div>
                  <pre className="ai-preview-body">{descPreview}</pre>
                </div>
              ) : null}

              {checklistPreview ? (
                <div className="ai-preview">
                  <div className="ai-preview-head">
                    <strong>清单预览</strong>
                    <div className="ai-preview-actions">
                      <button
                        type="button"
                        className="ai-preview-ghost"
                        onClick={() => setChecklistPreview(null)}
                      >
                        丢弃
                      </button>
                      <button
                        type="button"
                        className="ai-preview-apply"
                        onClick={applyChecklistPreview}
                      >
                        追加到清单
                      </button>
                    </div>
                  </div>
                  <ul className="ai-split-list">
                    {checklistPreview.map((c) => (
                      <li key={c.key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={c.selected}
                            onChange={() => toggleChecklistPreview(c.key)}
                          />
                          <span>
                            <strong>{c.text}</strong>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {splitPreview ? (
                <div className="ai-preview">
                  <div className="ai-preview-head">
                    <strong>拆分预览</strong>
                    <div className="ai-preview-actions">
                      <button
                        type="button"
                        className="ai-preview-ghost"
                        onClick={() => setSplitPreview(null)}
                      >
                        丢弃
                      </button>
                      <button type="button" className="ai-preview-apply" onClick={applySplit}>
                        创建勾选卡片
                      </button>
                    </div>
                  </div>
                  <ul className="ai-split-list">
                    {splitPreview.map((c) => (
                      <li key={c.key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={c.selected}
                            onChange={() => toggleSplitCard(c.key)}
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
          ) : null}

          <div className="checklist-block">
            <div className="checklist-head">
              <label style={{ ...styles.modalLabel, marginBottom: 0 }}>清单</label>
              {checklist.length > 0 ? (
                <span className="checklist-progress">
                  {checklistDone}/{checklist.length}
                </span>
              ) : null}
            </div>
            <ul className="checklist-list">
              {checklist.length === 0 ? (
                <li className="checklist-empty">暂无清单项</li>
              ) : (
                checklist.map((item) => (
                  <li key={item.id} className={item.done ? 'is-done' : undefined}>
                    <label className="checklist-item">
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={readOnly}
                        onChange={() =>
                          setChecklist((prev) =>
                            prev.map((x) =>
                              x.id === item.id ? { ...x, done: !x.done } : x
                            )
                          )
                        }
                      />
                      {readOnly ? (
                        <span>{item.text}</span>
                      ) : (
                        <input
                          className="checklist-text"
                          value={item.text}
                          onChange={(e) =>
                            setChecklist((prev) =>
                              prev.map((x) =>
                                x.id === item.id ? { ...x, text: e.target.value } : x
                              )
                            )
                          }
                        />
                      )}
                    </label>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="checklist-remove"
                        aria-label="删除清单项"
                        onClick={() =>
                          setChecklist((prev) => prev.filter((x) => x.id !== item.id))
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {!readOnly ? (
              <form className="checklist-add" onSubmit={addChecklistItem}>
                <input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="添加清单项…"
                  maxLength={120}
                />
                <button type="submit" disabled={!newItemText.trim()}>
                  添加
                </button>
              </form>
            ) : null}
          </div>

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
