import {
  createGame, getCurrentPlayer, getRemainingPlayers,
  getFilledCount, checkWin, getCompletedLines,
  tryPlacePlayer, advancePlayer, playTurn, playWildcard,
  revealRemaining, isGameOver, playerMatchesCell,
  TOTAL_CELLS
} from '../core_logic/bingoEngine.js';

const API_BASE = '/api/bingo';
const MEDIA_BASE = '../media/categories';

let state = null;
let gameData = null;
let gameId = 0;
let AVAILABLE_GAMES = [];
let gameIndex = 0;
let incorrectCellIndex = -1;
let toastTimer = null;
let prevCellKeys = null;

const root = document.getElementById('gameRoot');
const innerContainer = root.querySelector('.inner-container');

const STRINGS = {
  STATS_TITLE: 'Statistics',
  SHARE_IMAGE: 'Share Image',
  TOTAL_TRIES: 'Total Tries',
  STREAK: 'Streak',
  BEST_STREAK: 'Best streak',
  SUCCESS: 'Success',
  TOTAL_GAMES: 'Total Games',
  SUCCESS_RATE: 'Success Rate',
  BEST_BINGO: 'Best BINGO',
  GAME_COPIED: 'Game copied to clipboard',
  GREAT_JOBS: ['Great Job!', 'Awesome!', 'Well done!'],
};

function getStats() {
  try {
    const raw = localStorage.getItem('beyond-bingo_stats');
    if (!raw) return defaultStats();
    return JSON.parse(raw);
  } catch { return defaultStats(); }
}

function defaultStats() {
  return {
    distribution: Array.from({ length: 16 }, () => 0),
    gamesFailed: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalGames: 0,
    successRate: 0,
    leastPlayers: 0,
    last30: [],
  };
}

function saveStats(s) {
  localStorage.setItem('beyond-bingo_stats', JSON.stringify(s));
}

function updateStats(result, playersUsed) {
  const s = { ...getStats() };
  const todayKey = `daily_${gameId}`;
  if (localStorage.getItem(todayKey)) return;
  localStorage.setItem(todayKey, 'played');
  s.totalGames += 1;
  s.distribution[playersUsed - 1] += 1;
  if (!s.leastPlayers || s.leastPlayers > playersUsed) {
    s.leastPlayers = playersUsed;
  }
  if (result === 'lost') {
    s.currentStreak = 0;
    s.gamesFailed += 1;
  } else {
    s.currentStreak += 1;
    if (s.bestStreak < s.currentStreak) s.bestStreak = s.currentStreak;
  }
  s.last30 = [...(s.last30 || []).slice(-29), { game: String(gameId), result: result === 'won' ? 'W' : 'L' }];
  s.successRate = Math.round(100 * (s.totalGames - s.gamesFailed) / Math.max(s.totalGames, 1));
  saveStats(s);
}

function showToast(message, variant = 'success') {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  const bg = variant === 'success' ? 'bg-emerald-500' : 'bg-rose-500';
  el.className = `fixed z-20 left-1/2 -translate-x-1/2 top-24 max-w-sm w-full px-4 toast-enter`;
  el.innerHTML = `<div class="${bg} text-white rounded-lg shadow-lg p-4 text-sm text-center font-medium">${message}</div>`;
  el.classList.remove('hidden');
  toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 2500);
}

function buildShareText(state, playersUsed) {
  const emojis = state.cells.map((c, i) => {
    const nl = (i === 3 || i === 7 || i === 11) ? '\n' : '';
    if (!c) return `⬜${nl}`;
    if (c.wildcard) return `🟨${nl}`;
    return `🟩${nl}`;
  }).join('');
  const bingo = state.won ? `BINGO in ${playersUsed}\n\n` : '';
  return `#FootballBingo ${gameId} ${getFilledCount(state)}/16\n\n${bingo}${emojis}\n\n#PlayFootballGames`;
}

