const state = {
  config: {
    holeCount: 8,
    minScore: 1,
    maxScore: 8,
  },
  teamName: '',
  playerCount: 2,
  players: [],
  currentHole: 0,
  currentPlayerIndex: 0,
  submittedRound: null,
};

const elements = {};
const STORAGE_KEY = 'vrinfini-mini-golf-drafts-v5';
const COOKIE_NAME = 'minigolf_session';
const COOKIE_MAX_AGE = 86400; // 24 h
let leaderboardRefreshTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  bindEvents();
  renderPlayerFields();
  drawQuickpick();
  drawHoleTrack();
  await Promise.all([loadConfig(), loadLeaderboard()]);
  startLeaderboardRefresh();

  // Auto-show resume if this device has a draft
  const myDraft = readDraft();
  if (myDraft && Array.isArray(myDraft.players) && myDraft.players.length > 0) {
    restoreDraftPreview();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});

function cacheElements() {
  elements.setupForm = document.getElementById('setup-form');
  elements.hero = document.getElementById('hero');
  elements.teamName = document.getElementById('team-name');
  elements.playerCount = document.getElementById('player-count');
  elements.playerFields = document.getElementById('player-fields');
  elements.playersCount = document.getElementById('players-count');
  elements.gamePanel = document.getElementById('game-panel');
  elements.summaryPanel = document.getElementById('summary-panel');
  elements.successPanel = document.getElementById('success-panel');
  elements.holeTitle = document.getElementById('hole-title');
  elements.currentPlayer = document.getElementById('current-player');
  elements.progressPill = document.getElementById('progress-pill');
  elements.currentScore = document.getElementById('current-score');
  elements.quickpick = document.getElementById('quickpick');
  elements.prevHole = document.getElementById('prev-hole');
  elements.nextHole = document.getElementById('next-hole');
  elements.holeTrack = document.getElementById('hole-track');
  elements.summaryName = document.getElementById('summary-name');
  elements.summaryPlayers = document.getElementById('summary-players');
  elements.summaryTotal = document.getElementById('summary-total');
  elements.summaryGrid = document.getElementById('summary-grid');
  elements.submitScore = document.getElementById('submit-score');
  elements.editScore = document.getElementById('edit-score');
  elements.newGame = document.getElementById('new-game');
  elements.openLeaderboard = document.getElementById('open-leaderboard');
  elements.successTitle = document.getElementById('success-title');
  elements.successCopy = document.getElementById('success-copy');
  elements.statusMessage = document.getElementById('status-message');
  elements.leaderboardList = document.getElementById('leaderboard-list');
  elements.recentList = document.getElementById('recent-list');
  elements.statsAverage = document.getElementById('stats-average');
  elements.statsBest = document.getElementById('stats-best');
  elements.decreaseScore = document.getElementById('decrease-score');
  elements.increaseScore = document.getElementById('increase-score');
  elements.resumeGame = document.getElementById('resume-game');
  elements.refreshLeaderboard = document.getElementById('refresh-leaderboard');
  elements.leaderboardUpdated = document.getElementById('leaderboard-updated');
  elements.venueName = document.getElementById('venue-name');
  elements.courseName = document.getElementById('course-name');
  elements.leaderboardTitle = document.querySelector('.card--leaderboard .card__head h2');
  elements.leaderboardCard = document.getElementById('leaderboard-card');
  elements.recentKicker = document.querySelector('.recent-rounds .card__kicker');
}

