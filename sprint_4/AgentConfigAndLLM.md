# Agent Configuration & LLM Integration

## Agent Types & Strategies

Each player in Agent Battle is represented by an agent. The agent has:
- `type`: Determines the logic used (e.g., `default`, `random`, `greedy`, `llm`).
- `strategy`: The latest private message from the human player, used as context for the agent.

Example agent object:
```js
{
  id: 'player1',
  name: 'Alice',
  status: 'connected',
  ready: true,
  agent: {
    type: 'llm', // or 'default', 'random', etc.
    strategy: 'Try to maximize my share, but avoid being eliminated.'
  }
}
```

## How Agent Types Work

The backend uses the agent's `type` to determine how to generate negotiation messages, proposals, votes, and elimination choices. See `agentInvoker.js`:

```js
switch (agent.type) {
  case 'llm':
    // Call LLM API (see below)
    break;
  case 'random':
    // Use random logic
    break;
  case 'greedy':
    // Use greedy logic
    break;
  case 'default':
  default:
    // Use default logic
}
```

## Adding a New Agent Type
1. Add a new `case` to each function in `agentInvoker.js` (e.g., `generateNegotiationMessage`, `generateProposal`, etc.).
2. Implement the logic for your new agent type.
3. Set `agent.type` to your new type when creating or updating agents.

## LLM Integration (Scaffold)

To enable LLM-based agents:
- Set `agent.type = 'llm'` for a player.
- In `agentInvoker.js`, the `'llm'` case is a placeholder. Replace it with a call to your LLM API (e.g., OpenAI, Gemini, etc.).

Example (pseudo-code):
```js
case 'llm':
  // Call your LLM API here
  const prompt = buildPrompt(context, agent.strategy);
  const response = await callLLM(prompt);
  return response;
```

You can use the agent's `strategy` and the current game state as context for the LLM prompt.

## Strategy Messages
- Human players only interact with their agent at the start and after failed votes, by submitting a private strategy message.
- The agent uses this strategy for all subsequent actions until a new strategy is provided.
- Strategy messages are **never** broadcast to other players unless the agent chooses to reveal them.

## Example: Setting Agent Type
You can set the agent type in the backend when a player joins or updates their agent:
```js
player.agent = { type: 'llm', strategy: 'Be fair but avoid elimination.' };
```

## Summary
- All game actions are agent-driven.
- Agent logic is fully configurable and extensible.
- LLM integration is ready for implementation.
- See `agentInvoker.js` for extension points. 