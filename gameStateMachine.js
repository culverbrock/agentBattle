/**
 * Game state machine with proposal and player DB integration (Sprint 1 Story 6)
 * Now supports initialization from a restored context.
 */
const { createMachine, assign } = require('xstate');
const logRoundCompletion = require('./roundLogger');
const PlayerState = require('./playerStateManagement');
const ProposalManager = require('./proposalManager');
const eventLogger = require('./eventLogger');

const incrementRound = assign({
  round: (context) => context.round + 1
});

const initializeRound = assign({
  round: 1
});

// Default player for demonstration
const player = new PlayerState('player1');
// player.startHeartbeat();

/**
 * Factory to create a game state machine with optional initial context.
 * @param {object} [initialContext]
 * @returns {StateMachine}
 */
function createGameStateMachine(initialContext) {
  return createMachine({
    id: 'game',
    initial: 'lobby',
    context: initialContext || {
      round: 0,
      players: [player] // Add players to the context
    },
    states: {
      lobby: {
        on: {
          START_GAME: {
            target: 'activeGame',
            actions: [
              initializeRound,
              async (context) => {
                if (context.gameId) {
                  await eventLogger.logEvent({
                    gameId: context.gameId,
                    type: 'state_transition',
                    content: 'Transitioned from lobby to activeGame'
                  });
                }
              }
            ]
          },
          /**
           * Handle player join event: update DB via PlayerManager.
           */
          PLAYER_JOIN: {
            actions: async (context, event) => {
              if (event.playerId && event.name) {
                const PlayerManager = require('./playerManager');
                PlayerManager.joinPlayer(event.playerId, event.name, context.gameId)
                  .then(async (player) => {
                    console.log('Player joined and persisted to DB:', player);
                    if (context.gameId) {
                      await eventLogger.logEvent({
                        gameId: context.gameId,
                        playerId: event.playerId,
                        type: 'player_join',
                        content: `Player ${event.playerId} (${event.name}) joined.`
                      });
                    }
                  })
                  .catch(err => {
                    console.error('Failed to persist player join to DB:', err);
                  });
              }
            }
          },
          /**
           * Handle player leave event: update DB via PlayerManager.
           */
          PLAYER_LEAVE: {
            actions: async (context, event) => {
              if (event.playerId) {
                const PlayerManager = require('./playerManager');
                PlayerManager.leavePlayer(event.playerId)
                  .then(async (player) => {
                    console.log('Player left and updated in DB:', player);
                    if (context.gameId) {
                      await eventLogger.logEvent({
                        gameId: context.gameId,
                        playerId: event.playerId,
                        type: 'player_leave',
                        content: `Player ${event.playerId} left.`
                      });
                    }
                  })
                  .catch(err => {
                    console.error('Failed to persist player leave to DB:', err);
                  });
              }
            }
          }
        }
      },
      activeGame: {
        on: {
          SUBMIT_PROPOSAL: {
            target: 'proposal',
            actions: [
              /**
               * Log proposal submission for each player and persist to DB.
               * @param {object} context
               * @param {object} event - Should have { proposal, playerId }
               */
              async (context, event) => {
                context.players.forEach(player => player.logProposalSubmission(event.proposal));
                // Persist proposal to DB
                if (event.proposal && event.playerId) {
                  ProposalManager.createProposal({
                    gameId: context.gameId || null,
                    playerId: event.playerId,
                    content: event.proposal
                  })
                    .then(async (dbProposal) => {
                      console.log('Proposal persisted to DB:', dbProposal);
                      if (context.gameId) {
                        await eventLogger.logEvent({
                          gameId: context.gameId,
                          playerId: event.playerId,
                          type: 'proposal',
                          content: `Player ${event.playerId} submitted proposal: ${event.proposal}`
                        });
                      }
                    })
                    .catch((err) => {
                      console.error('Failed to persist proposal to DB:', err);
                    });
                }
              }
            ]
          }
        }
      },
      proposal: {
        on: {
          VOTE: {
            target: 'voting',
            actions: async (context, event) => {
              context.players.forEach(player => player.logVote(event.vote));
              if (context.gameId && event.playerId && event.vote) {
                await eventLogger.logEvent({
                  gameId: context.gameId,
                  playerId: event.playerId,
                  type: 'vote',
                  content: `Player ${event.playerId} voted: ${event.vote}`
                });
              }
            }
          }
        }
      },
      voting: {
        on: {
          END_VOTING: {
            target: 'lobby',
            actions: [
              incrementRound,
              (context) => logRoundCompletion(context.round),
              async (context) => {
                if (context.gameId) {
                  await eventLogger.logEvent({
                    gameId: context.gameId,
                    type: 'state_transition',
                    content: 'Transitioned from voting to lobby'
                  });
                }
              }
            ]
          }
        }
      }
    }
  });
}

module.exports = createGameStateMachine; 