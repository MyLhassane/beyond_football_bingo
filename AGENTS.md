# Beyond Bingo — Agent Instructions

## Project overview
- A static web app for the "Beyond Bingo" football-themed bingo game.
- **No build step, no npm, no framework** — pure HTML/CSS/JS + Python HTTP server for local dev.
- Game data is in `api/bingo/*.json` as flat files (101 games, IDs 996–1096).
- **Deployment**: works as pure static site on GitHub Pages / Vercel (no Python needed in production).
- Runtime: The game is fully client-side (`daily/app.js` + `core_logic/bingoEngine.js`).

## Project structure
```
beyond_bingo/
├── index.html              ← Homepage (Daily Challenge + With Friends placeholder)
├── daily/
│   ├── index.html          ← Daily Challenge page
│   └── app.js              ← Main game UI (Vanilla JS SPA)
├── api/bingo/
│   ├── index.json          ← Static index of all games (auto-generated)
│   ├── 996.json .. 1096.json ← Game data files
├── media/categories/       ← 156 requirement images (.webp)
├── core_logic/
│   ├── bingoEngine.js      ← Pure game engine (no DOM, framework-agnostic)
│   ├── App.js              ← Original React minified bundle (reference only)
│   └── app_local.js        ← Early prototype (5x5 grid, Arabic, reference only)
├── ui_components/          ← Tailwind CSS + original React components (reference)
├── db/
│   ├── schema.sql          ← SQLite schema
│   ├── beyond_bingo.db     ← SQLite database (for dynamic generation)
│   ├── seed.py / seed.js   ← Database seeding scripts
│   └── generate_daily.py   ← Generate daily game JSONs from DB → api/bingo/
├── server.py               ← Python HTTP server for local dev (port 8765)
├── daily_fetcher.py        ← Download new games from playfootball.games → api/bingo/
└── AGENTS.md               ← This file
```

## Key files explained

### `daily/app.js`
- The main frontend application (~530 lines, Vanilla JS).
- Uses `API_BASE = '../api/bingo'` (relative paths — works both locally and on static hosting).
- Fetches `index.json` for the game list, `<id>.json` for specific games.
- `render()` function uses a **persistent grid** (reuses DOM elements, only updates changed cells to avoid image flicker).
- localStorage key: `beyond-bingo_stats`.

### `core_logic/bingoEngine.js`
- Pure functions: `createGame()`, `tryPlacePlayer()`, `playWildcard()`, `checkWin()`, etc.
- 4×4 grid (16 cells), blackout win condition + line detection.
- Zero DOM, zero framework — usable from any JS context.

### `server.py`
- Local dev server only (not used in production).
- Endpoints: `GET /api/bingo/` (index.json), `/api/bingo/daily`, `/api/bingo/<id>` (with or without `.json`).
- **Not compatible with Vercel/GitHub Pages**. In production, all files are served statically.
- Run: `python3 server.py` on port 8765.

## Session history (as of June 2026)

### What was built
1. **Daily Challenge mode** — fully functional with grid, player turns, wildcard, skip, win detection, stats (localStorage), share, pagination (prev/next across 101 games).
2. **Homepage** — game mode selection (Daily active, With Friends placeholder).
3. **Pagination fix** — `<div id="gamePagination">` now removed before creating new one (was stacking duplicates).
4. **Image flicker fix** — grid is persistent; only changed cells update their DOM, empty cells keep their `<img>` elements intact.
5. **Name unification** — `beyond_football_bingo` → `beyond_bingo`, `Football Bingo` → `Beyond Bingo` everywhere (DB file, localStorage keys, HTML titles, comments).
6. **Hash suffix removal** — all `*.HASH.js` and `*.HASH.css` files renamed to clean names.
7. **Link cleanup** — all `playfootball.games` links in UI replaced with relative paths or removed.
8. **CORS** — `Access-Control-Allow-Origin: *` on API responses.
9. **`json_to_sqlite.py` fix** — uses correct table/column names matching `schema.sql`.
10. **Static-first deployment** — `api/bingo/index.json` auto-generated, frontend uses relative `.json` paths.

### Known issues / TODOs
- **"With Friends" mode** — placeholder only, not implemented (awaiting room architecture info).
- **`db/beyond_bingo.db`** — only contains game 996, needs full seeding.
- **`daily_challenges/`** — duplicate of `api/bingo/`, can be deleted.
- **No SEO tags** beyond what's in the original HTML.
- **No PWA / offline support**.

## How to run locally
```bash
python3 server.py
# → http://localhost:8765
```

## How to regenerate game index (after adding new JSON files)
```bash
python3 -c "
import json, os, glob
games = []
for f in glob.glob('api/bingo/*.json'):
    name = os.path.basename(f)
    if name == 'index.json': continue
    gid = int(name.replace('.json', ''))
    with open(f) as fh:
        data = json.load(fh)
    games.append({'id': gid, 'players': len(data['gameData']['players'])})
games.sort(key=lambda g: g['id'])
with open('api/bingo/index.json', 'w') as f:
    json.dump({'games': games}, f)
print(f'✅ index.json updated: {len(games)} games')
"

## How to deploy to GitHub Pages
1. Push the repo (all files including `api/bingo/` JSON files)
2. GitHub repo → Settings → Pages → Source: Deploy from branch → main, / (root)
3. Site will be live at `https://<user>.github.io/<repo>/`

No build step needed. No Python runtime needed in production.
