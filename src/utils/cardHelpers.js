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

export function normalizeCard(card = {}) {
  return {
    ...card,
    text: card.text ?? '',
    description: card.description ?? '',
    tags: Array.isArray(card.tags) ? card.tags : [],
    dueDate: card.dueDate || '',
  };
}
