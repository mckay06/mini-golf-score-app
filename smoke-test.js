const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const rootDir = path.resolve(__dirname, '..');
const port = 3011;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-golf-smoke-'));
const tempLeaderboardFile = path.join(tempDir, 'leaderboard.json');

fs.writeFileSync(tempLeaderboardFile, '[]\n', 'utf8');

const serverProcess = spawn(process.execPath, ['mini-golf-score-app/server.js'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: String(port),
    MINIGOLF_LEADERBOARD_FILE: tempLeaderboardFile,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

serverProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
serverProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
}).finally(async () => {
  await stopServer();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function run() {
  await waitForHealth();

  const config = await requestJson('GET', '/api/mini-golf/config');
  assert(config.holeCount === 8, 'Config invalide: holeCount attendu à 8.');
  assert(config.maxScore === 8, 'Config invalide: maxScore attendu à 8.');

  const payload = {
    teamName: 'Smoke Team',
    players: [
      {
        name: 'Lea',
        scores: [2, 3, 2, 3, 2, 3, 2, 3],
      },
      {
        name: 'Tom',
        scores: [3, 2, 3, 2, 3, 2, 3, 2],
      },
    ],
  };

  const postResult = await requestJson('POST', '/api/mini-golf/scores', payload);
  assert(postResult.round.total === 40, 'Total attendu à 40 pour le score de test.');
  assert(postResult.rank === 1, 'Le score de test devrait être premier.');

  const leaderboard = await requestJson('GET', '/api/mini-golf/leaderboard');
  assert(Array.isArray(leaderboard.leaderboard), 'Le classement doit être une liste.');
  assert(leaderboard.leaderboard.length === 1, 'Le classement devrait contenir une partie.');
  assert(leaderboard.leaderboard[0].teamName === 'Smoke Team', 'L équipe de test devrait apparaître dans le classement.');
  assert(leaderboard.leaderboard[0].players.length === 2, 'L équipe de test devrait contenir deux joueurs.');
  assert(leaderboard.leaderboard[0].players[0].total === 20, 'Le premier joueur devrait avoir un total de 20.');

  console.log('Mini-golf smoke test: OK');
}

function waitForHealth() {
  const timeoutAt = Date.now() + 15000;

  return new Promise((resolve, reject) => {
    const tryConnect = async () => {
      try {
        const health = await requestJson('GET', '/api/mini-golf/health');
        if (health.ok) {
          resolve();
          return;
        }
      } catch {
        if (Date.now() > timeoutAt) {
          reject(new Error('Le serveur mini-golf ne répond pas au health check.'));
          return;
        }
      }

      setTimeout(tryConnect, 250);
    };

    tryConnect();
  });
}

function requestJson(method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (response) => {
        let raw = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : null;

            if (response.statusCode >= 400) {
              reject(new Error(parsed?.error || `Requête ${route} en erreur ${response.statusCode}.`));
              return;
            }

            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess.exitCode !== null || serverProcess.killed) {
      resolve();
      return;
    }

    serverProcess.once('exit', () => resolve());
    serverProcess.kill();
  });
}