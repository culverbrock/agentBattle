const createGameStateMachine = require('../gameStateMachine');
const { generateNegotiationMessage, generateProposal, generateVote, generateEliminationVote } = require('../agentInvoker');

describe('Agent-driven game flow integration', () => {
  const playerIds = ['p1', 'p2', 'p3'];
  const agentTypes = ['default', 'random', 'greedy']; // 'llm' can be added if API key is set
  let context;

  beforeEach(() => {
    context = {
      phase: 'lobby',
      round: 0,
      maxRounds: 2,
      players: playerIds.map((id, i) => ({
        id,
        name: `Player${i+1}`,
        status: 'connected',
        ready: true,
        agent: { type: agentTypes[i], strategy: `Strategy for ${id}` }
      })),
      eliminated: [],
      proposals: [],
      votes: {},
      speakingOrder: [],
      currentSpeakerIdx: 0,
      strategyMessages: {},
      gameId: 'test-game',
      winnerProposal: null,
      ended: false
    };
  });

  it('should progress through all phases and log actions', async () => {
    const machine = createGameStateMachine(context);
    let state = machine.transition(machine.initialState, { type: 'START_GAME' }).context;
    expect(state.phase).toBe('strategy');
    // Simulate all players submitting strategy
    for (const p of playerIds) {
      state = machine.transition(state, { type: 'SUBMIT_STRATEGY', playerId: p, message: `Strategy for ${p}` }).context;
    }
    // Should move to negotiation
    expect(state.phase).toBe('negotiation');
    // Simulate negotiation round
    for (let i = 0; i < playerIds.length; i++) {
      const p = playerIds[i];
      const msg = await generateNegotiationMessage(state, context.players[i].agent);
      state = machine.transition(state, { type: 'SPEAK', playerId: p, message: msg }).context;
    }
    // Should move to proposal
    expect(state.phase === 'proposal' || state.phase === 'negotiation').toBe(true);
    if (state.phase === 'proposal') {
      // Simulate proposals
      for (const p of playerIds) {
        const proposal = await generateProposal(state, context.players.find(pl => pl.id === p).agent);
        state = machine.transition(state, { type: 'SUBMIT_PROPOSAL', playerId: p, proposal }).context;
      }
      // Should move to voting
      expect(state.phase).toBe('voting');
      // Simulate votes
      for (const p of playerIds) {
        const vote = await generateVote(state, context.players.find(pl => pl.id === p).agent);
        state = machine.transition(state, { type: 'SUBMIT_VOTE', playerId: p, votes: vote }).context;
      }
      // Should move to elimination or endgame
      expect(['elimination', 'endgame', 'end'].includes(state.phase)).toBe(true);
    }
  });
}); 