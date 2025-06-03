/**
 * Evolution WebSocket Server - Handles real-time communication for the Evolution Observatory
 */

const WebSocket = require('ws');
const { addWebSocketClient, removeWebSocketClient } = require('./api/evolutionController');

let evolutionWss;

function startEvolutionWebSocketServer(server) {
  evolutionWss = new WebSocket.Server({ noServer: true });
  
  // Handle WebSocket upgrade for evolution endpoint
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws/evolution') {
      evolutionWss.handleUpgrade(request, socket, head, (ws) => {
        evolutionWss.emit('connection', ws, request);
      });
    }
  });

  // Handle new evolution observatory connections
  evolutionWss.on('connection', (ws, request) => {
    console.log('🧬 New Evolution Observatory WebSocket connection');
    
    // Add client to evolution controller
    addWebSocketClient(ws);
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log('🧬 Evolution Observatory WebSocket disconnected');
      removeWebSocketClient(ws);
    });
    
    ws.on('error', (error) => {
      console.error('🧬 Evolution Observatory WebSocket error:', error);
      removeWebSocketClient(ws);
    });
    
    // Handle incoming messages from clients (if needed for controls)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleEvolutionWebSocketMessage(ws, data);
      } catch (error) {
        console.error('🧬 Error parsing WebSocket message:', error);
      }
    });
  });

  console.log('🧬 Evolution Observatory WebSocket server started on /ws/evolution');
  return evolutionWss;
}

function handleEvolutionWebSocketMessage(ws, data) {
  // Handle any client-side messages/commands if needed
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
      
    case 'request_current_state':
      // Evolution controller will handle sending current state
      break;
      
    default:
      console.log('🧬 Unknown WebSocket message type:', data.type);
  }
}

function getEvolutionWebSocketServer() {
  return evolutionWss;
}

function getConnectedClientsCount() {
  return evolutionWss ? evolutionWss.clients.size : 0;
}

module.exports = { 
  startEvolutionWebSocketServer, 
  getEvolutionWebSocketServer,
  getConnectedClientsCount
}; 