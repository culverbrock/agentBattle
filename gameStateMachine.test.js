jest.mock('./roundLogger');
const { createMachine, interpret } = require('xstate');
const createGameStateMachine = require('./gameStateMachine');
const logRoundCompletion = require('./roundLogger');
const pool = require('./database');

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  logRoundCompletion.mockClear();
});

describe('Game State Machine', () => {
  it('should transition from lobby to activeGame on START_GAME', (done) => {
    const service = interpret(createGameStateMachine());
    service.subscribe((state) => {
      if (state.matches('activeGame')) {
        expect(state.value).toBe('activeGame');
        done();
      }
    });
    service.start();
    service.send('START_GAME');
  });

  it('should transition from activeGame to proposal on SUBMIT_PROPOSAL', (done) => {
    const service = interpret(createGameStateMachine());
    service.subscribe((state) => {
      if (state.matches('proposal')) {
        expect(state.value).toBe('proposal');
        done();
      }
    });
    service.start();
    service.send('START_GAME');
    service.send('SUBMIT_PROPOSAL');
  });

  it('should transition from proposal to voting on VOTE', (done) => {
    const service = interpret(createGameStateMachine());
    service.subscribe((state) => {
      if (state.matches('voting')) {
        expect(state.value).toBe('voting');
        done();
      }
    });
    service.start();
    service.send('START_GAME');
    service.send('SUBMIT_PROPOSAL');
    service.send('VOTE');
  });

  it('should transition from voting to lobby on END_VOTING', (done) => {
    const service = interpret(createGameStateMachine());
    let called = false;
    service.subscribe((state) => {
      if (state.matches('lobby') && !called) {
        called = true;
        expect(state.value).toBe('lobby');
        done();
      }
    });
    service.start();
    service.send('START_GAME');
    service.send('SUBMIT_PROPOSAL');
    service.send('VOTE');
    service.send('END_VOTING');
  });

  // This test logs each state transition and round value for debugging purposes.
  it('should correctly update the round counter', (done) => {
    jest.setTimeout(5000); // Fail the test if it takes longer than 5 seconds
    const service = interpret(createGameStateMachine());
    let transitionCount = 0;
    service.subscribe((state) => {
      transitionCount++;
      console.log(`Transition ${transitionCount}: State=${state.value}, Round=${state.context.round}`);
      if (state.matches('activeGame')) {
        console.log('In activeGame, sending SUBMIT_PROPOSAL');
        service.send('SUBMIT_PROPOSAL');
      } else if (state.matches('proposal')) {
        console.log('In proposal, sending VOTE');
        service.send('VOTE');
      } else if (state.matches('voting')) {
        console.log('In voting, sending END_VOTING');
        service.send('END_VOTING');
      } else if (state.matches('lobby') && transitionCount > 1) {
        console.log('Back in lobby, checking round value');
        expect(state.context.round).toBe(2);
        done();
      }
    });
    console.log('Starting service and sending START_GAME');
    service.start();
    service.send('START_GAME');
  });

  it('should call logRoundCompletion with the correct round number', (done) => {
    const service = interpret(createGameStateMachine());
    let called = false;
    service.subscribe((state) => {
      if (state.matches('lobby') && !called) {
        called = true;
        process.nextTick(() => {
          expect(logRoundCompletion).toHaveBeenCalledWith(2);
          expect(logRoundCompletion).toHaveBeenCalledTimes(1);
          done();
        });
      }
    });
    service.start();
    service.send('START_GAME');
    service.send('SUBMIT_PROPOSAL');
    service.send('VOTE');
    service.send('END_VOTING');
  });
}); 