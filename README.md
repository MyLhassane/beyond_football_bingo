# Beyond Football Bingo

A small static web app and data server for the "Beyond Football Bingo" game.

## Overview

- Frontend: static HTML/CSS/JS under the repository root plus `core_logic/` and `ui_components/`.
- Backend: simple Python HTTP server in `server.py` that serves static files and `/api/bingo` JSON endpoints.
- Data: game JSON files in `api/bingo/` and daily challenge payloads in `daily_challenges/`.

## Run locally

Start the local server:

```bash
python3 server.py
```

Then open the app in your browser at `http://localhost:8765`.

## API endpoints

- `GET /api/bingo` — list available games
- `GET /api/bingo/daily` — latest daily game
- `GET /api/bingo/<id>` — game by ID

## Important scripts

- `python3 db/generate_daily.py` — generate a daily game JSON from the SQLite database.
- `python3 db/seed.py` — populate the SQLite database from JSON data.
- `node db/seed.js` — seed the SQLite database using `better-sqlite3`.

## Code structure

- `core_logic/bingoEngine.js` — core bingo game logic, matching players to requirements, win detection, and state management.
- `core_logic/App.js` — frontend application logic and UI wiring.
- `ui_components/` — reusable UI components.
- `api/bingo/` — source game JSON files.

## Notes

There is no package manager manifest in this repo, so use the provided Python and Node scripts directly.