function bindEvents() {
  elements.setupForm.addEventListener('submit', startGame);
  elements.playerCount.addEventListener('change', () => {
    state.playerCount = clamp(Number(elements.playerCount.value) || 2, 1, 5);
    renderPlayerFields();
    saveDraftPreview();
  });
  elements.prevHole.addEventListener('click', goToPreviousStep);
  elements.nextHole.addEventListener('click', goToNextStep);
  elements.submitScore.addEventListener('click', submitRound);
  elements.editScore.addEventListener('click', () => showPanel('game'));
  elements.newGame.addEventListener('click', resetGame);
  elements.openLeaderboard.addEventListener('click', () => {
    document.querySelector('.card--leaderboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  elements.decreaseScore.addEventListener('click', () => adjustScore(-1));
  elements.increaseScore.addEventListener('click', () => adjustScore(1));
  elements.resumeGame.addEventListener('click', resumeDraftGame);
  elements.refreshLeaderboard.addEventListener('click', () => {
    loadLeaderboard(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      loadLeaderboard(true);
    }
  });
}

async function loadConfig() {
  try {
    const response = await fetch('/api/mini-golf/config');
    if (!response.ok) {
      return;
    }

    const config = await response.json();
    state.config = config;
    drawQuickpick();
    drawHoleTrack();
    refreshGamePanel();
  } catch {}
}

async function loadLeaderboard(showStatus = false) {
  try {
    const response = await fetch('/api/mini-golf/leaderboard');
    if (!response.ok) {
      throw new Error('Classement indisponible');
    }

    const payload = await response.json();
    renderLeaderboard(payload.leaderboard || []);
    renderRecent(payload.recent || []);
    renderStats(payload.stats || {});

    if (payload.periodLabel) {
      elements.leaderboardTitle.textContent = `Top ${capitalizeFirst(payload.periodLabel)}`;
      elements.recentKicker.textContent = `Scores de ${payload.periodLabel}`;
      elements.leaderboardUpdated.textContent = `Classement de ${payload.periodLabel}`;
    }

    if (showStatus) {
      setStatus('Classement actualis\u00e9.', 'success');
    }
  } catch {
    renderLeaderboard([]);
    renderRecent([]);
    renderStats({});
    elements.leaderboardUpdated.textContent = 'Classement indisponible';

    if (showStatus) {
      setStatus('Impossible de rafra\u00eechir le classement.', 'error');
    }
  }
}

function renderPlayerFields() {
  const currentNames = getPlayerFieldNames();
  const count = clamp(Number(elements.playerCount?.value) || state.playerCount || 2, 1, 5);

  state.playerCount = count;
  if (elements.playerCount) {
    elements.playerCount.value = String(count);
  }

  elements.playersCount.textContent = `${count} joueur${count > 1 ? 's' : ''}`;
  elements.playerFields.innerHTML = Array.from({ length: count }, (_, index) => `
    <label class="player-field">
      <strong>Joueur ${index + 1}</strong>
      <input type="text" data-player-name="${index}" maxlength="24" placeholder="Ex. Joueur ${index + 1}" value="${escapeAttribute(currentNames[index] || '')}">
    </label>
  `).join('');

  elements.playerFields.querySelectorAll('[data-player-name]').forEach((input) => {
    input.addEventListener('input', saveDraftPreview);
  });
}

function startGame(event) {
  event.preventDefault();

  const teamName = normalizeName(elements.teamName.value);
  const playerNames = getPlayerFieldNames();

  if (teamName.length < 2) {
    setStatus('Entre un nom d\u2019\u00e9quipe.', 'error');
    return;
  }

  if (playerNames.length !== state.playerCount) {
    setStatus('Renseigne tous les noms des joueurs.', 'error');
    return;
  }

  if (new Set(playerNames.map((name) => name.toLowerCase())).size !== playerNames.length) {
    setStatus('Chaque joueur doit avoir un nom diff\u00e9rent.', 'error');
    return;
  }

  state.teamName = teamName;
  state.players = playerNames.map((name) => ({
    name,
    scores: new Array(state.config.holeCount).fill(state.config.minScore),
  }));
  state.currentHole = 0;
  state.currentPlayerIndex = 0;
  state.submittedRound = null;
  refreshGamePanel();
  saveDraft();
  showPanel('game');
  setStatus('\u00c9quipe cr\u00e9\u00e9e. Saisis les coups de chaque joueur.', 'success');
}

function getPlayerFieldNames() {
  return Array.from(document.querySelectorAll('[data-player-name]'))
    .map((input) => normalizeName(input.value))
    .filter(Boolean);
}

function goToPreviousStep() {
  if (!state.players.length) {
    return;
  }

  if (state.currentPlayerIndex > 0) {
    state.currentPlayerIndex -= 1;
  } else if (state.currentHole > 0) {
    state.currentHole -= 1;
    state.currentPlayerIndex = state.players.length - 1;
  } else {
    return;
  }

  refreshGamePanel();
  saveDraft();
}

function goToNextStep() {
  if (!state.players.length) {
    return;
  }

  if (state.currentPlayerIndex < state.players.length - 1) {
    state.currentPlayerIndex += 1;
    refreshGamePanel();
    saveDraft();
    return;
  }

  if (state.currentHole < state.config.holeCount - 1) {
    state.currentHole += 1;
    state.currentPlayerIndex = 0;
    refreshGamePanel();
    saveDraft();
    return;
  }

  renderSummary();
  showPanel('summary');
  saveDraft();
  submitRound();
}

function adjustScore(delta) {
  const player = state.players[state.currentPlayerIndex];
  if (!player) {
    return;
  }

  const nextValue = clamp(
    player.scores[state.currentHole] + delta,
    state.config.minScore,
    state.config.maxScore,
  );

  player.scores[state.currentHole] = nextValue;
  refreshGamePanel();
  saveDraft();
}

function setHoleScore(score) {
  const player = state.players[state.currentPlayerIndex];
  if (!player) {
    return;
  }

  player.scores[state.currentHole] = clamp(score, state.config.minScore, state.config.maxScore);
  refreshGamePanel();
  saveDraft();
}

function refreshGamePanel() {
  const player = state.players[state.currentPlayerIndex];
  const score = player ? player.scores[state.currentHole] : state.config.minScore;

  elements.holeTitle.textContent = `Piste ${state.currentHole + 1}`;
  elements.currentPlayer.textContent = player
    ? player.name
    : '';
  elements.progressPill.textContent = `${state.currentHole + 1} / ${state.config.holeCount}`;
  elements.currentScore.textContent = score;
  elements.prevHole.disabled = state.currentHole === 0 && state.currentPlayerIndex === 0;
  elements.nextHole.textContent = isLastStep() ? 'Voir le r\u00e9capitulatif' : 'Valider le joueur';
  updateQuickpickState();
  drawHoleTrack();
}

function isLastStep() {
  return state.currentHole === state.config.holeCount - 1 && state.currentPlayerIndex === state.players.length - 1;
}

function renderSummary() {
  const total = getTeamTotal();
  elements.summaryName.textContent = state.teamName;
  elements.summaryPlayers.textContent = `${state.players.length} joueur${state.players.length > 1 ? 's' : ''}`;
  elements.summaryTotal.textContent = total;
  const bestTotal = Math.min(...state.players.map(getPlayerTotal));
  elements.summaryGrid.innerHTML = state.players
    .map((player) => {
      const total = getPlayerTotal(player);
      const isWinner = total === bestTotal;
      const min = Math.min(...player.scores);
      const max = Math.max(...player.scores);
      const boxes = player.scores.map((score, index) => {
        let cls = 'score-box';
        if (score === min) cls += ' score-box--best';
        else if (score === max) cls += ' score-box--worst';
        return `<span class="${cls}" title="Piste ${index + 1}">${score}</span>`;
      }).join('');
      return `
        <div class="summary-hole${isWinner ? ' summary-hole--winner' : ''}">
          <div class="summary-hole__header">
            <span class="summary-hole__name">
              ${isWinner ? '<span class="summary-hole__crown">🏆</span>' : ''}
              ${escapeHtml(player.name)}
            </span>
            <span class="summary-hole__total">${total} coups</span>
          </div>
          <div class="score-boxes">${boxes}</div>
        </div>
      `;
    })
    .join('');
}

async function submitRound() {
  const payload = {
    teamName: state.teamName,
    players: state.players.map((player) => ({
      name: player.name,
      scores: player.scores,
    })),
  };

  elements.submitScore.disabled = true;
  setStatus('Envoi du score...', '');

  try {
    const response = await fetch('/api/mini-golf/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Impossible d\u2019enregistrer le score.');
    }

    state.submittedRound = result.round;
    elements.successTitle.textContent = `Top ${result.rank}`;
    elements.successCopy.textContent = `${result.round.teamName}, votre total \u00e9quipe est de ${result.round.total} coups.`;
    clearDraft();
    showPanel('success');
    setStatus('Score enregistr\u00e9 dans le classement.', 'success');
    renderLeaderboard(result.leaderboard || []);
    await loadLeaderboard();
  } catch (error) {
    setStatus(error.message, 'error');
    elements.submitScore.classList.remove('hidden');
    elements.editScore.classList.remove('hidden');
  } finally {
    elements.submitScore.disabled = false;
  }
}

function resetGame() {
  state.teamName = '';
  state.playerCount = 2;
  state.players = [];
  state.currentHole = 0;
  state.currentPlayerIndex = 0;
  state.submittedRound = null;
  elements.teamName.value = '';
  elements.playerCount.value = '2';
  renderPlayerFields();
  clearDraft();
  refreshGamePanel();
  showPanel('setup');
  setStatus('Pr\u00eat pour une nouvelle \u00e9quipe.', '');
}

function showPanel(panel) {
  elements.gamePanel.classList.toggle('hidden', panel !== 'game');
  elements.summaryPanel.classList.toggle('hidden', panel !== 'summary');
  elements.successPanel.classList.toggle('hidden', panel !== 'success');
  elements.setupForm.classList.toggle('hidden', panel !== 'setup');
  elements.leaderboardCard.classList.toggle('hidden', panel !== 'success');
  elements.hero.classList.toggle('hidden', panel !== 'setup');
}

function drawQuickpick() {
  const buttons = [];

  for (let score = state.config.minScore; score <= state.config.maxScore; score += 1) {
    buttons.push(`<button class="quickpick-btn" type="button" data-score="${score}">${score}</button>`);
  }

  elements.quickpick.innerHTML = buttons.join('');
  elements.quickpick.querySelectorAll('[data-score]').forEach((button) => {
    button.addEventListener('click', () => {
      setHoleScore(Number(button.dataset.score));
    });
  });

  updateQuickpickState();
}

function updateQuickpickState() {
  const player = state.players[state.currentPlayerIndex];
  const activeScore = player ? player.scores[state.currentHole] : state.config.minScore;

  elements.quickpick.querySelectorAll('[data-score]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.score) === activeScore);
  });
}

function drawHoleTrack() {
  elements.holeTrack.innerHTML = Array.from({ length: state.config.holeCount }, (_, index) => {
    const classes = ['hole-dot'];

    if (index === state.currentHole) {
      classes.push('is-active');
    } else if (index < state.currentHole) {
      classes.push('is-complete');
    }

    return `<button class="${classes.join(' ')}" type="button" data-hole-index="${index}" aria-label="Aller \u00e0 la piste ${index + 1}">${index + 1}</button>`;
  }).join('');

  elements.holeTrack.querySelectorAll('[data-hole-index]').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentHole = Number(button.dataset.holeIndex);
      state.currentPlayerIndex = 0;
      refreshGamePanel();
      saveDraft();
    });
  });
}

