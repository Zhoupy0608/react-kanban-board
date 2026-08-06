import Database from 'better-sqlite3';

const db = new Database('data/kanban.db');
const demo = db
  .prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`)
  .get('demo@mykanban.dev');
const collab = db
  .prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`)
  .get('collab@mykanban.dev');

if (!demo || !collab) {
  console.error('missing users');
  process.exit(1);
}

const result = db
  .prepare(
    `UPDATE card_comments
     SET user_id = ?
     WHERE user_id = ?
       AND body IN ('123', '567', 'ddd')`
  )
  .run(demo.id, collab.id);

console.log(`reassigned ${result.changes} comments to Demo User`);
console.log(
  db
    .prepare(
      `SELECT c.body, u.name, u.email
       FROM card_comments c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at`
    )
    .all()
);
db.close();
