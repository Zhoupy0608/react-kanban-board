import { useMemo } from 'react';
import { getDueStatus } from '../utils/cardHelpers';
import { getLaneAccent } from '../styles/kanbanStyles';

function flattenCards(lanes) {
  const rows = [];
  lanes.forEach((lane) => {
    (lane.cards || []).forEach((card) => {
      rows.push({ ...card, laneId: lane.id, laneTitle: lane.title });
    });
  });
  return rows;
}

export function Overview({ lanes, onOpenCard, onGoBoard }) {
  const cards = useMemo(() => flattenCards(lanes), [lanes]);

  const stats = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let undated = 0;

    cards.forEach((card) => {
      const status = getDueStatus(card.dueDate);
      if (status === 'overdue') overdue += 1;
      else if (status === 'today') today += 1;
      else if (status === 'upcoming') upcoming += 1;
      else undated += 1;
    });

    return {
      total: cards.length,
      overdue,
      today,
      upcoming,
      undated,
      laneCount: lanes.length,
    };
  }, [cards, lanes.length]);

  const laneStats = useMemo(() => {
    const max = Math.max(1, ...lanes.map((l) => (l.cards || []).length));
    return lanes.map((lane, index) => {
      const count = (lane.cards || []).length;
      const accent = getLaneAccent(lane.title, index);
      return {
        id: lane.id,
        title: lane.title,
        count,
        pct: Math.round((count / max) * 100),
        accent,
      };
    });
  }, [lanes]);

  const tagStats = useMemo(() => {
    const map = new Map();
    cards.forEach((card) => {
      (card.tags || []).forEach((tag) => {
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh'));
  }, [cards]);

  const overdueCards = useMemo(
    () =>
      cards
        .filter((c) => getDueStatus(c.dueDate) === 'overdue')
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    [cards]
  );

  const todayCards = useMemo(
    () => cards.filter((c) => getDueStatus(c.dueDate) === 'today'),
    [cards]
  );

  const tagMax = Math.max(1, ...tagStats.map((t) => t.count));
  const doneLane = lanes.find((l) => /完成|done|complete/i.test(l.title));
  const doneCount = doneLane ? (doneLane.cards || []).length : 0;
  const progressPct = stats.total ? Math.round((doneCount / stats.total) * 100) : 0;

  return (
    <div className="overview">
      <div className="overview-stats">
        <div className="stat-card">
          <p className="stat-label">全部任务</p>
          <p className="stat-value">{stats.total}</p>
          <p className="stat-hint">{stats.laneCount} 列</p>
        </div>
        <div className="stat-card stat-card--danger">
          <p className="stat-label">已逾期</p>
          <p className="stat-value">{stats.overdue}</p>
          <p className="stat-hint">需尽快处理</p>
        </div>
        <div className="stat-card stat-card--warn">
          <p className="stat-label">今日到期</p>
          <p className="stat-value">{stats.today}</p>
          <p className="stat-hint">今天关注</p>
        </div>
        <div className="stat-card stat-card--ok">
          <p className="stat-label">即将到期</p>
          <p className="stat-value">{stats.upcoming}</p>
          <p className="stat-hint">未排期 {stats.undated}</p>
        </div>
      </div>

      <div className="overview-grid">
        <section className="overview-panel">
          <div className="overview-panel-head">
            <h3>列分布</h3>
            <button type="button" className="link-btn" onClick={() => onGoBoard()}>
              打开看板
            </button>
          </div>
          {laneStats.length === 0 ? (
            <p className="overview-empty">暂无列数据</p>
          ) : (
            <ul className="bar-list">
              {laneStats.map((lane) => (
                <li key={lane.id}>
                  <button
                    type="button"
                    className="bar-row"
                    onClick={() => onGoBoard({ laneId: lane.id })}
                  >
                    <div className="bar-meta">
                      <span className="bar-dot" style={{ background: lane.accent.dot }} />
                      <span className="bar-title">{lane.title}</span>
                      <span className="bar-count">{lane.count}</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${lane.pct}%`,
                          background: lane.accent.dot,
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {doneLane && stats.total > 0 && (
            <div className="progress-block">
              <div className="progress-meta">
                <span>完成进度（按「{doneLane.title}」）</span>
                <strong>{progressPct}%</strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${progressPct}%`, background: '#22c55e' }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="overview-panel">
          <div className="overview-panel-head">
            <h3>标签分布</h3>
          </div>
          {tagStats.length === 0 ? (
            <p className="overview-empty">暂无标签，可在卡片详情中添加</p>
          ) : (
            <ul className="bar-list">
              {tagStats.map((item) => (
                <li key={item.tag}>
                  <button
                    type="button"
                    className="bar-row"
                    onClick={() => onGoBoard({ tag: item.tag })}
                  >
                    <div className="bar-meta">
                      <span className="bar-title">{item.tag}</span>
                      <span className="bar-count">{item.count}</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${Math.round((item.count / tagMax) * 100)}%`,
                          background: '#f59e0b',
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overview-panel overview-panel--wide">
          <div className="overview-panel-head">
            <h3>需要关注</h3>
          </div>
          <div className="attention-grid">
            <div>
              <h4 className="attention-title attention-title--danger">逾期任务</h4>
              {overdueCards.length === 0 ? (
                <p className="overview-empty">没有逾期任务</p>
              ) : (
                <ul className="attention-list">
                  {overdueCards.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className="attention-item"
                        onClick={() => onOpenCard(card.laneId, card.id)}
                      >
                        <span className="attention-name">{card.text}</span>
                        <span className="attention-meta">
                          {card.laneTitle} · {card.dueDate}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="attention-title attention-title--warn">今日到期</h4>
              {todayCards.length === 0 ? (
                <p className="overview-empty">今天没有到期任务</p>
              ) : (
                <ul className="attention-list">
                  {todayCards.map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        className="attention-item"
                        onClick={() => onOpenCard(card.laneId, card.id)}
                      >
                        <span className="attention-name">{card.text}</span>
                        <span className="attention-meta">{card.laneTitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
