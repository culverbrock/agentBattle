const { interpret } = require('xstate');
const gameStateMachine = require('./gameStateMachine');

// Initialize the state machine service
const service = interpret(gameStateMachine)
  .onTransition((state) => {
    console.log(`State: ${state.value}, Round: ${state.context.round}`);
  })
  .start();

// Simulate game events to test round logging
service.send('START_GAME');
service.send('SUBMIT_PROPOSAL');
service.send('VOTE');
service.send('END_VOTING'); // This should log the round completion

// Stop the service after testing
service.stop(); 