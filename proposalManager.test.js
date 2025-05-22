/**
 * @fileoverview Jest tests for ProposalManager CRUD and queue operations.
 */
const ProposalManager = require('./proposalManager');
const pool = require('./database');

// Use a unique player ID for test isolation
const TEST_PLAYER_ID = 'test_player_123';
const TEST_CONTENT = 'Test proposal content';
const TEST_GAME_ID = '00000000-0000-0000-0000-000000000001';

let createdProposalId;

describe('ProposalManager', () => {
  beforeAll(async () => {
    // Insert a dummy game row for foreign key constraint
    await pool.query(
      `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') ON CONFLICT (id) DO NOTHING`,
      [TEST_GAME_ID, 'Test Game']
    );
  });

  afterAll(async () => {
    // Clean up any test proposals
    const proposals = await ProposalManager.getProposals();
    for (const proposal of proposals) {
      if (proposal.player_id === TEST_PLAYER_ID) {
        await ProposalManager.deleteProposal(proposal.id);
      }
    }
    // Clean up dummy game row
    await pool.query(`DELETE FROM games WHERE id = $1`, [TEST_GAME_ID]);
  });

  it('should create a new proposal', async () => {
    const proposal = await ProposalManager.createProposal({ gameId: TEST_GAME_ID, playerId: TEST_PLAYER_ID, content: TEST_CONTENT });
    expect(proposal).toHaveProperty('id');
    expect(proposal.player_id).toBe(TEST_PLAYER_ID);
    expect(proposal.content).toBe(TEST_CONTENT);
    expect(proposal.status).toBe('pending');
    createdProposalId = proposal.id;
  });

  it('should get a proposal by ID', async () => {
    const proposal = await ProposalManager.getProposal(createdProposalId);
    expect(proposal).not.toBeNull();
    expect(proposal.id).toBe(createdProposalId);
  });

  it('should update a proposal status', async () => {
    const updated = await ProposalManager.updateProposalStatus(createdProposalId, 'accepted');
    expect(updated).not.toBeNull();
    expect(updated.status).toBe('accepted');
  });

  it('should get all proposals (including the test proposal)', async () => {
    const proposals = await ProposalManager.getProposals();
    expect(Array.isArray(proposals)).toBe(true);
    expect(proposals.some(p => p.id === createdProposalId)).toBe(true);
  });

  it('should get proposals filtered by status', async () => {
    const accepted = await ProposalManager.getProposals('accepted');
    expect(Array.isArray(accepted)).toBe(true);
    expect(accepted.some(p => p.id === createdProposalId)).toBe(true);
  });

  it('should get the next pending proposal (null if none)', async () => {
    // Mark all as accepted, so none are pending
    await ProposalManager.updateProposalStatus(createdProposalId, 'accepted');
    const next = await ProposalManager.getNextPendingProposal();
    expect(next === null || next.status === 'pending').toBe(true);
  });

  it('should delete a proposal', async () => {
    const deleted = await ProposalManager.deleteProposal(createdProposalId);
    expect(deleted).toBe(true);
    const proposal = await ProposalManager.getProposal(createdProposalId);
    expect(proposal).toBeNull();
  });
}); 