const WebSocket = require('ws');
const pool = require('./database');

let wss;
// Map from ws client to { gameId, playerId }
const clientInfoMap = new Map();
// Map from gameId to Set of ws clients
const gameClientsMap = new Map();
// Map from gameId to Set of playerIds
const gamePlayersMap = new Map();
// Map from gameId:playerId to disconnect timeout
const disconnectTimers = new Map();

const DISCONNECT_TIMEOUT_MS = 60000; // 60 seconds

function broadcastGameEvent(gameId, event) {
  const clients = gameClientsMap.get(gameId);
  if (!clients) return;
  const message = JSON.stringify(event);
  console.log('[WS SEND] broadcastGameEvent', { gameId, event });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function broadcastPresence(gameId) {
  const playerIds = Array.from(gamePlayersMap.get(gameId) || []);
  broadcastGameEvent(gameId, { type: 'presence', data: { playerIds } });
}

function getOnlinePlayerIds(gameId) {
  return Array.from(gamePlayersMap.get(gameId) || []);
}

function broadcastGameRoomState(gameId, state) {
  if (!wss) return;
  console.log('[WS SEND] broadcastGameRoomState', { gameId, state });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.gameId === gameId) {
      client.send(JSON.stringify({ type: 'state_update', data: state }));
    }
  });
}

function startGameRoomWebSocketServer(server) {
  wss = new WebSocket.Server({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/game') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'subscribe' && data.gameId && data.playerId) {
          // Remove from previous game if any
          const prev = clientInfoMap.get(ws);
          if (prev && prev.gameId && gameClientsMap.has(prev.gameId)) {
            gameClientsMap.get(prev.gameId).delete(ws);
            if (prev.playerId && gamePlayersMap.has(prev.gameId)) {
              gamePlayersMap.get(prev.gameId).delete(prev.playerId);
              broadcastPresence(prev.gameId);
            }
            // Cancel disconnect timer if reconnecting
            const timerKey = `${prev.gameId}:${prev.playerId}`;
            if (disconnectTimers.has(timerKey)) {
              clearTimeout(disconnectTimers.get(timerKey));
              disconnectTimers.delete(timerKey);
            }
          }
          // Add to new game
          clientInfoMap.set(ws, { gameId: data.gameId, playerId: data.playerId });
          if (!gameClientsMap.has(data.gameId)) {
            gameClientsMap.set(data.gameId, new Set());
          }
          if (!gamePlayersMap.has(data.gameId)) {
            gamePlayersMap.set(data.gameId, new Set());
          }
          gameClientsMap.get(data.gameId).add(ws);
          gamePlayersMap.get(data.gameId).add(data.playerId);
          broadcastPresence(data.gameId);
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });
    ws.on('close', () => {
      const info = clientInfoMap.get(ws);
      if (info && info.gameId && gameClientsMap.has(info.gameId)) {
        gameClientsMap.get(info.gameId).delete(ws);
        if (info.playerId && gamePlayersMap.has(info.gameId)) {
          gamePlayersMap.get(info.gameId).delete(info.playerId);
          broadcastPresence(info.gameId);
        }
        // Start disconnect timer
        if (info.playerId) {
          const timerKey = `${info.gameId}:${info.playerId}`;
          if (disconnectTimers.has(timerKey)) {
            clearTimeout(disconnectTimers.get(timerKey));
          }
          disconnectTimers.set(timerKey, setTimeout(async () => {
            // Mark player as disconnected in DB
            try {
              await pool.query('UPDATE players SET status = $1 WHERE id = $2 AND game_id = $3', ['disconnected', info.playerId, info.gameId]);
              broadcastGameEvent(info.gameId, { type: 'player_disconnected', data: { playerId: info.playerId } });
            } catch (err) {
              console.error('Failed to mark player as disconnected:', err);
            }
            disconnectTimers.delete(timerKey);
          }, DISCONNECT_TIMEOUT_MS));
        }
      }
      clientInfoMap.delete(ws);
    });
  });
}

module.exports = {
  startGameRoomWebSocketServer,
  broadcastGameRoomState,
  broadcastGameEvent,
  getOnlinePlayerIds,
}; 