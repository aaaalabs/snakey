# Snake Battle Mode — Design Spec

## Overview

Redesign the 1v1 multiplayer mode as a **Best of 3** battle with separated boards (like Tetris-Battle/Dropster). Each player has their own independent game board. Interaction happens through attack items that affect the opponent's board. Future modes (shared board, etc.) are out of scope for this spec.

## Architecture

### Separated Boards

Each player runs their own `GameEngine` instance locally. No shared game state. The network synchronizes:

- Snake position + score (for opponent mini-preview)
- Attack events (obstacles, shrink)
- Death / round lifecycle events

This mirrors Tetris-Battle's proven architecture: trust local state, treat opponent data as display-only.

### Network Protocol

Extend the existing `Message` type in `Protocol.ts`:

```typescript
type Message =
  | { type: "ready"; player?: string }
  | { type: "snake"; segments: SnakeSegment[]; score?: number }
  | { type: "attack"; kind: "obstacles" | "shrink"; count: number }
  | { type: "death" }
  | { type: "roundWin"; round: number; wins: number }
  | { type: "pause" }
  | { type: "pauseAccept" }
  | { type: "pauseDeny" }
  | { type: "unpause" };
```

Remove the unused `food` and `gameOver` message types.

### Rendering

- **Left (large):** Player's own board, full size
- **Right (mini):** Opponent's board as preview, rendered from received snake segments on a smaller canvas
- **HUD:** Score, round indicator (e.g., "Round 2/3"), win dots (filled/empty circles)
- **Between rounds:** Overlay showing round result, 3-second countdown to next round

## Battle Mode: Best of 3

### Round Flow

1. Both players connect, exchange `ready` messages
2. Countdown: 3 - 2 - 1 - GO
3. Both play on their own 20x20 board
4. Round ends when one player dies (collides with wall, own body, or obstacles)
5. Surviving player wins the round
6. Between-round screen: "Round X — [Winner] wins!" (2-3 seconds)
7. First to 2 round wins takes the match
8. After match: Game Over screen with final result, rematch/lobby buttons

### Sudden Death

If no one dies after **2 minutes**, sudden death activates:

- Every 5 seconds, the playable area shrinks by 1 row or column from a random edge
- Shrunk cells become walls (same as obstacle blocks)
- Continues until someone dies
- Visual warning: border flash when sudden death begins

### Round State

Track in a new `BattleState` object (not a new file — add to GameScreen or a small helper):

```
round: 1 | 2 | 3
playerWins: number
opponentWins: number
roundActive: boolean
suddenDeath: boolean
suddenDeathTimer: number
```

## Food Types

Three food types, color-coded, time-escalated:

### Score Food (Yellow)

- Color: `#ffff00`
- Effect: +100 points (multiplied by difficulty modifier and combo multiplier)
- Available from: Round start (0s)
- Spawn rate: 1-3 active simultaneously
- Combo window: 5000ms between eats for multiplier

### Obstacle Food (Red)

- Color: `#ff3333`
- Effect: When eaten, spawns 2-3 wall blocks at random empty positions on the **opponent's** board
- Available from: 30 seconds into round
- Spawn rate: Max 1 active at a time
- Sends `{ type: "attack", kind: "obstacles", count: 2-3 }` to opponent
- Opponent receives: wall blocks appear with a brief red flash effect

### Shrink Food (Purple)

- Color: `#cc44ff`
- Effect: When eaten, opponent's playable area permanently shrinks by 1 row or column from a random edge for the rest of the round
- Available from: 60 seconds into round
- Spawn rate: Max 1 active, respawns after 15 seconds
- Sends `{ type: "attack", kind: "shrink", count: 1 }` to opponent
- Opponent receives: border closes in with a purple flash, screen shake

### Food Spawning Logic

Modify `FoodSpawner` to support typed food:

```typescript
interface FoodItem {
  x: number;
  y: number;
  type: "score" | "obstacle" | "shrink";
}
```

Spawning rules:
- Check elapsed round time to determine which types are available
- Score food: spawn if fewer than max active (1-3 based on difficulty)
- Obstacle food: spawn if 0 active and elapsed >= 30s
- Shrink food: spawn if 0 active and elapsed >= 60s and cooldown expired (15s)
- All food spawns on empty cells (no snake body, no existing food, no obstacles)

### Rendering Food

Each food type gets a distinct visual:
- Score: Yellow circle with subtle glow
- Obstacle: Red diamond/square shape, pulsing
- Shrink: Purple triangle, slow rotation animation

Use the existing `Renderer.drawGrid()` approach — extend cell types:

```
0: empty
1: player snake (cyan)
2: opponent snake (magenta) — only for mini-preview
3: score food (yellow)
4: obstacle wall (dark gray)
5: obstacle food (red)
6: shrink food (purple)
```

## Solo Mode

Unchanged. Classic snake with score food only. No attack items, no rounds. Existing highscore leaderboard stays as-is.

## Attack Mechanics

### Receiving Obstacles

When an `attack` message with `kind: "obstacles"` arrives:

1. Generate `count` random empty positions on local board
2. Place permanent wall blocks at those positions
3. Visual feedback: red flash on board, brief screen shake
4. Walls persist for the rest of the round
5. Snake dies if it hits these walls (same as border collision)

### Receiving Shrink

When an `attack` message with `kind: "shrink"` arrives:

1. Pick a random edge (top, bottom, left, right)
2. Convert the outermost row/column on that edge to wall blocks
3. Update board boundaries for collision detection
4. Visual feedback: purple flash, screen shake
5. Permanent for the rest of the round
6. If snake is currently in the shrunk area, it dies immediately

### Shrink Limits

Board cannot shrink below 10x10 (half the original). After that, shrink food stops spawning. This prevents the game from becoming unplayable.

## Files to Change

| File | Change |
|------|--------|
| `src/network/Protocol.ts` | Update Message type with attack/roundWin messages |
| `src/game/GameEngine.ts` | Add food types, obstacle placement, shrink logic, round timer, sudden death |
| `src/game/FoodSpawner.ts` | Support typed food items, time-gated spawning |
| `src/game/Board.ts` | Track obstacles and shrunk boundaries |
| `src/game/Snake.ts` | No changes needed |
| `src/ui/GameScreen.ts` | Separate board rendering, mini-preview, round HUD, attack effects, between-round overlay |
| `src/ui/Renderer.ts` | New cell type colors, food shape rendering |
| `src/ui/GameOverScreen.ts` | Show match result (2-1, 2-0), not just single score |
| `src/main.ts` | Handle new message types, round lifecycle, attack relay |
| `src/game/constants.ts` | Add food type constants, timing constants |

## Constants

```typescript
const ROUND_COUNT = 3;
const WINS_NEEDED = 2;
const SUDDEN_DEATH_TIMEOUT = 120_000; // 2 minutes
const SUDDEN_DEATH_INTERVAL = 5_000;  // shrink every 5s
const OBSTACLE_FOOD_DELAY = 30_000;   // available after 30s
const SHRINK_FOOD_DELAY = 60_000;     // available after 60s
const SHRINK_FOOD_COOLDOWN = 15_000;  // respawn after 15s
const OBSTACLE_SPAWN_COUNT = [2, 3];  // random 2-3 blocks
const MIN_BOARD_SIZE = 10;            // shrink floor
```

## Out of Scope

- Shared board mode (future)
- Power-ups beyond the three food types
- Spectator mode
- More than 2 players
- Ranking/ELO system
