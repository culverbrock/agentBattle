/**
 * Evolution WebSocket Broadcaster - Handles real-time communication
 * for the Evolution Observatory
 */

class EvolutionWebSocketBroadcaster {
  constructor() {
    this.clients = new Set();
    this.messageQueue = [];
    this.maxMessageHistory = 100;
  }

  addClient(ws) {
    this.clients.add(ws);
    console.log(`🧬 Evolution Observatory client connected. Total clients: ${this.clients.size}`);
    
    // Send recent message history to new client
    if (this.messageQueue.length > 0) {
      ws.send(JSON.stringify({
        type: 'message_history',
        data: this.messageQueue.slice(-20) // Send last 20 messages
      }));
    }

    // Handle client disconnect
    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('🧬 Evolution Observatory WebSocket error:', error);
      this.removeClient(ws);
    });
  }

  removeClient(ws) {
    this.clients.delete(ws);
    console.log(`🧬 Evolution Observatory client disconnected. Total clients: ${this.clients.size}`);
  }

  broadcast(message) {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Add to message history
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxMessageHistory) {
      this.messageQueue = this.messageQueue.slice(-this.maxMessageHistory);
    }

    const messageString = JSON.stringify(message);
    const deadClients = [];

    // Broadcast to all connected clients
    this.clients.forEach(client => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(messageString);
        } else {
          deadClients.push(client);
        }
      } catch (error) {
        console.error('🧬 Error broadcasting to client:', error);
        deadClients.push(client);
      }
    });

    // Clean up dead clients
    deadClients.forEach(client => {
      this.removeClient(client);
    });

    // Log significant events
    if (['simulation_started', 'simulation_stopped', 'strategy_eliminated', 'strategy_evolved'].includes(message.type)) {
      console.log(`🧬 Broadcasted ${message.type} to ${this.clients.size} clients`);
    }
  }

  broadcastLog(level, source, message) {
    this.broadcast({
      type: 'log_entry',
      data: {
        level: level,
        source: source,
        message: message,
        timestamp: Date.now()
      }
    });
  }

  broadcastError(error, context = '') {
    this.broadcast({
      type: 'error',
      data: {
        error: error.message || error,
        context: context,
        timestamp: Date.now()
      }
    });
  }

  getClientCount() {
    return this.clients.size;
  }

  // Utility method to broadcast strategy updates
  broadcastStrategyUpdate(strategies) {
    this.broadcast({
      type: 'strategies_updated',
      data: {
        strategies: strategies,
        count: strategies.length
      }
    });
  }

  // Utility method to broadcast game events
  broadcastGameEvent(eventType, gameData) {
    this.broadcast({
      type: eventType,
      data: gameData
    });
  }
}

module.exports = { EvolutionWebSocketBroadcaster }; 