function renderLeaderboard(entries) {
  if (!entries.length) {
    elements.leaderboardList.innerHTML = '<li class="leaderboard-item"><div class="leaderboard-main"><strong>Aucun score pour l\u2019instant</strong><span>La premi\u00e8re \u00e9quipe lance le classement.</span></div></li>';
    return;
  }

  elements.leaderboardList.innerHTML = entries
    .map((entry) => {
      const names = entry.players.map((player) => player.name).join(', ');
      return `
        <li class="leaderboard-item">
          <div class="leaderboard-rank">${entry.rank}</div>
          <div class="leaderboard-main">
            <strong>${escapeHtml(entry.teamName)}</strong>
            <span>${entry.players.length} joueur${entry.players.length > 1 ? 's' : ''}</span>
            <em>${escapeHtml(names)}</em>
          </div>
          <div class="leaderboard-total">
            <strong>${entry.total}</strong>
            <span>coups</span>
          </div>
        </li>
      `;
    })
    .join('');
}

function renderRecent(entries) {
  if (!entries.length) {
    elements.recentList.innerHTML = '<li class="recent-item"><div><strong>Pas encore de partie</strong><span>Les derni\u00e8res \u00e9quipes appara\u00eetront ici.</span></div></li>';
    return;
  }

  elements.recentList.innerHTML = entries
    .map((entry) => {
      const names = entry.players.map((player) => player.name).join(', ');
      return `
        <li class="recent-item">
          <div>
            <strong>${escapeHtml(entry.teamName)}</strong>
            <span>${entry.players.length} joueur${entry.players.length > 1 ? 's' : ''}</span>
            <em>${escapeHtml(names)}</em>
          </div>
          <strong>${entry.total}</strong>
        </li>
      `;
    })
    .join('');
}

