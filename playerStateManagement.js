// playerStateManagement.js

class PlayerState {
  constructor(id) {
    this.id = id;
    this.isConnected = false;
    this.actions = [];
    this.heartbeatInterval = null;
  }

  updateConnectionStatus(status) {
    this.isConnected = status;
  }

  logAction(action) {
    this.actions.push({ action, timestamp: new Date() });
  }

  getActions() {
    return this.actions;
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Simulate a heartbeat check
      const isConnected = Math.random() > 0.1; // 90% chance of being connected
      this.updateConnectionStatus(isConnected);
      console.log(`Player ${this.id} connection status: ${this.isConnected}`);
    }, 5000); // Check every 5 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  logProposalSubmission(proposal) {
    this.logAction(`Submitted proposal: ${proposal}`);
  }

  logVote(vote) {
    this.logAction(`Voted: ${vote}`);
  }
}

module.exports = PlayerState; 