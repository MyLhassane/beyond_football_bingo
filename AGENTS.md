# Beyond Football Bingo — Agent Instructions

## Project overview
- This repository is a small static web app + data server for the "Beyond Football Bingo" game.
- The frontend is delivered as static HTML/CSS/JS; the backend is a lightweight Python HTTP server in `server.py`.
- Game content is stored as JSON in `api/bingo/*.json` and daily challenge payloads in `daily_challenges/*.json`.
- There is no package.json, no framework build pipeline, and no dedicated test suite.

## What agents should know
- `server.py` is the primary development entrypoint. Run it with `python3 server.py` to serve static files and `/api/bingo` endpoints.
- `core_logic/bingoEngine.js` contains the pure game engine and is the best source of truth for bingo rules, win detection, cell matching, and game state transitions.
- `core_logic/App.js` and `ui_components/` contain the frontend application logic and UI components for the playable game.
- The JSON files in `api/bingo/` are the actual game data source. Most content changes should be made there or generated from `db/` scripts.

## Important scripts
- `python3 server.py` — start the local server and serve both static files and the JSON API.
- `python3 db/generate_daily.py` — generate a daily game JSON from the SQLite database.
- `python3 db/seed.py` — populate the SQLite database from JSON data.
- `node db/seed.js` — alternative JS-based database seeding script using `better-sqlite3`.

## Data shape and conventions
- A game JSON has `gameData.remit` (grid cell requirements) and `gameData.players` (player objects with `id`, `f`, `g`, `v`, etc.).
- `player.v` is an array of requirement IDs that the player satisfies.
- `bingoEngine.js` treats filled cells as `null` or object states and uses a 4x4 grid.
- Avoid editing minified or compiled artifacts like `x.py`; focus on source modules under `core_logic/`, `ui_components/`, and the JSON data directories.

## Recommended agent behavior
- Prefer minimal, targeted changes. If a fix touches both data and UI, update the source JSON or `core_logic` files first.
- When asked to run or debug the app, use `python3 server.py` as the main local server command.
- If a task requires data generation or migration, look at `db/generate_daily.py`, `db/seed.py`, and `db/seed.js`.
- If an issue is frontend-related, inspect `core_logic/App.js`, `core_logic/bingoEngine.js`, and `ui_components/` before changing static bundles.

## Notes for maintainers
- There is no documented test command and no package manager manifest; treat this as a lightweight repo with script-driven workflows.
- Preserve the existing JSON schema and API routes when modifying game data or server behavior.
