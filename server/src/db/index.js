import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data.sqlite');

const isNew = !fs.existsSync(DB_PATH);

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (isNew) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

export function resetDatabase() {
  db.pragma('foreign_keys = OFF');
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t}"`);
  const views = db
    .prepare("SELECT name FROM sqlite_master WHERE type='view'")
    .all()
    .map((r) => r.name);
  for (const v of views) db.exec(`DROP VIEW IF EXISTS "${v}"`);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.pragma('foreign_keys = ON');
}
