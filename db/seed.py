#!/usr/bin/env python3
"""
seed.py — Populate the SQLite database from 996.json
Zero dependencies. Uses Python's built-in sqlite3 module.

Usage: python3 db/seed.py
"""
import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'beyond_bingo.db')
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'core_logic', '996.json')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

db = sqlite3.connect(DB_PATH)
db.execute("PRAGMA journal_mode=WAL")
db.execute("PRAGMA foreign_keys=ON")

# Read and execute schema
with open(SCHEMA_PATH) as f:
    db.executescript(f.read())

# Read game data
with open(DATA_PATH) as f:
    raw = json.load(f)
gd = raw['gameData']

# 1. Seed requirements
seen = set()
for cell in gd['remit']:
    for r in cell:
        if r['id'] in seen:
            continue
        seen.add(r['id'])
        db.execute(
            "INSERT OR IGNORE INTO requirements (id, type_id, name, display_name, prefix, suffix, helper_text) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (r['id'], r['type'], r['name'], r['displayName'],
             r.get('prefix'), r.get('suffix'), r.get('helperText'))
        )
print(f"Seeded {len(seen)} requirements")

# 2. Seed players
for p in gd['players']:
    db.execute(
        "INSERT OR IGNORE INTO players (id, given_name, family_name, position) VALUES (?, ?, ?, ?)",
        (p['id'], p.get('g', ''), p['f'], p.get('p'))
    )
print(f"Seeded {len(gd['players'])} players")

# 3. Seed player_requirements
pr_count = 0
for p in gd['players']:
    for rid in p.get('v', []):
        db.execute(
            "INSERT OR IGNORE INTO player_requirements (player_id, requirement_id) VALUES (?, ?)",
            (p['id'], rid)
        )
        pr_count += 1
print(f"Seeded {pr_count} player-requirement links")

# 4. Seed cells
for i, cell in enumerate(gd['remit'], start=1):
    label = ' + '.join(r['displayName'] for r in cell)
    db.execute("INSERT OR IGNORE INTO cells (id, label) VALUES (?, ?)", (i, label))
    for r in cell:
        db.execute(
            "INSERT OR IGNORE INTO cell_requirements (cell_id, requirement_id) VALUES (?, ?)",
            (i, r['id'])
        )
print(f"Seeded {len(gd['remit'])} cells")

# 5. Seed game 996
db.execute("INSERT OR IGNORE INTO daily_games (game_id, date, seed) VALUES (?, ?, ?)",
           (996, '2026-06-04', 42))
for i in range(len(gd['remit'])):
    db.execute("INSERT OR IGNORE INTO daily_game_cells (game_id, position, cell_id) VALUES (?, ?, ?)",
               (996, i, i + 1))
for p in gd['players']:
    db.execute("INSERT OR IGNORE INTO daily_game_players (game_id, player_id) VALUES (?, ?)",
               (996, p['id']))
print("Seeded game 996")

db.commit()
db.close()
print("Done!")
