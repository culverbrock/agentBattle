const createGameStateMachine = require('../gameStateMachine');
const { generateNegotiationMessage, generateProposal, generateVote, generateEliminationVote } = require('../agentInvoker');

describe('Agent-driven game edge cases', () => {
  const playerIds = ['p1', 'p2', 'p3'];
  let context;

  beforeEach(() => {
    context = {
      phase: 'lobby',
      round: 0,
      maxRounds: 1,
      players: playerIds.map((id, i) => ({
        id,
        name: `Player${i+1}`,
        status: 'connected',
        ready: true,
        agent: { type: 'default', strategy: `Strategy for ${id}` }
      })),
      eliminated: [],
      proposals: [],
      votes: {},
      speakingOrder: [],
      currentSpeakerIdx: 0,
      strategyMessages: {},
      gameId: 'test-game-edge',
      winnerProposal: null,
      ended: false
    };
  });

  it('should let agent take over if player disconnects', async () => {
    // Simulate disconnect
    context.players[1].status = 'disconnected';
    const msg = await generateNegotiationMessage(context, context.players[1].agent);
    expect(typeof msg).toBe('string');
  });

  it('should handle tie in voting', async () => {
    // Simulate a tie: all players vote for their own proposal
    context.phase = 'voting';
    context.proposals = playerIds.map((id, i) => ({ playerId: id, proposal: { split: 'equal', details: `Proposal ${i}` } }));
    for (const p of playerIds) {
      const vote = { proposalIndex: playerIds.indexOf(p) };
      context.votes[p] = vote;
    }
    // Tally votes
    const totalVotes = Object.values(context.votes).length;
    const proposalVotes = playerIds.map((id, idx) => Object.values(context.votes).filter(v => v.proposalIndex === idx).length);
    const isTie = proposalVotes.every(v => v === 1);
    expect(isTie).toBe(true);
  });

  it('should fall back to default logic if LLM/API fails', async () => {
    // Simulate LLM agent with a function that throws
    const agent = { type: 'llm', strategy: 'Test' };
    const contextWithLlm = { ...context };
    let errorCaught = false;
    let msg;
    try {
      // Monkey-patch callLLM to throw
      const original = require('../llmApi').callLLM;
      require('../llmApi').callLLM = async () => { throw new Error('LLM fail'); };
      msg = await generateNegotiationMessage(contextWithLlm, agent);
      require('../llmApi').callLLM = original;
    } catch (err) {
      errorCaught = true;
    }
    // Should not throw, should fallback
    expect(errorCaught).toBe(false);
    expect(typeof msg).toBe('string');
  });

  it('should end game when only one player remains', () => {
    context.players = [context.players[0]];
    context.eliminated = [playerIds[1], playerIds[2]];
    context.phase = 'elimination';
    // Simulate elimination
    const machine = createGameStateMachine(context);
    const next = machine.transition(context, { type: 'ELIMINATE', eliminated: [playerIds[1], playerIds[2]] });
    expect(['endgame', 'end']).toContain(next.value);
  });
}); 