function handleShare(state, playersUsed) {
  const text = buildShareText(state, playersUsed);
  const url = `${window.location.origin}/daily/`;
  if (navigator.share && /mobile|smarttv|wearable/i.test(navigator.userAgent)) {
    navigator.share({ text: text + '\n' + url, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text + '\n\n' + url).then(() => {
      showToast(STRINGS.GAME_COPIED);
    }).catch(() => {});
  }
}

function render(state) {
  const player = getCurrentPlayer(state);
  const remaining = getRemainingPlayers(state);
  const filled = getFilledCount(state);
  const gameOver = state.won || (isGameOver(state) && state.cells.some(c => c !== null));
  const outOfPlayers = isGameOver(state) && !state.won;

  // --- Persistent grid: create once, update cells in-place ---
  let grid = document.getElementById('bingoGrid');
  const isFirstRender = !grid;

  if (isFirstRender) {
    prevCellKeys = [];
    innerContainer.innerHTML = '';
    grid = document.createElement('div');
    grid.id = 'bingoGrid';
    grid.className = 'grid grid-cols-[repeat(4,minmax(90px,110px))] gap-[2px] rounded-xl overflow-hidden border-2 border-white/10 bg-white/5';
    innerContainer.appendChild(grid);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const cell = document.createElement('div');
      cell.dataset.index = i;
      grid.appendChild(cell);
      prevCellKeys[i] = '';
    }
  } else {
    // Remove only non-grid children (header/info/actions)
    const toRemove = [];
    for (const child of innerContainer.children) {
      if (child !== grid) toRemove.push(child);
    }
    toRemove.forEach(el => el.remove());
  }

  // Rebuild card header (no images, always updated)
  const cardHeader = document.createElement('div');
  cardHeader.className = 'relative mb-3 w-full';

  if (state.won) {
    cardHeader.innerHTML = `
      <div class="text-center py-6 px-4 rounded-xl bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 border border-emerald-500/30">
        <div class="text-4xl font-bebas-neue tracking-[0.16em] text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">BINGO!</div>
        <div class="text-white/70 text-sm mt-1">${STRINGS.GREAT_JOBS[Math.floor(Math.random() * STRINGS.GREAT_JOBS.length)]}</div>
        <div class="text-white/50 text-xs mt-1">Completed in ${state.cells.filter(c => c && !c.revealed).length} players</div>
      </div>
    `;
  } else if (isGameOver(state) && !state.won) {
    cardHeader.innerHTML = `
      <div class="text-center py-6 px-4 rounded-xl bg-gradient-to-r from-rose-900/40 to-rose-800/20 border border-rose-500/30">
        <div class="text-2xl font-bebas-neue tracking-[0.16em] text-rose-400">Game Over</div>
        <div class="text-white/70 text-sm mt-1">Better luck tomorrow!</div>
        <button id="revealBtn" class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">Reveal Remaining Players</button>
      </div>
    `;
  } else if (player) {
    const initial = player.g ? player.g.charAt(0).toUpperCase() + '. ' : '';
    const nextPlayerInfo = remaining > 1 ? `<span class="text-white/40 text-xs ml-2">Next: ${remaining - 1} remaining</span>` : '';
    cardHeader.innerHTML = `
      <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">${initial || '?'}</div>
          <div class="min-w-0">
            <div class="font-bold text-sm truncate">${initial}${player.f}</div>
            <div class="text-white/40 text-xs">Place this player</div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="wildcardBtn" class="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors">Wildcard</button>
          <button id="skipBtn" class="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/70 text-xs font-medium hover:bg-white/20 transition-colors">Skip</button>
        </div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-white/40 px-1">
        <span>Progress: ${filled}/16</span>
        <span>${nextPlayerInfo}</span>
      </div>
    `;
  } else {
    cardHeader.innerHTML = `
      <div class="text-center py-4 rounded-xl bg-white/5 border border-white/10">
        <div class="text-white/50 text-sm">No more players available</div>
      </div>
    `;
  }

  grid.before(cardHeader);

  // Update grid cells in-place
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cell = grid.children[i];
    const cellState = state.cells[i];
    const reqs = state.remit[i];
    const shadeClass = (Math.floor(i / 4) + i % 4) % 2 === 0 ? 'bg-black/20' : 'bg-white/5';

    // Compute cell content key and only update DOM if changed
    const newKey = cellState ? `filled:${cellState.playerName}:${cellState.wildcard}:${cellState.revealed}` : 'empty';
    const contentChanged = isFirstRender || prevCellKeys[i] !== newKey;
    prevCellKeys[i] = newKey;

    if (contentChanged) {
      cell.className = `relative flex flex-col items-center justify-center p-1 min-h-[90px] ${shadeClass} transition-all duration-150`;

      if (cellState) {
        const isRevealed = cellState.revealed;
        const reqImages = (reqs || []).map((r) =>
          `<img src="${MEDIA_BASE}/${r.id}.webp" alt="" class="absolute w-4 h-4 opacity-15" style="top:2px;right:2px" loading="lazy" onerror="this.style.display='none'" />`
        ).join('');
        cell.innerHTML = `
          <div class="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">${reqImages}</div>
          <div class="text-center leading-tight px-0.5 flex flex-col items-center justify-center h-full w-full relative z-[1]">
            <div class="text-[10px] sm:text-[11px] font-semibold leading-tight ${isRevealed ? 'text-white/50' : 'text-white'}">${cellState.playerName}</div>
            ${cellState.wildcard ? '<div class="text-[8px] text-amber-200 font-medium mt-0.5">WILDCARD</div>' : ''}
            ${isRevealed ? '<div class="text-[8px] text-white/30 mt-0.5">REVEALED</div>' : ''}
          </div>
        `;
      } else {
        const cellReqs = reqs || [];
        const single = cellReqs.length === 1;
        const parts = cellReqs.map((r) => {
          const imgSrc = `${MEDIA_BASE}/${r.id}.webp`;
          const prefix = r.prefix ? `<span class="opacity-50">${r.prefix} </span>` : '';
          const display = r.displayName || r.name || '';
          return single
            ? `<div class="flex flex-col items-center gap-px">
                <img src="${imgSrc}" alt="${display}" class="w-7 h-7 sm:w-8 sm:h-8 object-contain" loading="lazy" onerror="this.style.display='none'" />
                <span class="text-[9px] sm:text-[10px] leading-tight font-medium">${prefix}${display}</span>
               </div>`
            : `<div class="flex flex-col items-center gap-px">
                <img src="${imgSrc}" alt="${display}" class="w-5 h-5 sm:w-6 sm:h-6 object-contain" loading="lazy" onerror="this.style.display='none'" />
                <span class="text-[7px] sm:text-[8px] leading-tight font-medium">${prefix}${display}</span>
               </div>`;
        });
        cell.innerHTML = `
          <div class="flex items-center justify-center gap-1 h-full w-full px-0.5">
            ${parts.join(cellReqs.length > 1 ? '<span class="text-[8px] text-white/30">+</span>' : '')}
          </div>
        `;
        if (!state.won && !isGameOver(state)) cell.addEventListener('click', () => handleCellClick(i));
      }
    }

    // Always update visual classes (no image impact)
    if (!contentChanged) {
      // Reset dynamic classes only (without touching innerHTML/images)
      cell.classList.remove('cursor-default', 'cursor-pointer', 'hover:scale-[1.03]', 'cell-filled', 'wildcard', 'cell-incorrect', 'line-highlight');
      cell.classList.add(shadeClass);
    }

    if (state.won) {
      cell.classList.add('cursor-default');
    } else if (cellState) {
      cell.classList.add('cursor-default');
    } else if (isGameOver(state)) {
      cell.classList.add('cursor-default');
    } else {
      cell.classList.add('cursor-pointer', 'hover:scale-[1.03]');
    }

    if (cellState) {
      cell.classList.add('cell-filled');
      if (cellState.wildcard) cell.classList.add('wildcard');
    }

    if (i === incorrectCellIndex) {
      cell.classList.add('cell-incorrect');
    }

    if (state.won) {
      const lines = getCompletedLines(state.cells);
      const row = Math.floor(i / 4);
      const col = i % 4;
      const onRow = lines.rows.includes(row);
      const onCol = lines.columns.includes(col);
      const onDiag = (row === col && lines.diagonals.includes(0)) ||
                     (row + col === 3 && lines.diagonals.includes(1));
      if (onRow || onCol || onDiag) {
        cell.classList.add('line-highlight');
      }
    }
  }

  const infobox = document.createElement('div');
  infobox.className = 'w-full text-white text-xs p-5 sm:p-6';
  const categories = state.remit.flat().filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  const hasHelperText = categories.filter(c => c.helperText);
  let infoboxHtml = `
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold uppercase">Technical Area</h3>
    </div>
    <ul class="mb-4">
  `;
  if (hasHelperText.length > 0) {
    hasHelperText.forEach(c => {
      infoboxHtml += `<li class="mb-1"><span translate="no">${c.displayName}: </span><span class="text-white/70">${c.helperText}</span></li>`;
    });
  }
  const hasTeams = categories.some(c => c.type === 2);
  const hasCountries = categories.some(c => c.type === 1);
  if (hasTeams) {
    infoboxHtml += `<li class="mb-1 text-white/70">Team categories only include players who've made the first team - being in the academy doesn't qualify.</li>`;
  }
  if (hasCountries) {
    infoboxHtml += `<li class="mb-1 text-white/70">A player's classification by nation or region is based on the senior team(s) they represented.</li>`;
  }
  infoboxHtml += `</ul><a class="underline text-white/70" href="mailto:beyond-bingo@localhost?subject=Data issue (${gameId})">Report data issue</a>`;
  infobox.innerHTML = infoboxHtml;
  innerContainer.appendChild(infobox);

  if (state.won || isGameOver(state)) {
    const actions = document.createElement('div');
    actions.className = 'flex gap-3 mt-4 w-full';
    actions.innerHTML = `
      <button id="shareBtn" class="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-bold text-white transition-colors">
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" /></svg>
        Share
      </button>
      <button id="playAgainBtn" class="flex-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-3 text-sm font-bold text-white transition-colors">
        Play Again
      </button>
    `;
    innerContainer.appendChild(actions);
    setTimeout(() => {
      document.getElementById('shareBtn')?.addEventListener('click', () => {
        const used = state.cells.filter(c => c && !c.revealed).length;
        handleShare(state, used);
      });
      document.getElementById('playAgainBtn')?.addEventListener('click', () => loadGame(gameId));
    }, 0);
  }

  setTimeout(() => {
    document.getElementById('wildcardBtn')?.addEventListener('click', handleWildcard);
    document.getElementById('skipBtn')?.addEventListener('click', handleSkip);
    document.getElementById('revealBtn')?.addEventListener('click', handleReveal);
  }, 0);
}

