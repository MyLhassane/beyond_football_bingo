// ============================================================
// bingoEngine.js — Bingo Core Logic (Pure Functional)
// Zero dependencies. ES6+. Framework-agnostic.
// Extracted from reverse-engineering beyond bingo game logic.
// ============================================================

// -- Constants --
const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

// Helper: Fisher-Yates shuffle (returns new array)
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// -- Cell/Requirement Matching --

// Check if a single player satisfies all requirements of a cell.
// player.v: number[] — IDs of attributes the player possesses.
// cellReqs: { id: number }[] — the cell's requirement list.
const playerMatchesCell = (player, cellReqs) =>
  cellReqs.every((req) => player.v.includes(req.id));

// Return all players who can fill a given cell.
const getMatchingPlayers = (players, cellReqs) =>
  players.filter((p) => playerMatchesCell(p, cellReqs));

// -- Grid Helpers --

// Convert flat cell array to a 2D grid (array of rows).
const toGrid = (cells) => {
  const grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    grid.push(cells.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE));
  }
  return grid;
};

// Check if all cells in a line are filled (non-null).
const lineComplete = (line) => line.every((cell) => cell !== null);

// -- Win / Completed Lines --

// Check if the entire board is filled (blackout bingo).
const checkWin = (cells) =>
  cells.length === TOTAL_CELLS && cells.every((c) => c !== null);

// Find all completed lines: rows, columns, and diagonals.
// Returns: { rows: number[], columns: number[], diagonals: number[], all: number[] }
// Each value is the index of completed lines.
const getCompletedLines = (cells) => {
  if (cells.length !== TOTAL_CELLS) {
    return { rows: [], columns: [], diagonals: [], all: [] };
  }

  const grid = toGrid(cells);
  const rows = [];
  const cols = [];
  const diags = [];

  // Rows
  for (let r = 0; r < GRID_SIZE; r++) {
    if (lineComplete(grid[r])) rows.push(r);
  }

  // Columns
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = grid.map((row) => row[c]);
    if (lineComplete(col)) cols.push(c);
  }

  // Diagonals
  const d1 = [];
  const d2 = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    d1.push(grid[i][i]);
    d2.push(grid[i][GRID_SIZE - 1 - i]);
  }
  if (lineComplete(d1)) diags.push(0);
  if (lineComplete(d2)) diags.push(1);

  const all = [...rows, ...cols, ...diags];

  return { rows, columns: cols, diagonals: diags, all };
};

// -- Cell State (creating filled-cell objects) --

// Build the display name for a cell when filled by a player.
// Uses first letter of given name + family name (e.g. "M. Salah").
const formatPlayerName = (player) => {
  const initial = player.g ? player.g.substring(0, 1) + '. ' : '';
  return initial + player.f;
};

// Create a filled cell record from a player.
const fillCell = (player, extra = {}) => ({
  id: player.id,
  playerName: formatPlayerName(player),
  ...extra,
});

// -- Game State Management --

// Create initial game state from raw gameData (from JSON/SQLite).
// gameData.shape: { remit: CellReq[][], players: Player[] }
const createGame = (gameData) => ({
  cells: Array(TOTAL_CELLS).fill(null),
  players: shuffle(gameData.players),
  remit: gameData.remit,
  currentPlayerIndex: 0,
  won: false,
  completedLines: { rows: [], columns: [], diagonals: [], all: [] },
  lastResult: null,
});

// Restore game from persisted state (e.g. localStorage).
// savedCells: (CellState | null)[] — length 16
// savedPlayerIndex: number
const restoreGame = (gameData, savedCells, savedPlayerIndex) => ({
  cells: savedCells,
  players: shuffle(gameData.players),
  remit: gameData.remit,
  currentPlayerIndex: savedPlayerIndex,
  won: checkWin(savedCells),
  completedLines: getCompletedLines(savedCells),
  lastResult: null,
});

// Check if the player pool is exhausted.
const isGameOver = (state) =>
  state.currentPlayerIndex >= state.players.length;

// -- Turn Logic --

// Get the current active player.
const getCurrentPlayer = (state) =>
  state.currentPlayerIndex < state.players.length
    ? state.players[state.currentPlayerIndex]
    : null;

// Get remaining players count (including current).
const getRemainingPlayers = (state) =>
  Math.max(0, state.players.length - state.currentPlayerIndex);

