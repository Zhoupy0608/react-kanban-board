import { openDb, listBoards } from '../server/db.js';

const db = openDb();
const collab = db
  .prepare(`SELECT id, email FROM users WHERE email = ? COLLATE NOCASE`)
  .get('collab@mykanban.dev');
console.log('collab', collab);
console.log('memberships', db.prepare('SELECT board_id, role FROM board_members WHERE user_id = ?').all(collab.id));
console.log('listBoards', listBoards(db, collab.id).map((b) => ({ id: b.id, title: b.title, role: b.role })));
db.close();
