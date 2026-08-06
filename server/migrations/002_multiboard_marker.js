/**
 * v2 → 历史版本标记（多看板发布点）
 * 结构与 v1 相同，仅 bump 版本号，便于兼容已有 schema_meta.version = 2 的库。
 */
export const version = 2;
export const name = 'multiboard_marker';

export function up(_db) {
  // 无结构变更
}

export function down(_db) {
  // 无结构变更
}