// Count how many cells have been filled so far.
const getFilledCount = (state) =>
  state.cells.filter((c) => c !== null).length;

// Attempt to place the current player in the given cell.
// Returns a new state (immutable). Does NOT advance the player index.
// result.type: 'correct' | 'incorrect'
// If correct: cell is filled; if it completes the board, game is won.
const tryPlacePlayer = (state, cellIndex) => {
  if (state.won) return { ...state, lastResult: null };
  const player = getCurrentPlayer(state);
  if (!player) return { ...state, lastResult: null };
  if (state.cells[cellIndex] !== null) return { ...state, lastResult: null };

  const cellReqs = state.remit[cellIndex];
  const matches = playerMatchesCell(player, cellReqs);

  if (!matches) {
    return { ...state, lastResult: { type: 'incorrect', cellIndex } };
  }

  const newCells = state.cells.map((c, i) =>
    i === cellIndex ? fillCell(player) : c
  );
  const won = checkWin(newCells);
  const completedLines = won ? getCompletedLines(newCells) : state.completedLines;

  return {
    ...state,
    cells: newCells,
    won,
    completedLines,
    lastResult: { type: 'correct', cellIndex },
  };
};

// Advance the player index. penalty=true skips an extra player.
const advancePlayer = (state, penalty = false) => ({
  ...state,
  currentPlayerIndex: state.currentPlayerIndex + (penalty ? 2 : 1),
  lastResult: null,
});

// Run a full turn: try to place, then advance.
// Returns the new state after both operations.
const playTurn = (state, cellIndex) => {
  const afterPlace = tryPlacePlayer(state, cellIndex);
  if (afterPlace.lastResult === null || afterPlace.won) return afterPlace;
  if (afterPlace.lastResult.type === 'incorrect') {
    return advancePlayer(afterPlace, true);
  }
  return advancePlayer(afterPlace, false);
};

// -- Wildcard Logic --

// Auto-fill all empty cells that the current player can satisfy.
const playWildcard = (state) => {
  if (state.won) return state;
  const player = getCurrentPlayer(state);
  if (!player) return state;

  const newCells = state.cells.map((cell, i) => {
    if (cell !== null) return cell;
    const cellReqs = state.remit[i];
    if (playerMatchesCell(player, cellReqs)) {
      return fillCell(player, { wildcard: true });
    }
    return cell;
  });

  const won = checkWin(newCells);
  const completedLines = won ? getCompletedLines(newCells) : state.completedLines;

  return {
    ...state,
    cells: newCells,
    won,
    completedLines,
    lastResult: null,
  };
};

// -- Reveal (endgame) --

// Reveal all possible players for each empty cell.
const revealRemaining = (state) => {
  const usedIds = state.cells
    .filter((c) => c !== null)
    .map((c) => c.id);
  const placedIds = [];
  const newCells = state.cells.map((cell, i) => {
    if (cell !== null) return cell;
    const cellReqs = state.remit[i];
    const candidates = state.players.filter(
      (p) =>
        playerMatchesCell(p, cellReqs) &&
        !usedIds.includes(p.id) &&
        !placedIds.includes(p.id)
    );
    const chosen =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : getMatchingPlayers(state.players, cellReqs).filter(
            (p) => !usedIds.includes(p.id) && !placedIds.includes(p.id)
          )[0];
    if (chosen) placedIds.push(chosen.id);
    const pick = chosen || getMatchingPlayers(state.players, cellReqs)[0];
    return pick
      ? fillCell(pick, { revealed: true })
      : cell;
  });

  const won = checkWin(newCells);
  const completedLines = won ? getCompletedLines(newCells) : state.completedLines;

  return {
    ...state,
    cells: newCells,
    won,
    completedLines,
  };
};

// -- Export --
export {
  // Constants
  GRID_SIZE,
  TOTAL_CELLS,
  // Matching
  playerMatchesCell,
  getMatchingPlayers,
  // Grid
  toGrid,
  lineComplete,
  // Win detection
  checkWin,
  getCompletedLines,
  // Cell state
  formatPlayerName,
  fillCell,
  // Game lifecycle
  createGame,
  restoreGame,
  isGameOver,
  getCurrentPlayer,
  getRemainingPlayers,
  getFilledCount,
  // Turns
  tryPlacePlayer,
  advancePlayer,
  playTurn,
  // Wildcard & reveal
  playWildcard,
  revealRemaining,
};
