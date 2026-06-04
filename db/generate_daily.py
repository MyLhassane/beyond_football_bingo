#!/usr/bin/env python3
"""
generate_daily.py — Generate a daily Beyond Bingo game JSON from the database.

Usage:
  python3 db/generate_daily.py                   # today's game
  python3 db/generate_daily.py 2026-06-04        # specific date
  python3 db/generate_daily.py --game-id 997     # specific game ID

Output: core_logic/<game_id>.json
"""
import sqlite3
import json
import os
import sys
from datetime import date, datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'beyond_bingo.db')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'api', 'bingo')

# Seeded game data (36 cells, ~100+ players in full DB)
# For now, we expand from the single game 996 using combinatorial shuffles

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db

# Seeded RNG for deterministic daily selection
class SeededRNG:
    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF
    def next(self):
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state
    def shuffle(self, items):
        a = list(items)
        for i in range(len(a) - 1, 0, -1):
            j = self.next() % (i + 1)
            a[i], a[j] = a[j], a[i]
        return a
    def pick(self, items, n):
        shuffled = self.shuffle(items)
        return shuffled[:n]

def game_id_for_date(target_date):
    """Generate a deterministic game ID from a date."""
    epoch = date(2024, 1, 1)
    delta = target_date - epoch
    return 900 + delta.days

