import { useMemo, useState } from 'react';
import { getDueStatus } from '../utils/cardHelpers';
import { getLaneAccent } from '../styles/kanbanStyles';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

function flattenCards(lanes) {
  const rows = [];
  lanes.forEach((lane, laneIndex) => {
    (lane.cards || []).forEach((card) => {
      rows.push({
        ...card,
        laneId: lane.id,
        laneTitle: lane.title,
        laneIndex,
      });
    });
  });
  return rows;
}

function buildMonthCells(year, month) {
  const first = startOfMonth(year, month);
  // Monday-first: Sun=0 -> 6, Mon=1 -> 0, ...
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    const date = new Date(year, month, -startPad + i + 1);
    cells.push({ date, iso: toISODate(date), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, iso: toISODate(date), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const date = new Date(last);
    date.setDate(date.getDate() + 1);
    cells.push({ date, iso: toISODate(date), inMonth: false });
  }

  return cells;
}

export function CalendarView({
  lanes,
  onOpenCard,
  onAddCard,
  onUpdateDueDate,
}) {
  const todayIso = toISODate(new Date());
  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [dragCard, setDragCard] = useState(null);

  const cards = useMemo(() => flattenCards(lanes), [lanes]);

  const byDate = useMemo(() => {
    const map = new Map();
    cards.forEach((card) => {
      if (!card.dueDate) return;
      if (!map.has(card.dueDate)) map.set(card.dueDate, []);
      map.get(card.dueDate).push(card);
    });
    return map;
  }, [cards]);

  const undated = useMemo(
    () => cards.filter((card) => !card.dueDate),
    [cards]
  );

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const title = `${cursor.year}年${cursor.month + 1}月`;

  const shiftMonth = (delta) => {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const handleDropOnDay = (iso) => {
    if (!dragCard) return;
    if (dragCard.dueDate !== iso) {
      onUpdateDueDate(dragCard.laneId, dragCard.id, iso);
    }
    setDragCard(null);
  };

  return (
    <div className="calendar-view">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="ghost-btn" onClick={() => shiftMonth(-1)}>
            上月
          </button>
          <h3 className="calendar-title">{title}</h3>
          <button type="button" className="ghost-btn" onClick={() => shiftMonth(1)}>
            下月
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              setCursor({ year: now.getFullYear(), month: now.getMonth() })
            }
          >
            今天
          </button>
        </div>
        <p className="calendar-hint">拖拽任务到日期可改截止日期 · 点击日期空白处新建</p>
      </div>

      <div className="calendar-layout">
        <div className="calendar-main">
          <div className="calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className="calendar-weekday">
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((cell) => {
              const dayCards = byDate.get(cell.iso) || [];
              const isToday = cell.iso === todayIso;
              const visible = dayCards.slice(0, 3);
              const more = dayCards.length - visible.length;

              return (
                <div
                  key={cell.iso}
                  className={[
                    'calendar-cell',
                    cell.inMonth ? '' : 'is-outside',
                    isToday ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnDay(cell.iso);
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget || e.target.classList.contains('calendar-daynum')) {
                      onAddCard(cell.iso);
                    }
                  }}
                >
                  <div className="calendar-daynum">{cell.date.getDate()}</div>
                  <div className="calendar-events">
                    {visible.map((card) => {
                      const status = getDueStatus(card.dueDate);
                      const accent = getLaneAccent(card.laneTitle, card.laneIndex);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          className={`calendar-event calendar-event--${status}`}
                          style={{ borderLeftColor: accent.dot }}
                          draggable
                          title={`${card.text} · ${card.laneTitle}`}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragCard(card);
                          }}
                          onDragEnd={() => setDragCard(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCard(card.laneId, card.id);
                          }}
                        >
                          {card.text}
                        </button>
                      );
                    })}
                    {more > 0 && (
                      <button
                        type="button"
                        className="calendar-more"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCard(dayCards[3].laneId, dayCards[3].id);
                        }}
                      >
                        +{more} 更多
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="calendar-side">
          <div className="calendar-side-head">
            <h4>未排期</h4>
            <span>{undated.length}</span>
          </div>
          <p className="calendar-side-hint">拖到左侧日期即可安排</p>
          {undated.length === 0 ? (
            <p className="overview-empty">没有未排期任务</p>
          ) : (
            <ul className="calendar-undated-list">
              {undated.map((card) => {
                const accent = getLaneAccent(card.laneTitle, card.laneIndex);
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="calendar-undated-item"
                      draggable
                      style={{ borderLeftColor: accent.dot }}
                      onDragStart={() => setDragCard(card)}
                      onDragEnd={() => setDragCard(null)}
                      onClick={() => onOpenCard(card.laneId, card.id)}
                    >
                      <span className="attention-name">{card.text}</span>
                      <span className="attention-meta">{card.laneTitle}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
