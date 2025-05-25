const WebSocket = require('ws');
const pool = require('./database');

let wss;

function broadcastLobbyState() {
  if (!wss) return;
  fetchLobbyState().then((lobbyState) => {
    const message = JSON.stringify({ type: 'lobby_update', data: lobbyState });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
}

async function fetchLobbyState() {
  const gamesQ = `SELECT id, name FROM games WHERE status = 'lobby'`;
  const { rows: games } = await pool.query(gamesQ);
  for (const game of games) {
    const playersQ = `SELECT id, name, status FROM players WHERE game_id = $1`;
    const { rows: players } = await pool.query(playersQ, [game.id]);
    game.players = players;
  }
  return { games };
}

function startLobbyWebSocketServer(server) {
  wss = new WebSocket.Server({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/lobby') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  wss.on('connection', (ws) => {
    // Send initial lobby state
    fetchLobbyState().then((lobbyState) => {
      ws.send(JSON.stringify({ type: 'lobby_update', data: lobbyState }));
    });
  });
}

module.exports = { startLobbyWebSocketServer, broadcastLobbyState }; 