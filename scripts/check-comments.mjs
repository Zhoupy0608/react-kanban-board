import Database from 'better-sqlite3';

const db = new Database('data/kanban.db');
console.log('users', db.prepare('SELECT id, email, name FROM users').all());
console.log(
  'comments',
  db
    .prepare(
      `SELECT c.body, c.user_id AS userId, u.email, u.name, c.created_at AS createdAt
       FROM card_comments c
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at`
    )
    .all()
);
db.close();