function handleCellClick(index) {
  if (!state || state.won || isGameOver(state)) return;
  const player = getCurrentPlayer(state);
  if (!player) return;
  if (state.cells[index] !== null) return;
  const result = tryPlacePlayer(state, index);
  if (result.lastResult?.type === 'incorrect') {
    incorrectCellIndex = index;
    state = advancePlayer(result, true);
    render(state);
    setTimeout(() => { incorrectCellIndex = -1; render(state); }, 500);
    return;
  }
  if (result.lastResult?.type === 'correct') {
    state = advancePlayer(result, false);
    incorrectCellIndex = -1;
    const won = checkWin(result.cells);
    if (won) {
      state = { ...state, won: true, completedLines: getCompletedLines(result.cells) };
      const used = result.cells.filter(c => c && !c.revealed).length;
      updateStats('won', used);
      showToast(STRINGS.GREAT_JOBS[Math.floor(Math.random() * STRINGS.GREAT_JOBS.length)]);
    }
    if (isGameOver(state) && !state.won) {
      updateStats('lost', getFilledCount(state));
    }
    render(state);
    if (won) {
      setTimeout(() => document.getElementById('shareBtn')?.click(), 500);
    }
    return;
  }
  render(state);
}

function handleWildcard() {
  if (!state || state.won) return;
  state = playWildcard(state);
  state = advancePlayer(state, false);
  if (checkWin(state.cells)) {
    state = { ...state, won: true, completedLines: getCompletedLines(state.cells) };
    const used = state.cells.filter(c => c && !c.revealed).length;
    updateStats('won', used);
    showToast('WILDCARD BINGO!');
  }
  if (isGameOver(state) && !state.won) {
    updateStats('lost', getFilledCount(state));
  }
  render(state);
}

