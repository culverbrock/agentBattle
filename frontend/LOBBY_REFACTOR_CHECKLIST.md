# Poker-Style Lobby Refactor Checklist

This checklist defines what "done" means for a poker-style game lobby. Use it to guide development and as a reference for future reviews.

## 1. UI/UX Requirements
- [ ] Display a list of open games/tables as cards or rows
    - Show: Game name, # of players (e.g., 3/6), status (open, in progress, full)
    - Each row/card has a clear "Join" button
- [ ] Add a prominent "Create Table/Game" button or modal
    - Allow custom options (e.g., table name, max players)
- [ ] Show player list for each game/table (on click or hover)
- [ ] Use visual feedback: status badges, highlighting, animations
- [ ] Responsive layout for desktop and mobile
- [ ] Optional: Filters, search, sorting, avatars, chat

## 2. Real-Time Experience
- [ ] All lobby/game/player changes update in real time for all users
- [ ] When a player joins/leaves, all clients see the update instantly
- [ ] New games appear instantly; full/in-progress games update status
- [ ] (If not possible with Vercel serverless) Document plan for running a persistent WebSocket server

## 3. Technical/Backend
- [ ] WebSocket server is running in production and frontend connects to it
- [ ] Backend broadcasts all relevant lobby/game/player events
- [ ] API endpoints for creating/joining/leaving games are robust and return clear errors
- [ ] Player/game state is consistent between DB, backend, and frontend

## 4. Testing/Polish
- [ ] Test with multiple browsers/devices for real-time sync
- [ ] Test edge cases: joining full game, leaving, duplicate names/IDs
- [ ] UI/UX reviewed for clarity and engagement
- [ ] All acceptance criteria from this checklist are met

---

**When all boxes are checked, the lobby is truly "done" and feels like a real poker lobby!** 