import { FancySelect } from './FancySelect';

const DUE_OPTIONS = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今日到期' },
  { id: 'overdue', label: '已逾期' },
  { id: 'dated', label: '有截止日期' },
];

export function FilterBar({
  keyword,
  onKeywordChange,
  allTags,
  selectedTags,
  onToggleTag,
  lanes,
  selectedLaneIds,
  onToggleLane,
  dueFilter,
  onDueFilterChange,
  onClear,
  hasActiveFilters,
  resultCount,
  filterOpen,
  onAddTask,
}) {
  return (
    <>
      <div className="toolbar">
        <input
          className="toolbar-search"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜索任务..."
        />

        <FancySelect
          value={dueFilter}
          options={DUE_OPTIONS}
          onChange={onDueFilterChange}
          ariaLabel="截止日期筛选"
        />

        <button
          type="button"
          className="toolbar-filter-btn"
          onClick={() => filterOpen.onToggle()}
        >
          筛选 {hasActiveFilters ? '· 已启用' : ''}
        </button>

        <span className="filter-meta">
          {hasActiveFilters ? `匹配 ${resultCount}` : `共 ${resultCount}`} 张
        </span>

        <button type="button" className="primary-btn" onClick={onAddTask}>
          + 新建任务
        </button>
      </div>

      {filterOpen.open && (
        <div className="filter-panel">
          <div className="filter-row">
            <span className="filter-label">列状态</span>
            <div className="filter-chips">
              {lanes.map((lane) => {
                const active = selectedLaneIds.includes(lane.id);
                return (
                  <button
                    key={lane.id}
                    type="button"
                    className={`filter-chip${active ? ' is-active' : ''}`}
                    onClick={() => onToggleLane(lane.id)}
                  >
                    {lane.title}
                  </button>
                );
              })}
            </div>
            {hasActiveFilters && (
              <button type="button" className="filter-clear" onClick={onClear}>
                清除
              </button>
            )}
          </div>

          <div className="filter-row">
            <span className="filter-label">标签</span>
            <div className="filter-chips">
              {allTags.length === 0 ? (
                <span className="filter-empty">暂无标签</span>
              ) : (
                allTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`filter-chip${active ? ' is-active' : ''}`}
                      onClick={() => onToggleTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
