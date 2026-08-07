/** @returns {'none'|'overdue'|'today'|'upcoming'} */
export function getDueStatus(dueDate) {
  if (!dueDate) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'none';

  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  return 'upcoming';
}

export function formatDueLabel(dueDate) {
  const status = getDueStatus(dueDate);
  if (status === 'none') return '';
  if (status === 'overdue') return `逾期 ${dueDate}`;
  if (status === 'today') return '今日到期';
  return dueDate;
}

export function cardMatchesDueFilter(card, dueFilter) {
  if (!dueFilter || dueFilter === 'all') return true;
  const status = getDueStatus(card.dueDate);
  if (dueFilter === 'overdue') return status === 'overdue';
  if (dueFilter === 'today') return status === 'today';
  if (dueFilter === 'dated') return status !== 'none';
  return true;
}

export function normalizeTags(tags) {
  return [...new Set(
    (Array.isArray(tags) ? tags : String(tags || '').split(/[,，]/))
      .map((t) => String(t).trim())
      .filter(Boolean)
  )];
}

const PRIORITY_VALUES = new Set(['low', 'normal', 'high']);

/** @returns {'low'|'normal'|'high'} */
export function normalizePriority(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (PRIORITY_VALUES.has(raw)) return raw;
  if (/^(高|紧急|urgent|p0|p1)$/i.test(raw)) return 'high';
  if (/^(低|low|p3)$/i.test(raw)) return 'low';
  if (/^(中|一般|medium|中等|p2)$/i.test(raw)) return 'normal';
  return 'normal';
}

export const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '中' },
  { value: 'high', label: '高' },
];

export function priorityLabel(value) {
  const p = normalizePriority(value);
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.label || '中';
}

/** @returns {{ id: string, text: string, done: boolean }[]} */
export function normalizeChecklist(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((item, i) => {
      const text = String(item?.text ?? item?.title ?? '').trim();
      if (!text) return null;
      const id =
        String(item?.id || '').trim() ||
        `chk-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      return { id, text, done: Boolean(item?.done) };
    })
    .filter(Boolean)
    .slice(0, 40);
}

export function normalizeCard(card = {}) {
  return {
    ...card,
    text: card.text ?? '',
    description: card.description ?? '',
    tags: Array.isArray(card.tags) ? card.tags : [],
    dueDate: card.dueDate || '',
    checklist: normalizeChecklist(card.checklist),
    priority: normalizePriority(card.priority),
    commentCount: Math.max(0, Number(card.commentCount) || 0),
  };
}
