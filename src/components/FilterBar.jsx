import { styles } from '../styles/kanbanStyles';

export function FilterBar({
  keyword,
  onKeywordChange,
  allTags,
  selectedTags,
  onToggleTag,
  lanes,
  selectedLaneIds,
  onToggleLane,
  onClear,
  hasActiveFilters,
  resultCount,
}) {
  return (
    <div style={styles.filterBar}>
      <div style={styles.filterRow}>
        <input
          style={styles.filterSearch}
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜索标题、描述或标签..."
        />
        {hasActiveFilters && (
          <button type="button" style={styles.filterClearBtn} onClick={onClear}>
            清除筛选
          </button>
        )}
        <span style={styles.filterMeta}>
          {hasActiveFilters ? `匹配 ${resultCount} 张卡片` : `共 ${resultCount} 张卡片`}
        </span>
      </div>

      <div style={styles.filterRow}>
        <span style={styles.filterLabel}>列状态</span>
        <div style={styles.filterChips}>
          {lanes.map((lane) => {
            const active = selectedLaneIds.includes(lane.id);
            return (
              <button
                key={lane.id}
                type="button"
                style={{
                  ...styles.filterChip,
                  ...(active ? styles.filterChipActive : null),
                }}
                onClick={() => onToggleLane(lane.id)}
              >
                {lane.title}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.filterRow}>
        <span style={styles.filterLabel}>标签</span>
        <div style={styles.filterChips}>
          {allTags.length === 0 ? (
            <span style={styles.filterEmpty}>暂无标签，可在卡片上添加</span>
          ) : (
            allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  style={{
                    ...styles.filterChip,
                    ...(active ? styles.filterChipActive : null),
                  }}
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
  );
}
