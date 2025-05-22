/**
 * Integration test: State machine proposal submission persists to DB (Sprint 1 Story 6)
 */
const { interpret } = require('xstate');
const gameStateMachine = require('./gameStateMachine');
const ProposalManager = require('./proposalManager');
const restoreGameState = require('./restoreGameState');
const createGameStateMachine = require('./gameStateMachine');
const pool = require('./database');

const TEST_PLAYER_ID = 'integration_test_player';
const TEST_PROPOSAL = 'Integration test proposal content';
const TEST_PLAYER_NAME = 'Integration Test Player';
const TEST_GAME_ID = '00000000-0000-0000-0000-000000000002';

let createdProposalId;
let playerCreated = false;

describe('Game State Machine Integration', () => {
  beforeAll(async () => {
    // Insert a dummy game row for foreign key constraint
    await pool.query(
      `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') ON CONFLICT (id) DO NOTHING`,
      [TEST_GAME_ID, 'Integration Test Game']
    );
  });

  afterAll(async () => {
    // Clean up test proposal
    if (createdProposalId) {
      await ProposalManager.deleteProposal(createdProposalId);
    }
    // Clean up test player
    if (playerCreated) {
      const PlayerManager = require('./playerManager');
      await PlayerManager.deletePlayer(TEST_PLAYER_ID);
    }
    // Clean up dummy game row
    await pool.query(`DELETE FROM games WHERE id = $1`, [TEST_GAME_ID]);
  });

  it('should persist a proposal to the DB when SUBMIT_PROPOSAL is sent', async () => {
    const service = interpret(createGameStateMachine({ gameId: TEST_GAME_ID, players: [] }));
    service.start('activeGame');
    service.send({ type: 'SUBMIT_PROPOSAL', proposal: TEST_PROPOSAL, playerId: TEST_PLAYER_ID });
    await new Promise(resolve => setTimeout(resolve, 500));
    const proposals = await ProposalManager.getProposals();
    const found = proposals.find(p => p.player_id === TEST_PLAYER_ID && p.content === TEST_PROPOSAL);
    expect(found).toBeDefined();
    createdProposalId = found.id;
  });

  it('should persist a player join to the DB when PLAYER_JOIN is sent', async () => {
    const service = interpret(createGameStateMachine());
    service.start('lobby');
    service.send({ type: 'PLAYER_JOIN', playerId: TEST_PLAYER_ID, name: TEST_PLAYER_NAME });
    await new Promise(resolve => setTimeout(resolve, 500));
    const PlayerManager = require('./playerManager');
    const player = await PlayerManager.getPlayer(TEST_PLAYER_ID);
    expect(player).toBeDefined();
    expect(player.name).toBe(TEST_PLAYER_NAME);
    expect(player.status).toBe('connected');
    playerCreated = true;
  });

  it('should persist a player leave to the DB when PLAYER_LEAVE is sent', async () => {
    const service = interpret(createGameStateMachine());
    service.start('lobby');
    service.send({ type: 'PLAYER_JOIN', playerId: TEST_PLAYER_ID, name: TEST_PLAYER_NAME });
    await new Promise(resolve => setTimeout(resolve, 200));
    service.send({ type: 'PLAYER_LEAVE', playerId: TEST_PLAYER_ID });
    await new Promise(resolve => setTimeout(resolve, 500));
    const PlayerManager = require('./playerManager');
    const player = await PlayerManager.getPlayer(TEST_PLAYER_ID);
    expect(player).toBeDefined();
    expect(player.status).toBe('disconnected');
  });

  it('should initialize from DB state using restoreGameState', async () => {
    const state = await restoreGameState();
    const machine = createGameStateMachine({
      round: state.round,
      players: state.players
    });
    expect(machine.context.round).toBe(state.round);
    expect(Array.isArray(machine.context.players)).toBe(true);
    expect(machine.context.players.length).toBe(state.players.length);
  });
}); 