function handleSkip() {
  if (!state || state.won) return;
  state = advancePlayer(state, false);
  if (isGameOver(state) && !state.won) {
    updateStats('lost', getFilledCount(state));
  }
  render(state);
}

function handleReveal() {
  if (!state) return;
  state = revealRemaining(state);
  state = { ...state, won: checkWin(state.cells), completedLines: getCompletedLines(state.cells) };
  render(state);
}

function renderPagination() {
  const existing = document.getElementById('gamePagination');
  if (existing) existing.remove();
  const pag = document.createElement('div');
  pag.id = 'gamePagination';
  pag.className = 'flex items-center justify-center gap-4 my-4';
  pag.innerHTML = `
    <button id="prevGameBtn" class="flex items-center gap-1 text-white/50 hover:text-white text-sm font-medium transition-colors ${gameIndex === 0 ? 'opacity-30 pointer-events-none' : ''}">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10.72 11.47a.75.75 0 0 0 0 1.06l7.5 7.5a.75.75 0 1 0 1.06-1.06L12.31 12l6.97-6.97a.75.75 0 0 0-1.06-1.06l-7.5 7.5Z"/><path d="M4.72 11.47a.75.75 0 0 0 0 1.06l7.5 7.5a.75.75 0 1 0 1.06-1.06L6.31 12l6.97-6.97a.75.75 0 0 0-1.06-1.06l-7.5 7.5Z"/></svg>
      Previous
    </button>
    <span class="text-white/40 text-sm font-medium">Game ${gameId}</span>
    <button id="nextGameBtn" class="flex items-center gap-1 text-white/50 hover:text-white text-sm font-medium transition-colors ${gameIndex >= AVAILABLE_GAMES.length - 1 ? 'opacity-30 pointer-events-none' : ''}">
      Next
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.97 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H7.5a.75.75 0 0 1 0-1.5h11.69l-3.22-3.22a.75.75 0 0 1 0-1.06Zm-7.94 9a.75.75 0 0 1 0 1.06l-3.22 3.22H16.5a.75.75 0 0 1 0 1.5H4.81l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z"/></svg>
    </button>
  `;
  innerContainer.after(pag);
  document.getElementById('prevGameBtn')?.addEventListener('click', () => {
    if (gameIndex > 0) { gameIndex--; loadGame(AVAILABLE_GAMES[gameIndex]); }
  });
  document.getElementById('nextGameBtn')?.addEventListener('click', () => {
    if (gameIndex < AVAILABLE_GAMES.length - 1) { gameIndex++; loadGame(AVAILABLE_GAMES[gameIndex]); }
  });
}

