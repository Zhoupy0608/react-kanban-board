import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const db = new Database('data/kanban.db');
const email = 'collab@mykanban.dev';
const exists = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
if (!exists) {
  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(
    randomUUID(),
    email,
    'Collab User',
    bcrypt.hashSync('demo1234', 10),
    new Date().toISOString()
  );
  console.log('created collab user');
} else {
  console.log('collab already exists');
}
console.log(db.prepare('SELECT email, name FROM users').all());
db.close();
