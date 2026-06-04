-- ============================================================
-- Beyond Bingo — Database Schema
-- SQLite 3
-- ============================================================

-- Requirement categories
CREATE TABLE IF NOT EXISTS requirement_types (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

INSERT OR IGNORE INTO requirement_types (id, name) VALUES
  (1, 'country'),
  (2, 'team'),
  (3, 'league'),
  (4, 'manager'),
  (5, 'teammate'),
  (6, 'trophy'),
  (7, 'stats'),
  (8, 'custom_group');

-- Individual requirements (e.g. "England", "Liverpool", "World Cup")
CREATE TABLE IF NOT EXISTS requirements (
  id           INTEGER PRIMARY KEY,
  type_id      INTEGER NOT NULL REFERENCES requirement_types(id),
  name         TEXT    NOT NULL,
  display_name TEXT    NOT NULL,
  prefix       TEXT,       -- e.g. "Managed by", "Played with"
  suffix       TEXT,       -- e.g. "winner"
  helper_text  TEXT,       -- explanation shown in "Technical Area"
  UNIQUE(type_id, name)
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY,
  given_name TEXT DEFAULT '',
  family_name TEXT NOT NULL,
  position  TEXT          -- e.g. "GK", "ST", "CAM", "CDM"
);

-- Which requirements each player satisfies (the v array)
CREATE TABLE IF NOT EXISTS player_requirements (
  player_id      INTEGER NOT NULL REFERENCES players(id),
  requirement_id INTEGER NOT NULL REFERENCES requirements(id),
  PRIMARY KEY (player_id, requirement_id)
);

-- Cells define a bingo grid position with one or more requirements
-- A cell is "satisfied" when a player meets ALL its requirements.
CREATE TABLE IF NOT EXISTS cells (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT           -- optional display label
);

-- Junction: which requirements belong to which cell
CREATE TABLE IF NOT EXISTS cell_requirements (
  cell_id        INTEGER NOT NULL REFERENCES cells(id),
  requirement_id INTEGER NOT NULL REFERENCES requirements(id),
  PRIMARY KEY (cell_id, requirement_id)
);

-- Daily game definitions
CREATE TABLE IF NOT EXISTS daily_games (
  game_id   INTEGER PRIMARY KEY,  -- e.g. 996, 997, etc.
  date      TEXT    NOT NULL UNIQUE,  -- ISO date: "2026-01-15"
  seed      INTEGER NOT NULL DEFAULT 0
);

-- Which cells are used in a daily game (ordered 0-15)
CREATE TABLE IF NOT EXISTS daily_game_cells (
  game_id   INTEGER NOT NULL REFERENCES daily_games(game_id),
  position  INTEGER NOT NULL CHECK (position BETWEEN 0 AND 15),
  cell_id   INTEGER NOT NULL REFERENCES cells(id),
  PRIMARY KEY (game_id, position)
);

-- Which players are available in a daily game
CREATE TABLE IF NOT EXISTS daily_game_players (
  game_id   INTEGER NOT NULL REFERENCES daily_games(game_id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  PRIMARY KEY (game_id, player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_req_player ON player_requirements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_req_req   ON player_requirements(requirement_id);
CREATE INDEX IF NOT EXISTS idx_cell_req_cell    ON cell_requirements(cell_id);
CREATE INDEX IF NOT EXISTS idx_cell_req_req     ON cell_requirements(requirement_id);
CREATE INDEX IF NOT EXISTS idx_daily_cells_game ON daily_game_cells(game_id);
CREATE INDEX IF NOT EXISTS idx_daily_players_game ON daily_game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_daily_games_date ON daily_games(date);
