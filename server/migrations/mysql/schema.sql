-- MySQL schema v8（与业务 SQL / 原 SQLite 最终结构对齐）
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS schema_meta (
  id INT PRIMARY KEY,
  version INT NOT NULL,
  CONSTRAINT chk_schema_meta_id CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uk_users_email (email)
);

CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  content_version INT NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  KEY idx_boards_owner (owner_id),
  CONSTRAINT fk_boards_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lanes (
  id VARCHAR(36) PRIMARY KEY,
  board_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  KEY idx_lanes_board (board_id, position),
  CONSTRAINT fk_lanes_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(36) PRIMARY KEY,
  lane_id VARCHAR(36) NOT NULL,
  text VARCHAR(1000) NOT NULL,
  description TEXT NOT NULL,
  tags TEXT NOT NULL,
  due_date VARCHAR(16) NOT NULL DEFAULT '',
  checklist TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  position INT NOT NULL,
  KEY idx_cards_lane (lane_id, position),
  CONSTRAINT fk_cards_lane FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_events (
  id VARCHAR(36) PRIMARY KEY,
  board_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NULL,
  action VARCHAR(128) NOT NULL,
  summary TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  KEY idx_activity_board (board_id, created_at),
  CONSTRAINT fk_activity_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS board_members (
  id VARCHAR(36) PRIMARY KEY,
  board_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(16) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uk_board_members (board_id, user_id),
  KEY idx_members_board (board_id),
  KEY idx_members_user (user_id),
  CONSTRAINT fk_members_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_member_role CHECK (role IN ('owner', 'editor', 'viewer'))
);

CREATE TABLE IF NOT EXISTS card_comments (
  id VARCHAR(36) PRIMARY KEY,
  board_id VARCHAR(36) NOT NULL,
  card_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  KEY idx_comments_card (board_id, card_id, created_at),
  CONSTRAINT fk_comments_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  board_id VARCHAR(36) NULL,
  card_id VARCHAR(36) NULL,
  actor_id VARCHAR(36) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(32) NOT NULL,
  KEY idx_notifications_user (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS board_drafts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  KEY idx_board_drafts_user (user_id, updated_at),
  CONSTRAINT fk_drafts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;
