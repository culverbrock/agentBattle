const PlayerState = require('./playerStateManagement');

// Create a player state instance
const player = new PlayerState('player1');

// Start the heartbeat to simulate connection status updates
player.startHeartbeat();

// Log some actions
player.logProposalSubmission('Proposal 1');
player.logVote('Yes');

// Stop the heartbeat after some time
setTimeout(() => {
  player.stopHeartbeat();
  console.log('Final connection status:', player.isConnected);
  console.log('Logged actions:', player.getActions());
}, 10000); // Run for 10 seconds 