function renderStats(stats) {
  elements.statsAverage.textContent = stats.averageTotal ?? '-';
  elements.statsBest.textContent = stats.bestTotal ?? '-';
}

function setStatus(message, kind) {
  elements.statusMessage.textContent = message || '';
  elements.statusMessage.className = 'status-message';

  if (kind === 'error') {
    elements.statusMessage.classList.add('is-error');
  }

  if (kind === 'success') {
    elements.statusMessage.classList.add('is-success');
  }
}

function getSessionId() {
  const cookies = document.cookie.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(COOKIE_NAME + '='));
  if (match) return match.split('=')[1];
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  return id;
}

function refreshSessionCookie() {
  const id = getSessionId();
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readAllDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
  } catch {
    return {};
  }
}

function writeAllDrafts(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function saveDraftPreview() {
  const teamName = normalizeName(elements.teamName.value);
  const names = getPlayerFieldNames();
  if (!teamName) return;

  const sid = getSessionId();
  const drafts = readAllDrafts();
  drafts[sid] = {
    teamName,
    playerCount: clamp(Number(elements.playerCount.value) || 2, 1, 5),
    playerNames: names,
    players: [],
    currentHole: 0,
    currentPlayerIndex: 0,
  };
  writeAllDrafts(drafts);
  refreshSessionCookie();
}

function saveDraft() {
  if (!state.teamName) return;

  const sid = getSessionId();
  const drafts = readAllDrafts();
  drafts[sid] = {
    teamName: state.teamName,
    playerCount: state.players.length,
    playerNames: state.players.map((p) => p.name),
    players: state.players,
    currentHole: state.currentHole,
    currentPlayerIndex: state.currentPlayerIndex,
  };
  writeAllDrafts(drafts);
  refreshSessionCookie();
}

function restoreDraftPreview() {
  const draft = readDraft();
  const hasDraft = Boolean(draft && Array.isArray(draft.players) && draft.players.length > 0);

  elements.resumeGame.classList.toggle('hidden', !hasDraft);
  if (hasDraft) {
    const holeNumber = Number(draft.currentHole) + 1;
    const playerNumber = Number(draft.currentPlayerIndex) + 1;
    elements.resumeGame.textContent = `Reprendre ${escapeHtml(draft.teamName)} \u2014 Piste ${holeNumber} Joueur ${playerNumber}`;
  }
}

function resumeDraftGame() {
  const draft = readDraft();

  if (!draft) {
    restoreDraftPreview();
    return;
  }

  state.teamName = draft.teamName || '';
  state.playerCount = clamp(Number(draft.playerCount) || 2, 1, 5);
  state.players = Array.isArray(draft.players) && draft.players.length
    ? draft.players.map((player) => ({
        name: player.name,
        scores: Array.isArray(player.scores) ? player.scores : new Array(state.config.holeCount).fill(state.config.minScore),
      }))
    : (draft.playerNames || []).map((name) => ({
        name,
        scores: new Array(state.config.holeCount).fill(state.config.minScore),
      }));
  state.currentHole = clamp(Number(draft.currentHole) || 0, 0, state.config.holeCount - 1);
  state.currentPlayerIndex = clamp(Number(draft.currentPlayerIndex) || 0, 0, Math.max(state.players.length - 1, 0));
  state.submittedRound = null;

  elements.teamName.value = state.teamName;
  elements.playerCount.value = String(state.playerCount);
  renderPlayerFields();
  Array.from(document.querySelectorAll('[data-player-name]')).forEach((input, index) => {
    input.value = state.players[index]?.name || '';
  });

  refreshSessionCookie();
  refreshGamePanel();
  showPanel('game');
  setStatus('Partie restaur\u00e9e.', 'success');
}

function clearDraft() {
  const sid = getSessionId();
  const drafts = readAllDrafts();
  delete drafts[sid];
  writeAllDrafts(drafts);
  elements.resumeGame.classList.add('hidden');
}

function readDraft() {
  const sid = getSessionId();
  return readAllDrafts()[sid] || null;
}

function startLeaderboardRefresh() {
  if (leaderboardRefreshTimer) {
    clearInterval(leaderboardRefreshTimer);
  }

  leaderboardRefreshTimer = setInterval(() => {
    if (!document.hidden) {
      loadLeaderboard();
    }
  }, 20000);
}

function getPlayerTotal(player) {
  return player.scores.reduce((sum, score) => sum + score, 0);
}

function getTeamTotal() {
  return state.players.reduce((sum, player) => sum + getPlayerTotal(player), 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function capitalizeFirst(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