def generate_daily_game(target_date=None, force_game_id=None):
    if target_date is None:
        target_date = date.today()
    elif isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    game_id = force_game_id or game_id_for_date(target_date)
    seed = target_date.toordinal()

    db = get_db()

    # Check if this game already exists
    existing = db.execute("SELECT game_id FROM daily_games WHERE game_id = ?", (game_id,)).fetchone()
    if existing:
        # Load existing configuration
        rows = db.execute("""
            SELECT gc.position, gc.cell_id, cr.requirement_id,
                   r.id, r.type_id, r.name, r.display_name, r.prefix, r.suffix, r.helper_text
            FROM daily_game_cells gc
            JOIN cell_requirements cr ON cr.cell_id = gc.cell_id
            JOIN requirements r ON r.id = cr.requirement_id
            WHERE gc.game_id = ?
            ORDER BY gc.position, cr.requirement_id
        """, (game_id,)).fetchall()

        players = db.execute("""
            SELECT p.id, p.given_name, p.family_name, p.position
            FROM daily_game_players gp
            JOIN players p ON p.id = gp.player_id
            WHERE gp.game_id = ?
        """, (game_id,)).fetchall()
    else:
        # Build a new daily game from the full pool
        all_cells = db.execute("""
            SELECT c.id, c.label, cr.requirement_id,
                   r.id as req_id, r.type_id, r.name, r.display_name, r.prefix, r.suffix, r.helper_text
            FROM cells c
            JOIN cell_requirements cr ON cr.cell_id = c.id
            JOIN requirements r ON r.id = cr.requirement_id
            ORDER BY c.id, cr.requirement_id
        """).fetchall()

        # Group by cell
        cell_map = {}
        for row in all_cells:
            cid = row['id']
            if cid not in cell_map:
                cell_map[cid] = {'id': cid, 'reqs': []}
            cell_map[cid]['reqs'].append({
                'id': row['req_id'],
                'type': row['type_id'],
                'name': row['name'],
                'displayName': row['display_name'],
                'prefix': row['prefix'],
                'suffix': row['suffix'],
                'helperText': row['helper_text']
            })

        cell_list = list(cell_map.values())
        all_players = db.execute(
            "SELECT id, given_name, family_name, position FROM players"
        ).fetchall()

        rng = SeededRNG(seed)

        # Pick 16 cells for the grid
        selected_cells = rng.pick(cell_list, 16)

        # Pick players who can fill at least one of these cells
        required_req_ids = set()
        for cell in selected_cells:
            for r in cell['reqs']:
                required_req_ids.add(r['id'])

        eligible_players = []
        for p in all_players:
            preqs = db.execute(
                "SELECT requirement_id FROM player_requirements WHERE player_id = ?",
                (p['id'],)
            ).fetchall()
            p_req_ids = {r['requirement_id'] for r in preqs}
            if p_req_ids & required_req_ids or not p_req_ids:
                eligible_players.append(dict(p))

        selected_players = eligible_players

        # Persist the generated game
        tx = db.cursor()
        tx.execute("INSERT OR IGNORE INTO daily_games (game_id, date, seed) VALUES (?, ?, ?)",
                   (game_id, target_date.isoformat(), seed))
        for pos, cell in enumerate(selected_cells):
            tx.execute("INSERT OR IGNORE INTO daily_game_cells (game_id, position, cell_id) VALUES (?, ?, ?)",
                       (game_id, pos, cell['id']))
        for p in selected_players:
            tx.execute("INSERT OR IGNORE INTO daily_game_players (game_id, player_id) VALUES (?, ?)",
                       (game_id, p['id']))
        db.commit()

        # Build row objects matching the query format
        rows = []
        for pos, cell in enumerate(selected_cells):
            for req in cell['reqs']:
                rows.append({
                    'position': pos,
                    'id': req['id'],
                    'type_id': req['type'],
                    'name': req['name'],
                    'display_name': req['displayName'],
                    'prefix': req['prefix'],
                    'suffix': req['suffix'],
                    'helper_text': req['helperText']
                })
        selected_players = [{k: p[k] for k in ('id', 'given_name', 'family_name', 'position')}
                           for p in selected_players]

    # Build the output JSON
    remit = [[] for _ in range(16)]
    for row in rows:
        pos = row['position']
        req = {
            'id': row['id'],
            'name': row['name'],
            'type': row['type_id'],
            'displayName': row['display_name']
        }
        if row.get('prefix'):
            req['prefix'] = row['prefix']
        if row.get('suffix'):
            req['suffix'] = row['suffix']
        if row.get('helper_text'):
            req['helperText'] = row['helper_text']
        remit[pos].append(req)

    players_out = []
    for p in selected_players:
        pid = p['id'] if isinstance(p, dict) else p['id']
        preqs = db.execute(
            "SELECT requirement_id FROM player_requirements WHERE player_id = ?",
            (pid,)
        ).fetchall()
        player_out = {
            'id': pid,
            'f': p['family_name'],
            'g': p['given_name'] or '',
            'v': [r['requirement_id'] for r in preqs]
        }
        if p.get('position'):
            player_out['p'] = p['position']
        players_out.append(player_out)

    output = {
        'gameData': {
            'remit': remit,
            'players': players_out
        }
    }

    db.close()

    # Write output file
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f'{game_id}.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"Generated: {out_path}")
    print(f"  Game ID: {game_id}")
    print(f"  Date:    {target_date}")
    print(f"  Cells:   {sum(1 for r in remit if r)}")
    print(f"  Players: {len(players_out)}")

    db.close()
    return output

def update_games_index():
    """Scan api/bingo/ for all .json files and write index.json."""
    import glob
    games = []
    for fpath in glob.glob(os.path.join(OUTPUT_DIR, '*.json')):
        fname = os.path.basename(fpath)
        if fname == 'index.json':
            continue
        gid = int(fname.replace('.json', ''))
        try:
            with open(fpath) as f:
                data = json.load(f)
            pcount = len(data.get('gameData', {}).get('players', []))
            games.append({'id': gid, 'players': pcount})
        except Exception:
            games.append({'id': gid, 'players': 0})
    games.sort(key=lambda x: x['id'])
    idx_path = os.path.join(OUTPUT_DIR, 'index.json')
    with open(idx_path, 'w') as f:
        json.dump({'games': games}, f)
    print(f"Index updated: {len(games)} games")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--game-id':
        generate_daily_game(force_game_id=int(sys.argv[2]))
    elif len(sys.argv) > 1:
        generate_daily_game(target_date=sys.argv[1])
    else:
        generate_daily_game()
    update_games_index()
