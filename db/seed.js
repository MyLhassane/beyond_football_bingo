// ============================================================
// seed.js — Populate the database from 996.json
// Usage: node db/seed.js
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'beyond_bingo.db');
const DATA_PATH = join(__dirname, '..', 'core_logic', '996.json');

// Open DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Read game data
const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const gd = raw.gameData;

// ---- 1. Seed requirements ----
const insertReq = db.prepare(`
  INSERT OR IGNORE INTO requirements (id, type_id, name, display_name, prefix, suffix, helper_text)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seenReq = new Set();
for (const cell of gd.remit) {
  for (const r of cell) {
    if (seenReq.has(r.id)) continue;
    seenReq.add(r.id);
    insertReq.run(r.id, r.type, r.name, r.displayName, r.prefix || null, r.suffix || null, r.helperText || null);
  }
}
console.log(`Seeded ${seenReq.size} requirements`);

// ---- 2. Seed players ----
const insertPlayer = db.prepare(`
  INSERT OR IGNORE INTO players (id, given_name, family_name, position)
  VALUES (?, ?, ?, ?)
`);

for (const p of gd.players) {
  insertPlayer.run(p.id, p.g || '', p.f, p.p || null);
}
console.log(`Seeded ${gd.players.length} players`);

// ---- 3. Seed player_requirements ----
const insertPR = db.prepare(`
  INSERT OR IGNORE INTO player_requirements (player_id, requirement_id)
  VALUES (?, ?)
`);

let prCount = 0;
for (const p of gd.players) {
  if (!p.v) continue;
  for (const rid of p.v) {
    insertPR.run(p.id, rid);
    prCount++;
  }
}
console.log(`Seeded ${prCount} player-requirement links`);

// ---- 4. Seed cells ----
const insertCell = db.prepare(`INSERT OR IGNORE INTO cells (id, label) VALUES (?, ?)`);
const insertCR = db.prepare(`INSERT OR IGNORE INTO cell_requirements (cell_id, requirement_id) VALUES (?, ?)`);

for (let i = 0; i < gd.remit.length; i++) {
  const cell = gd.remit[i];
  const label = cell.map(r => r.displayName).join(' + ');
  insertCell.run(i + 1, label);
  for (const r of cell) {
    insertCR.run(i + 1, r.id);
  }
}
console.log(`Seeded ${gd.remit.length} cells`);

// ---- 5. Seed the existing game (996) ----
const insertGame = db.prepare(`
  INSERT OR IGNORE INTO daily_games (game_id, date, seed) VALUES (?, ?, ?)
`);
const insertGC = db.prepare(`
  INSERT OR IGNORE INTO daily_game_cells (game_id, position, cell_id) VALUES (?, ?, ?)
`);
const insertGP = db.prepare(`
  INSERT OR IGNORE INTO daily_game_players (game_id, player_id) VALUES (?, ?)
`);

const tx = db.transaction(() => {
  insertGame.run(996, '2026-06-04', 42);

  for (let i = 0; i < gd.remit.length; i++) {
    insertGC.run(996, i, i + 1);
  }

  for (const p of gd.players) {
    insertGP.run(996, p.id);
  }
});
tx();
console.log('Seeded game 996');

db.close();
console.log('Done!');
