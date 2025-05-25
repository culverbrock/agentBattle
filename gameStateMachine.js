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
 * Enhanced Game State Machine for Agent Battle
 * Phases: lobby -> strategy -> negotiation (5x) -> proposal -> voting -> elimination/endgame
 * Handles: random speaking order, proposal/voting, elimination, endgame, player disconnects, etc.
 */
function shuffle(array) {
  // Fisher-Yates shuffle
  let m = array.length, t, i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

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
      phase: 'lobby',
      round: 0,
      maxRounds: 10,
      players: [], // Each player: { id, name, status, ready, agent }
      eliminated: [],
      proposals: [],
      votes: {},
      speakingOrder: [],
      currentSpeakerIdx: 0,
      strategyMessages: {},
      gameId: null,
      winnerProposal: null,
      ended: false
    },
    states: {
      lobby: {
        on: {
          PLAYER_READY: {
            actions: assign((ctx, event) => {
              // Mark player as ready and store their strategy
              const updatedPlayers = ctx.players.map(p =>
                p.id === event.playerId
                  ? { ...p, ready: true, agent: { strategy: event.strategy || 'default', type: 'default' } }
                  : p
              );
              return {
                players: updatedPlayers,
                strategyMessages: {
                  ...ctx.strategyMessages,
                  [event.playerId]: event.strategy || 'default'
                }
              };
            })
          },
          START_GAME: [
            {
              target: 'strategy',
              cond: (ctx) => ctx.players.length >= 2 && ctx.players.every(p => p.ready),
              actions: assign({
                phase: 'strategy',
                round: 1,
                proposals: [],
                votes: {},
                eliminated: [],
                winnerProposal: null,
                ended: false
              })
            }
          ],
          PLAYER_JOIN: {
            actions: assign((ctx, event) => {
              // Add player if not already present
              if (!ctx.players.some(p => p.id === event.playerId)) {
                return {
                  players: [
                    ...ctx.players,
                    { id: event.playerId, name: event.name, status: 'connected', ready: false, agent: { strategy: 'default', type: 'default' } }
                  ]
                };
              }
              return {};
            })
          },
          PLAYER_LEAVE: {
            actions: assign((ctx, event) => {
              // Mark player as disconnected
              return {
                players: ctx.players.map(p =>
                  p.id === event.playerId ? { ...p, status: 'disconnected' } : p
                )
              };
            })
          }
        }
      },
      strategy: {
        on: {
          SUBMIT_STRATEGY: {
            actions: assign((ctx, event) => {
              // Store strategy message for player
              return {
                strategyMessages: {
                  ...ctx.strategyMessages,
                  [event.playerId]: event.message
                }
              };
            })
          },
          ALL_STRATEGIES_SUBMITTED: {
            target: 'negotiation',
            actions: assign((ctx) => {
              // Randomize speaking order for negotiation
              const order = shuffle(ctx.players.filter(p => !ctx.eliminated.includes(p.id)));
              return {
                phase: 'negotiation',
                speakingOrder: order.map(p => p.id),
                currentSpeakerIdx: 0
              };
            })
          }
        }
      },
      negotiation: {
        on: {
          SPEAK: {
            actions: assign((ctx, event) => {
              // Log message, advance speaker
              // (Store messages as needed)
              let nextIdx = ctx.currentSpeakerIdx + 1;
              let nextState = {};
              if (nextIdx >= ctx.speakingOrder.length) {
                // End of round
                if (ctx.round < 5) {
                  // Next negotiation round
                  nextState = {
                    round: ctx.round + 1,
                    currentSpeakerIdx: 0,
                    speakingOrder: shuffle(ctx.players.filter(p => !ctx.eliminated.includes(p.id))).map(p => p.id)
                  };
                } else {
                  // Move to proposal phase
                  nextState = { phase: 'proposal', currentSpeakerIdx: 0 };
                }
              } else {
                nextState = { currentSpeakerIdx: nextIdx };
              }
              return nextState;
            })
          }
        }
      },
      proposal: {
        on: {
          SUBMIT_PROPOSAL: {
            actions: assign((ctx, event) => {
              // Add proposal to list
              return {
                proposals: [...ctx.proposals, event.proposal]
              };
            })
          },
          ALL_PROPOSALS_SUBMITTED: {
            target: 'voting',
            actions: assign({ phase: 'voting' })
          }
        }
      },
      voting: {
        on: {
          SUBMIT_VOTE: {
            actions: assign((ctx, event) => {
              // Store votes per player
              return {
                votes: {
                  ...ctx.votes,
                  [event.playerId]: event.votes
                }
              };
            })
          },
          ALL_VOTES_SUBMITTED: [
            {
              target: 'endgame',
              cond: (ctx) => {
                // Check if any proposal has >= 61% of votes
                const totalVotes = Object.values(ctx.votes).reduce((sum, v) => sum + Object.values(v).reduce((a, b) => a + b, 0), 0);
                return ctx.proposals.some((proposal, idx) => {
                  const proposalVotes = Object.values(ctx.votes).reduce((sum, v) => sum + (v[idx] || 0), 0);
                  return proposalVotes / totalVotes >= 0.61;
                });
              },
              actions: assign((ctx) => {
                // Set winner proposal
                const totalVotes = Object.values(ctx.votes).reduce((sum, v) => sum + Object.values(v).reduce((a, b) => a + b, 0), 0);
                let winnerIdx = -1;
                ctx.proposals.forEach((proposal, idx) => {
                  const proposalVotes = Object.values(ctx.votes).reduce((sum, v) => sum + (v[idx] || 0), 0);
                  if (proposalVotes / totalVotes >= 0.61) winnerIdx = idx;
                });
                return {
                  winnerProposal: winnerIdx >= 0 ? ctx.proposals[winnerIdx] : null,
                  ended: winnerIdx >= 0
                };
              })
            },
            {
              target: 'elimination',
              actions: assign({ phase: 'elimination' })
            }
          ]
        }
      },
      elimination: {
        on: {
          ELIMINATE: {
            actions: assign((ctx, event) => {
              // Eliminate players not in top 2, or handle tie logic
              // (Implement tie-breaker and random selection as per rules)
              // For now, just mark eliminated
              return {
                eliminated: event.eliminated
              };
            })
          },
          CONTINUE: [
            {
              target: 'strategy',
              cond: (ctx) => ctx.round < ctx.maxRounds
            },
            {
              target: 'endgame',
              actions: assign({ ended: true })
            }
          ]
        }
      },
      endgame: {
        type: 'final',
        entry: assign({ phase: 'endgame', ended: true })
      }
    }
  });
}

function transitionToNextPhase(game) {
  console.log('transitionToNextPhase called. Current phase:', game.phase);
  // ... existing code ...
  console.log('Next phase:', game.phase);
}

async function invokeAgentAction(agent, context) {
  console.log('invokeAgentAction called for agent:', agent, 'with context:', context);
  try {
    // ... existing code ...
  } catch (err) {
    console.error('Error in invokeAgentAction:', err.stack || err);
    // ... existing code ...
  }
}

module.exports = createGameStateMachine; 