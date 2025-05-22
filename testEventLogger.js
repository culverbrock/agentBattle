const { logEvent } = require('./eventLogger');
const pool = require('./database');

const TEST_GAME_ID = '00000000-0000-0000-0000-00000000e8e8';
const TEST_PLAYER_ID = 'event_test_player';

beforeAll(async () => {
  // Insert a dummy game row for FK
  await pool.query(
    `INSERT INTO games (id, name, status) VALUES ($1, $2, 'lobby') ON CONFLICT (id) DO NOTHING`,
    [TEST_GAME_ID, 'Event Logger Test Game']
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM messages WHERE game_id = $1`, [TEST_GAME_ID]);
  await pool.query(`DELETE FROM games WHERE id = $1`, [TEST_GAME_ID]);
});

describe('eventLogger', () => {
  it('should log an event and retrieve it from the DB', async () => {
    const type = 'test_event';
    const content = 'This is a test event.';
    await logEvent({ gameId: TEST_GAME_ID, playerId: TEST_PLAYER_ID, type, content });
    const { rows } = await pool.query(
      `SELECT * FROM messages WHERE game_id = $1 AND player_id = $2 AND type = $3 AND content = $4`,
      [TEST_GAME_ID, TEST_PLAYER_ID, type, content]
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].type).toBe(type);
    expect(rows[0].content).toBe(content);
    expect(rows[0].game_id).toBe(TEST_GAME_ID);
    expect(rows[0].player_id).toBe(TEST_PLAYER_ID);
  });
}); 