async function loadGame(id) {
  const grid = document.getElementById('bingoGrid');
  if (grid) grid.remove();
  const resp = await fetch(`${API_BASE}/${id}`);
  if (!resp.ok) {
    innerContainer.innerHTML = `<div class="text-center py-12 text-white/40"><p>Game ${id} not available.</p></div>`;
    return;
  }
  const data = await resp.json();
  gameId = id;
  gameData = data.gameData;
  state = createGame(gameData);
  incorrectCellIndex = -1;
  render(state);
  renderPagination();
  updateStatsModal();
}

async function initGame() {
  const resp = await fetch(`${API_BASE}/`);
  if (!resp.ok) {
    innerContainer.innerHTML = `<div class="text-center py-12 text-white/40"><p>Cannot load games list. Make sure the API server is running.</p></div>`;
    return;
  }
  const idx = await resp.json();
  AVAILABLE_GAMES = idx.games.map(g => g.id);
  gameIndex = AVAILABLE_GAMES.length - 1;
  loadGame(AVAILABLE_GAMES[gameIndex]);
}

function setupModals() {
  const infoModal = document.getElementById('infoModal');
  const statsModal = document.getElementById('statsModal');
  document.getElementById('infoBtn')?.addEventListener('click', () => infoModal.classList.remove('hidden'));
  document.getElementById('infoClose')?.addEventListener('click', () => infoModal.classList.add('hidden'));
  document.getElementById('statsBtn')?.addEventListener('click', () => {
    updateStatsModal();
    statsModal.classList.remove('hidden');
  });
  document.getElementById('statsClose')?.addEventListener('click', () => statsModal.classList.add('hidden'));
  infoModal?.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.classList.add('hidden'); });
  statsModal?.addEventListener('click', (e) => { if (e.target === statsModal) statsModal.classList.add('hidden'); });
}

function updateStatsModal() {
  const body = document.getElementById('statsBody');
  if (!body) return;
  const s = getStats();
  if (s.totalGames <= 0) {
    body.innerHTML = '<p class="text-white/60">No games played yet.</p>';
    return;
  }
  body.innerHTML = `
    <div class="flex justify-center gap-2 mb-4">
      <div class="text-center w-1/3">
        <div class="text-2xl font-bold text-white">${s.totalGames}</div>
        <div class="text-xs text-white/50">Total Tries</div>
      </div>
      <div class="text-center w-1/3">
        <div class="text-2xl font-bold text-white">${s.currentStreak}</div>
        <div class="text-xs text-white/50">Streak</div>
      </div>
      <div class="text-center w-1/3">
        <div class="text-2xl font-bold text-white">${s.bestStreak}</div>
        <div class="text-xs text-white/50">Best Streak</div>
      </div>
    </div>
    <div class="flex justify-center gap-2">
      <div class="text-center w-1/3">
        <div class="text-2xl font-bold text-white">${s.successRate}%</div>
        <div class="text-xs text-white/50">Success Rate</div>
      </div>
      ${s.leastPlayers ? `
      <div class="text-center w-1/3">
        <div class="text-2xl font-bold text-white">${s.leastPlayers}</div>
        <div class="text-xs text-white/50">Best BINGO</div>
      </div>` : ''}
    </div>
  `;
}

function boot() {
  setupModals();
  initGame();
}

document.addEventListener('DOMContentLoaded', boot);
