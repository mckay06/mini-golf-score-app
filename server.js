const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3010);
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const leaderboardFile = process.env.MINIGOLF_LEADERBOARD_FILE || path.join(dataDir, 'leaderboard.json');
const holeCount = 8;
const maxLeaderboardEntries = 100;
const ADMIN_KEY = process.env.ADMIN_KEY || 'hydra';

function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ADMIN_KEY}`) return next();
  res.status(401).json({ error: 'Non autorisé.' });
}

ensureStorage();

app.use(express.json({ limit: '200kb' }));
app.use('/mini-golf', express.static(publicDir, { extensions: ['html'] }));

app.get('/', (_req, res) => { res.redirect('/mini-golf'); });

app.get('/mini-golf', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/api/mini-golf/config', (_req, res) => {
  res.json({
    venueName: 'Action Golf x VR Infini',
    courseName: 'Parcours fluorescent 8 pistes',
    holeCount,
    minScore: 1,
    maxScore: 8,
  });
});

app.get('/api/mini-golf/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/mini-golf/leaderboard', (_req, res) => {
  const rounds = readRounds();
  const monthlyRounds = filterRoundsForCurrentMonth(rounds);
  const leaderboard = buildLeaderboard(monthlyRounds);
  const recent = monthlyRounds
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 8)
    .map(toPublicRound);

  res.json({
    leaderboard,
    recent,
    stats: buildStats(monthlyRounds),
    periodLabel: getCurrentMonthLabel(),
  });
});

app.post('/api/mini-golf/scores', (req, res) => {
  const parsed = parseRound(req.body);

  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const rounds = readRounds();
  rounds.push(parsed.round);
  const trimmedRounds = rounds
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, maxLeaderboardEntries);

  fs.writeFileSync(leaderboardFile, JSON.stringify(trimmedRounds, null, 2), 'utf8');

  const leaderboard = buildLeaderboard(trimmedRounds);
  const rank = leaderboard.findIndex((entry) => entry.id === parsed.round.id) + 1;

  return res.status(201).json({
    message: 'Score enregistré',
    round: toPublicRound(parsed.round),
    rank,
    leaderboard,
  });
});

app.get('/api/mini-golf/admin/scores', requireAdmin, (_req, res) => {
  const rounds = readRounds();
  res.json(rounds.map(toPublicRound));
});

app.delete('/api/mini-golf/scores/:id', requireAdmin, (req, res) => {
  const rounds = readRounds();
  const filtered = rounds.filter((r) => r.id !== req.params.id);
  if (filtered.length === rounds.length) {
    return res.status(404).json({ error: 'Score introuvable.' });
  }
  fs.writeFileSync(leaderboardFile, JSON.stringify(filtered, null, 2), 'utf8');
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Mini-golf app running at http://localhost:${port}/mini-golf`);
  });
}

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(leaderboardFile)) {
    fs.writeFileSync(leaderboardFile, '[]\n', 'utf8');
  }
}

function readRounds() {
  try {
    const raw = fs.readFileSync(leaderboardFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function parseRound(body) {
  const teamName = String(body?.teamName || '').trim();
  const players = Array.isArray(body?.players) ? body.players : [];

  if (teamName.length < 2) {
    return { ok: false, error: 'Entre un nom d équipe.' };
  }

  if (teamName.length > 40) {
    return { ok: false, error: 'Le nom d équipe est trop long.' };
  }

  if (players.length < 1) {
    return { ok: false, error: 'Ajoute au moins un joueur à l équipe.' };
  }

  if (players.length > 5) {
    return { ok: false, error: 'Maximum 5 joueurs par équipe.' };
  }

  const normalizedPlayers = [];

  for (const player of players) {
    const cleanPlayer = String(player?.name || '').trim().replace(/\s+/g, ' ');
    const playerScores = Array.isArray(player?.scores) ? player.scores : [];

    if (cleanPlayer.length < 2) {
      return { ok: false, error: 'Chaque joueur doit avoir au moins 2 caractères.' };
    }

    if (cleanPlayer.length > 24) {
      return { ok: false, error: 'Un nom de joueur est trop long.' };
    }

    if (playerScores.length !== holeCount) {
      return { ok: false, error: `Chaque joueur doit avoir ${holeCount} scores.` };
    }

    const normalizedScores = [];

    for (const value of playerScores) {
      const numeric = Number(value);

      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 8) {
        return { ok: false, error: 'Chaque score doit être un entier entre 1 et 8.' };
      }

      normalizedScores.push(numeric);
    }

    normalizedPlayers.push({
      name: cleanPlayer,
      scores: normalizedScores,
      total: normalizedScores.reduce((sum, score) => sum + score, 0),
    });
  }

  if (new Set(normalizedPlayers.map((player) => player.name.toLowerCase())).size !== normalizedPlayers.length) {
    return { ok: false, error: 'Chaque joueur doit être unique dans l équipe.' };
  }

  const total = normalizedPlayers.reduce((sum, player) => sum + player.total, 0);
  const cleanTeamName = teamName.replace(/\s+/g, ' ');

  return {
    ok: true,
    round: {
      id: createId(),
      teamName: cleanTeamName,
      players: normalizedPlayers,
      total,
      submittedAt: new Date().toISOString(),
    },
  };
}

function buildLeaderboard(rounds) {
  return rounds
    .slice()
    .sort((a, b) => {
      if (a.total !== b.total) {
        return a.total - b.total;
      }

      return new Date(a.submittedAt) - new Date(b.submittedAt);
    })
    .slice(0, 5)
    .map((round, index) => ({
      rank: index + 1,
      ...toPublicRound(round),
    }));
}

function buildStats(rounds) {
  if (rounds.length === 0) {
    return {
      roundsCount: 0,
      averageTotal: null,
      bestTotal: null,
    };
  }

  const totals = rounds.map((round) => round.total);
  const averageTotal = totals.reduce((sum, total) => sum + total, 0) / totals.length;

  return {
    roundsCount: rounds.length,
    averageTotal: Math.round(averageTotal * 10) / 10,
    bestTotal: Math.min(...totals),
  };
}

function filterRoundsForCurrentMonth(rounds) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return rounds.filter((round) => {
    const submittedAt = new Date(round.submittedAt);

    return submittedAt.getFullYear() === year && submittedAt.getMonth() === month;
  });
}

function getCurrentMonthLabel() {
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function toPublicRound(round) {
  const teamName = round.teamName || round.playerName || 'Equipe';
  const players = normalizePlayers(round);

  return {
    id: round.id,
    teamName,
    players,
    total: round.total,
    submittedAt: round.submittedAt,
  };
}

function normalizePlayers(round) {
  if (Array.isArray(round.players) && round.players.length) {
    if (typeof round.players[0] === 'string') {
      return round.players.map((playerName) => ({
        name: playerName,
        scores: [],
        total: null,
      }));
    }

    return round.players.map((player) => ({
      name: player.name,
      scores: Array.isArray(player.scores) ? player.scores : [],
      total: Number.isInteger(player.total)
        ? player.total
        : Array.isArray(player.scores)
          ? player.scores.reduce((sum, score) => sum + score, 0)
          : null,
    }));
  }

  if (round.playerName) {
    return [{
      name: round.playerName,
      scores: Array.isArray(round.scores) ? round.scores : [],
      total: round.total ?? null,
    }];
  }

  return [];
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { app };