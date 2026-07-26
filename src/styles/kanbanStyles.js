export const LANE_ACCENTS = [
  { bg: '#fce7f3', dot: '#ec4899' }, // pink
  { bg: '#ffedd5', dot: '#f97316' }, // orange
  { bg: '#dbeafe', dot: '#3b82f6' }, // blue
  { bg: '#ede9fe', dot: '#8b5cf6' }, // lavender
  { bg: '#dcfce7', dot: '#22c55e' }, // green
  { bg: '#f3f4f6', dot: '#6b7280' }, // grey
];

const TITLE_ACCENT = {
  待处理: LANE_ACCENTS[0],
  'To Do': LANE_ACCENTS[0],
  进行中: LANE_ACCENTS[1],
  'In Progress': LANE_ACCENTS[1],
  已完成: LANE_ACCENTS[3],
  Completed: LANE_ACCENTS[3],
  新任务: LANE_ACCENTS[2],
  'In Review': LANE_ACCENTS[2],
};

export function getLaneAccent(title, index = 0) {
  return TITLE_ACCENT[title] || LANE_ACCENTS[index % LANE_ACCENTS.length];
}

/** Map first tag / urgency keywords to a priority chip style */
export function getPriorityFromTags(tags = []) {
  const list = tags.map((t) => String(t).toLowerCase());
  if (list.some((t) => /紧急|urgent|high|高/.test(t))) {
    return { label: tags.find((t) => /紧急|urgent|high|高/i.test(t)) || 'High', tone: 'high' };
  }
  if (list.some((t) => /中|medium|一般/.test(t))) {
    return { label: tags.find((t) => /中|medium|一般/i.test(t)) || 'Medium', tone: 'medium' };
  }
  if (list.some((t) => /低|low/.test(t))) {
    return { label: tags.find((t) => /低|low/i.test(t)) || 'Low', tone: 'low' };
  }
  if (tags[0]) return { label: tags[0], tone: 'tag' };
  return null;
}

export const styles = {
  boardRow: {
    // layout handled by .board-row CSS
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  deleteBtn: {
    fontSize: '18px',
    lineHeight: 1,
    flexShrink: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '6px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.35)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalPanel: {
    width: '100%',
    maxWidth: '420px',
    background: '#fff',
    borderRadius: '16px',
    padding: '22px',
    boxShadow: '0 20px 48px rgba(17, 24, 39, 0.18)',
    border: '1px solid var(--line)',
  },
  modalTitle: {
    margin: '0 0 16px',
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--ink)',
    letterSpacing: '-0.02em',
  },
  modalLabel: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    color: 'var(--ink-muted)',
    fontWeight: 500,
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '14px',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none',
    background: '#fff',
  },
  modalTextarea: {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '14px',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    fontSize: '14px',
    color: 'var(--ink)',
    outline: 'none',
    minHeight: '96px',
    resize: 'vertical',
    fontFamily: 'inherit',
    background: '#fff',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
  },
  modalCancelBtn: {
    padding: '9px 14px',
    border: 'none',
    borderRadius: '999px',
    background: '#f3f4f6',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  modalSubmitBtn: {
    padding: '9px 16px',
    border: 'none',
    borderRadius: '999px',
    background: 'var(--accent)',
    color: 'var(--accent-ink)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 700,
  },
};
