# Snake Battle Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Best-of-3 battle mode with separated boards, three food types (score/obstacle/shrink), time-escalated spawning, and sudden death.

**Architecture:** Each player runs their own GameEngine locally. Network syncs snake state for mini-preview and relays attack events. No shared game state. Solo mode unchanged.

**Tech Stack:** TypeScript, Vite, Web Audio API, PeerJS (WebRTC), Upstash Redis

**Spec:** `docs/superpowers/specs/2026-03-30-snake-battle-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types.ts` | Modify | Add new cell types (5, 6) and FoodType |
| `src/game/constants.ts` | Modify | Add battle constants, food type colors |
| `src/network/Protocol.ts` | Modify | Add attack/roundWin message types |
| `src/game/FoodSpawner.ts` | Modify | Support typed food items with time-gating |
| `src/game/Board.ts` | Modify | Add shrink boundaries, obstacle placement from attacks |
| `src/game/GameEngine.ts` | Modify | Add battle mode: round timer, sudden death, attack food handling |
| `src/ui/Renderer.ts` | Modify | Render new cell types (red obstacle food, purple shrink food) |
| `src/ui/GameScreen.ts` | Rewrite | Separated boards, mini-preview, round HUD, attack effects, between-round overlay |
| `src/ui/GameOverScreen.ts` | Modify | Show match result (2-1, 2-0) |
| `src/main.ts` | Modify | Handle attack messages, round lifecycle |

---

### Task 1: Update Types and Constants

**Files:**
- Modify: `src/types.ts`
- Modify: `src/game/constants.ts`

- [ ] **Step 1: Extend cell types and add FoodType**

In `src/types.ts`, change the Cell type and add FoodType:

```typescript
export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 = empty, 1 = player snake, 2 = opponent snake, 3 = score food, 4 = wall/obstacle, 5 = obstacle food, 6 = shrink food

export type FoodType = "score" | "obstacle" | "shrink";
```

- [ ] **Step 2: Add battle constants and food colors**

In `src/game/constants.ts`, add at the end:

```typescript
// Battle mode
export const ROUND_COUNT = 3;
export const WINS_NEEDED = 2;
export const SUDDEN_DEATH_TIMEOUT = 120_000;
export const SUDDEN_DEATH_INTERVAL = 5_000;

// Food types timing
export const OBSTACLE_FOOD_DELAY = 30_000;
export const SHRINK_FOOD_DELAY = 60_000;
export const SHRINK_FOOD_COOLDOWN = 15_000;
export const OBSTACLE_SPAWN_COUNT_MIN = 2;
export const OBSTACLE_SPAWN_COUNT_MAX = 3;
export const MIN_BOARD_SIZE = 10;
```

Update `CELL_COLORS` to include the new types:

```typescript
export const CELL_COLORS: Record<number, string> = {
  0: "transparent",
  1: "#00f0f0",
  2: "#ff00aa",
  3: "#ffff00",
  4: "#444444",
  5: "#ff3333", // obstacle food (red)
  6: "#cc44ff", // shrink food (purple)
};
```

- [ ] **Step 3: Build and verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/game/constants.ts
git commit -m "feat: add battle mode types and constants"
```

---

### Task 2: Update Network Protocol

**Files:**
- Modify: `src/network/Protocol.ts`

- [ ] **Step 1: Replace Message type with battle-aware messages**

Replace the entire `Message` type and `VALID_TYPES` in `src/network/Protocol.ts`:

```typescript
export type Message =
  | { type: "ready"; player?: string }
  | { type: "snake"; segments: { x: number; y: number }[]; score?: number }
  | { type: "attack"; kind: "obstacles" | "shrink"; count: number }
  | { type: "death" }
  | { type: "roundWin"; round: number; wins: number }
  | { type: "pause" }
  | { type: "pauseAccept" }
  | { type: "pauseDeny" }
  | { type: "unpause" };

const VALID_TYPES = new Set([
  "ready", "snake", "attack", "death", "roundWin",
  "pause", "pauseAccept", "pauseDeny", "unpause",
]);
```

This removes the unused `food` and `gameOver` types and adds `attack` and `roundWin`.

- [ ] **Step 2: Build and verify**

Run: `npx tsc --noEmit`
Expected: Errors in `main.ts` referencing `"gameOver"` — expected, will fix in Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/network/Protocol.ts
git commit -m "feat: update protocol with attack and roundWin messages"
```

---

### Task 3: Upgrade FoodSpawner for Typed Food

**Files:**
- Modify: `src/game/FoodSpawner.ts`

- [ ] **Step 1: Rewrite FoodSpawner with typed food items**

Replace the entire content of `src/game/FoodSpawner.ts`:

```typescript
import { Position, FoodType } from "../types";
import { Board } from "./Board";
import { Snake } from "./Snake";
import {
  OBSTACLE_FOOD_DELAY,
  SHRINK_FOOD_DELAY,
  SHRINK_FOOD_COOLDOWN,
} from "./constants";

export interface FoodItem {
  x: number;
  y: number;
  type: FoodType;
}

export class FoodSpawner {
  food: FoodItem[];
  maxScoreFood: number;
  private roundStartTime: number;
  private lastShrinkEatenTime: number;
  private battleMode: boolean;

  constructor(maxScoreFood: number = 3, battleMode: boolean = false) {
    this.food = [];
    this.maxScoreFood = maxScoreFood;
    this.roundStartTime = Date.now();
    this.lastShrinkEatenTime = 0;
    this.battleMode = battleMode;
  }

  resetRound(): void {
    this.food = [];
    this.roundStartTime = Date.now();
    this.lastShrinkEatenTime = 0;
  }

  spawn(board: Board, playerSnake: Snake): FoodItem | null {
    const elapsed = Date.now() - this.roundStartTime;
    const scoreCount = this.food.filter(f => f.type === "score").length;
    const obstacleCount = this.food.filter(f => f.type === "obstacle").length;
    const shrinkCount = this.food.filter(f => f.type === "shrink").length;

    // Determine what to spawn
    let type: FoodType = "score";

    if (this.battleMode && shrinkCount === 0
        && elapsed >= SHRINK_FOOD_DELAY
        && (Date.now() - this.lastShrinkEatenTime) >= SHRINK_FOOD_COOLDOWN) {
      type = "shrink";
    } else if (this.battleMode && obstacleCount === 0 && elapsed >= OBSTACLE_FOOD_DELAY) {
      type = "obstacle";
    } else if (scoreCount >= this.maxScoreFood) {
      return null;
    }

    const pos = board.getEmptyCell(playerSnake, null);
    if (!pos) return null;

    const item: FoodItem = { x: pos.x, y: pos.y, type };
    this.food.push(item);
    return item;
  }

  checkEaten(x: number, y: number): FoodItem | null {
    const idx = this.food.findIndex(f => f.x === x && f.y === y);
    if (idx === -1) return null;
    const item = this.food[idx];
    this.food.splice(idx, 1);
    if (item.type === "shrink") {
      this.lastShrinkEatenTime = Date.now();
    }
    return item;
  }

  isFood(x: number, y: number): boolean {
    return this.food.some(f => f.x === x && f.y === y);
  }

  getFoodPositions(): Position[] {
    return this.food.map(f => ({ x: f.x, y: f.y }));
  }

  getFoodGrid(): { pos: Position; cellType: number }[] {
    return this.food.map(f => ({
      pos: { x: f.x, y: f.y },
      cellType: f.type === "score" ? 3 : f.type === "obstacle" ? 5 : 6,
    }));
  }

  reset(): void {
    this.food = [];
    this.roundStartTime = Date.now();
    this.lastShrinkEatenTime = 0;
  }
}
```

- [ ] **Step 2: Build and check**

Run: `npx tsc --noEmit`
Expected: Errors in `GameEngine.ts` because `checkEaten` now returns `FoodItem | null` instead of `boolean`. Expected — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/game/FoodSpawner.ts
git commit -m "feat: typed food spawner with time-gated battle items"
```

---

### Task 4: Add Shrink and Attack Support to Board

**Files:**
- Modify: `src/game/Board.ts`

- [ ] **Step 1: Add shrink boundaries and typed food rendering**

Replace the entire content of `src/game/Board.ts`:

```typescript
import { Cell, Grid, Position } from "../types";
import { COLS, ROWS, MIN_BOARD_SIZE } from "./constants";
import { Snake } from "./Snake";
import { FoodItem } from "./FoodSpawner";

export class Board {
  grid: Grid;
  obstacles: Position[];

  // Shrink boundaries (playable area)
  minX = 0;
  maxX = COLS - 1;
  minY = 0;
  maxY = ROWS - 1;

  constructor() {
    this.grid = this.createEmptyGrid();
    this.obstacles = [];
  }

  createEmptyGrid(): Grid {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => 0 as Cell)
    );
  }

  clear(): void {
    this.grid = this.createEmptyGrid();
  }

  render(playerSnake: Snake, food: FoodItem[]): Grid {
    this.clear();

    // Place shrink walls (outside playable area)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) {
          this.grid[y][x] = 4;
        }
      }
    }

    // Place obstacles
    for (const obs of this.obstacles) {
      if (obs.y >= 0 && obs.y < ROWS && obs.x >= 0 && obs.x < COLS) {
        this.grid[obs.y][obs.x] = 4;
      }
    }

    // Place typed food
    for (const f of food) {
      if (f.y >= 0 && f.y < ROWS && f.x >= 0 && f.x < COLS) {
        this.grid[f.y][f.x] = f.type === "score" ? 3 : f.type === "obstacle" ? 5 : 6;
      }
    }

    // Place player snake (on top)
    for (const seg of playerSnake.segments) {
      if (seg.y >= 0 && seg.y < ROWS && seg.x >= 0 && seg.x < COLS) {
        this.grid[seg.y][seg.x] = 1;
      }
    }

    return this.grid;
  }

  addObstacle(pos: Position): void {
    this.obstacles.push(pos);
  }

  addObstacles(positions: Position[]): void {
    this.obstacles.push(...positions);
  }

  isObstacle(x: number, y: number): boolean {
    return this.obstacles.some(o => o.x === x && o.y === y);
  }

  isOutOfBounds(x: number, y: number): boolean {
    return x < this.minX || x > this.maxX || y < this.minY || y > this.maxY;
  }

  shrinkFromEdge(): "top" | "bottom" | "left" | "right" | null {
    const width = this.maxX - this.minX + 1;
    const height = this.maxY - this.minY + 1;
    if (width <= MIN_BOARD_SIZE && height <= MIN_BOARD_SIZE) return null;

    const edges: ("top" | "bottom" | "left" | "right")[] = [];
    if (height > MIN_BOARD_SIZE) edges.push("top", "bottom");
    if (width > MIN_BOARD_SIZE) edges.push("left", "right");
    const edge = edges[Math.floor(Math.random() * edges.length)];

    switch (edge) {
      case "top": this.minY++; break;
      case "bottom": this.maxY--; break;
      case "left": this.minX++; break;
      case "right": this.maxX--; break;
    }
    return edge;
  }

  getEmptyCell(playerSnake: Snake, opponentSnake: Snake | null): Position | null {
    const emptyCells: Position[] = [];
    for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
        if (this.isObstacle(x, y)) continue;
        if (playerSnake.occupies(x, y)) continue;
        if (opponentSnake?.occupies(x, y)) continue;
        emptyCells.push({ x, y });
      }
    }
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getRandomEmptyCells(count: number, playerSnake: Snake): Position[] {
    const result: Position[] = [];
    for (let i = 0; i < count; i++) {
      const pos = this.getEmptyCell(playerSnake, null);
      if (pos) {
        this.obstacles.push(pos); // temporarily mark as occupied
        result.push(pos);
      }
    }
    return result;
  }

  resetForRound(): void {
    this.obstacles = [];
    this.minX = 0;
    this.maxX = COLS - 1;
    this.minY = 0;
    this.maxY = ROWS - 1;
  }

  toNumberGrid(): number[][] {
    return this.grid.map(row => row.map(cell => cell as number));
  }
}
```

- [ ] **Step 2: Build and check**

Run: `npx tsc --noEmit`
Expected: Errors in `GameEngine.ts` due to changed `Board.render()` signature. Expected — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/game/Board.ts
git commit -m "feat: board with shrink boundaries and attack obstacle support"
```

---

### Task 5: Upgrade GameEngine for Battle Mode

**Files:**
- Modify: `src/game/GameEngine.ts`

- [ ] **Step 1: Rewrite GameEngine with battle support**

Replace the entire content of `src/game/GameEngine.ts`:

```typescript
import { Direction, Position } from "../types";
import { Board } from "./Board";
import { Snake } from "./Snake";
import { FoodSpawner, FoodItem } from "./FoodSpawner";
import {
  COLS, ROWS, INITIAL_SPEED, MIN_SPEED, SPEED_DECREASE,
  FOOD_SCORE, KILL_SCORE, SURVIVAL_BONUS_PER_SEC,
  COMBO_WINDOW, COMBO_MULTIPLIER,
  SUDDEN_DEATH_TIMEOUT, SUDDEN_DEATH_INTERVAL,
  OBSTACLE_SPAWN_COUNT_MIN, OBSTACLE_SPAWN_COUNT_MAX,
} from "./constants";

interface DifficultyConfig {
  speed: number;
  speedDecrease: number;
  minSpeed: number;
  maxFood: number;
  scoreMultiplier: number;
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  chill: { speed: 200, speedDecrease: 2, minSpeed: 100, maxFood: 5, scoreMultiplier: 0.5 },
  normal: { speed: INITIAL_SPEED, speedDecrease: SPEED_DECREASE, minSpeed: MIN_SPEED, maxFood: 3, scoreMultiplier: 1 },
  hard: { speed: 120, speedDecrease: SPEED_DECREASE * 1.5, minSpeed: 50, maxFood: 2, scoreMultiplier: 1.5 },
  insane: { speed: 80, speedDecrease: SPEED_DECREASE * 2, minSpeed: 40, maxFood: 1, scoreMultiplier: 2 },
};

export class GameEngine {
  board: Board;
  snake: Snake;
  foodSpawner: FoodSpawner;
  config: DifficultyConfig;
  score = 0;
  combo = 0;
  lastFoodTime = 0;
  speed: number;
  foodEaten = 0;
  startTime = 0;
  gameOver = false;
  playerName: string;
  battleMode: boolean;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private suddenDeathTimer: ReturnType<typeof setInterval> | null = null;
  private suddenDeathActive = false;

  // Callbacks
  onTick: (() => void) | null = null;
  onFoodEaten: ((pos: Position, foodType: string) => void) | null = null;
  onDeath: (() => void) | null = null;
  onScoreChange: ((score: number) => void) | null = null;
  onAttack: ((kind: "obstacles" | "shrink", count: number) => void) | null = null;
  onSuddenDeath: (() => void) | null = null;
  onShrink: ((edge: string) => void) | null = null;

  constructor(difficulty: string, playerName: string, battleMode: boolean = false) {
    this.config = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
    this.playerName = playerName;
    this.battleMode = battleMode;
    this.board = new Board();
    this.snake = new Snake(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right");
    this.foodSpawner = new FoodSpawner(this.config.maxFood, battleMode);
    this.speed = this.config.speed;
  }

  start(): void {
    for (let i = 0; i < this.config.maxFood; i++) {
      this.foodSpawner.spawn(this.board, this.snake);
    }
    this.startTime = Date.now();
    this.tickTimer = setInterval(() => this.tick(), this.speed);

    if (this.battleMode) {
      setTimeout(() => {
        if (!this.gameOver && !this.suddenDeathActive) {
          this.startSuddenDeath();
        }
      }, SUDDEN_DEATH_TIMEOUT);
    }
  }

  stop(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.suddenDeathTimer) { clearInterval(this.suddenDeathTimer); this.suddenDeathTimer = null; }
  }

  setDirection(dir: Direction): void {
    this.snake.setDirection(dir);
  }

  tick(): void {
    if (this.gameOver) return;

    this.snake.move();
    const head = this.snake.head;

    // Wall collision (wrapping disabled in battle mode)
    if (this.battleMode && this.board.isOutOfBounds(head.x, head.y)) {
      this.die();
      return;
    }

    // Self collision
    if (this.snake.collidesWithSelf()) {
      this.die();
      return;
    }

    // Obstacle collision
    if (this.board.isObstacle(head.x, head.y)) {
      this.die();
      return;
    }

    // Check food
    const eaten = this.foodSpawner.checkEaten(head.x, head.y);
    if (eaten) {
      this.handleFoodEaten(eaten);
    }

    // Spawn food if needed
    this.foodSpawner.spawn(this.board, this.snake);

    this.onTick?.();
  }

  private handleFoodEaten(item: FoodItem): void {
    this.foodEaten++;
    this.snake.grow();

    if (item.type === "score") {
      const now = Date.now();
      if (now - this.lastFoodTime < COMBO_WINDOW) {
        this.combo++;
      } else {
        this.combo = 0;
      }
      this.lastFoodTime = now;

      const comboMult = this.combo > 0 ? Math.pow(COMBO_MULTIPLIER, this.combo) : 1;
      const points = Math.round(FOOD_SCORE * this.config.scoreMultiplier * comboMult);
      this.score += points;
      this.onScoreChange?.(this.score);
    } else if (item.type === "obstacle") {
      const count = OBSTACLE_SPAWN_COUNT_MIN +
        Math.floor(Math.random() * (OBSTACLE_SPAWN_COUNT_MAX - OBSTACLE_SPAWN_COUNT_MIN + 1));
      this.onAttack?.("obstacles", count);
    } else if (item.type === "shrink") {
      this.onAttack?.("shrink", 1);
    }

    // Speed up
    this.speed = Math.max(this.config.minSpeed, this.speed - this.config.speedDecrease);
    this.restartTick();

    this.onFoodEaten?.({ x: item.x, y: item.y }, item.type);
  }

  // Called when receiving attack from opponent
  receiveObstacles(count: number): void {
    const positions = this.board.getRandomEmptyCells(count, this.snake);
    this.board.addObstacles(positions);
  }

  receiveShrink(): void {
    const edge = this.board.shrinkFromEdge();
    if (edge) {
      this.onShrink?.(edge);
      // Check if snake is now out of bounds
      const head = this.snake.head;
      if (this.board.isOutOfBounds(head.x, head.y)) {
        this.die();
      }
    }
  }

  addKillBonus(): void {
    this.score += Math.round(KILL_SCORE * this.config.scoreMultiplier);
    this.onScoreChange?.(this.score);
  }

  private die(): void {
    this.gameOver = true;
    this.snake.alive = false;
    const survivalSecs = Math.floor((Date.now() - this.startTime) / 1000);
    this.score += survivalSecs * SURVIVAL_BONUS_PER_SEC;
    this.stop();
    this.onDeath?.();
  }

  private startSuddenDeath(): void {
    this.suddenDeathActive = true;
    this.onSuddenDeath?.();
    this.suddenDeathTimer = setInterval(() => {
      const edge = this.board.shrinkFromEdge();
      if (edge) {
        this.onShrink?.(edge);
        const head = this.snake.head;
        if (this.board.isOutOfBounds(head.x, head.y)) {
          this.die();
        }
      }
    }, SUDDEN_DEATH_INTERVAL);
  }

  private restartTick(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), this.speed);
  }

  getGrid(): number[][] {
    return this.board.render(this.snake, this.foodSpawner.food)
      .map(row => row.map(cell => cell as number));
  }

  getHighScore(): number {
    try {
      return parseInt(localStorage.getItem(`snakey-hs-${this.playerName}`) ?? "0", 10);
    } catch { return 0; }
  }

  getIsNewHighScore(): boolean {
    return this.score > this.getHighScore();
  }

  saveHighScore(): void {
    try {
      const current = this.getHighScore();
      if (this.score > current) {
        localStorage.setItem(`snakey-hs-${this.playerName}`, String(this.score));
      }
    } catch { /* noop */ }
  }

  resetForRound(): void {
    this.stop();
    this.score = 0;
    this.combo = 0;
    this.lastFoodTime = 0;
    this.speed = this.config.speed;
    this.foodEaten = 0;
    this.gameOver = false;
    this.suddenDeathActive = false;
    this.board.resetForRound();
    this.foodSpawner.resetRound();
    this.snake.reset(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right");
  }
}
```

Key changes from original:
- `battleMode` flag controls attack food spawning and sudden death
- `onAttack` callback fires when player eats obstacle/shrink food
- `receiveObstacles()` / `receiveShrink()` handle incoming attacks
- Snake wrapping disabled in battle mode (wall = death)
- `getGrid()` no longer takes opponentSnake — each board is independent
- `resetForRound()` for Best-of-3 round transitions

- [ ] **Step 2: Build and check**

Run: `npx tsc --noEmit`
Expected: Errors in `GameScreen.ts` due to changed API (getGrid, onFoodEaten signature). Expected — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/game/GameEngine.ts
git commit -m "feat: battle-aware game engine with attacks and sudden death"
```

---

### Task 6: Update Renderer for New Food Types

**Files:**
- Modify: `src/ui/Renderer.ts`

- [ ] **Step 1: Add visual distinction for obstacle and shrink food**

In `src/ui/Renderer.ts`, update the `drawGrid` method. Replace the food glow check (around line 70-73):

```typescript
        } else if (cell === 3) {
          // Score food — yellow glow
          color = CELL_COLORS[cell];
          glow = true;
        } else if (cell === 5) {
          // Obstacle food — red, pulsing
          color = CELL_COLORS[cell];
          glow = true;
        } else if (cell === 6) {
          // Shrink food — purple, glow
          color = CELL_COLORS[cell];
          glow = true;
        } else {
```

This is minimal — all three food types glow, colors are defined in constants.

- [ ] **Step 2: Build and verify**

Run: `npx tsc --noEmit`
Expected: Still errors from GameScreen — fixed in next task.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Renderer.ts
git commit -m "feat: render obstacle and shrink food types"
```

---

### Task 7: Rewrite GameScreen for Separated Boards

**Files:**
- Modify: `src/ui/GameScreen.ts`

- [ ] **Step 1: Rewrite GameScreen with separated boards and round HUD**

Replace the entire content of `src/ui/GameScreen.ts`:

```typescript
import { GameEngine } from "../game/GameEngine";
import { Renderer } from "./Renderer";
import { TouchControls } from "./TouchControls";
import { ParticleSystem } from "../effects/ParticleSystem";
import { ScreenEffects } from "../effects/ScreenEffects";
import { SoundEngine } from "../audio/SoundEngine";
import { MusicEngine } from "../audio/MusicEngine";
import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS, WINS_NEEDED } from "../game/constants";

interface ScorePopup {
  text: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
}

export class GameScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;
  private engine: GameEngine;
  private renderer: Renderer;
  private particles: ParticleSystem;
  private screenFx: ScreenEffects;
  private touchControls: TouchControls | null = null;
  private sounds: SoundEngine;
  private music: MusicEngine;
  private muteBtn: HTMLElement;
  private quitBtn: HTMLElement;
  private animFrame: number | null = null;
  private paused = false;
  private scorePopups: ScorePopup[] = [];
  private lastScore = 0;

  // Battle state
  private battleMode: boolean;
  private round = 1;
  private playerWins = 0;
  private opponentWins = 0;
  private opponentSegments: SnakeSegment[] = [];
  private opponentScore = 0;

  onSendSnake: ((segments: SnakeSegment[], score: number) => void) | null = null;
  onGameOver: (() => void) | null = null;
  onPauseRequest: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  onAttack: ((kind: "obstacles" | "shrink", count: number) => void) | null = null;
  onRoundWin: ((round: number, wins: number) => void) | null = null;

  constructor(
    container: HTMLElement,
    difficulty: string,
    playerName: string,
    opponentName: string
  ) {
    this.container = container;
    this.battleMode = !!opponentName;
    this.sounds = new SoundEngine();
    this.music = new MusicEngine();
    this.music.muted = this.sounds.muted;
    this.engine = new GameEngine(difficulty, playerName, this.battleMode);

    this.el = document.createElement("div");
    this.el.className = "game-screen";

    const roundHud = this.battleMode
      ? `<div class="hud-center-top">
          <span id="roundLabel" class="hud-label">Round ${this.round}/${3}</span>
          <div id="winDots" class="win-dots">${this.renderWinDots()}</div>
        </div>`
      : "";

    this.el.innerHTML = `
      <div class="game-hud">
        <div class="hud-left">
          <span id="muteSlot" class="hud-btn-slot"></span>
          <span id="quitSlot" class="hud-btn-slot"></span>
          <span class="hud-label">Score</span>
          <span id="score" class="hud-value">0</span>
        </div>
        <div class="hud-center">
          ${roundHud}
          <span id="countdown" class="countdown hidden"></span>
        </div>
        <div class="hud-right">
          <span class="hud-label">${this.escapeHtml(opponentName) || "Solo"}</span>
          <span id="opponentScore" class="hud-value">0</span>
        </div>
      </div>
      <div class="game-boards">
        <div class="board-wrapper">
          <canvas id="playerCanvas"></canvas>
        </div>
        ${this.battleMode ? '<div class="board-wrapper mini"><canvas id="opponentCanvas"></canvas></div>' : ""}
      </div>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    const playerCanvas = this.el.querySelector<HTMLCanvasElement>("#playerCanvas")!;
    this.renderer = new Renderer(playerCanvas);
    this.particles = new ParticleSystem(playerCanvas);
    this.screenFx = new ScreenEffects(this.el);

    // Controls
    this.setupKeyboard();
    this.touchControls = new TouchControls(playerCanvas, (dir) => {
      this.engine.setDirection(dir);
    });

    // HUD buttons
    this.muteBtn = this.createMuteButton();
    this.quitBtn = this.createQuitButton();
    this.el.querySelector("#muteSlot")!.appendChild(this.muteBtn);
    this.el.querySelector("#quitSlot")!.appendChild(this.quitBtn);

    // Engine callbacks
    this.engine.onScoreChange = (score) => {
      const el = this.el.querySelector("#score");
      if (el) el.textContent = score.toLocaleString();

      const diff = score - this.lastScore;
      if (diff > 0 && this.engine.snake.head) {
        const head = this.engine.snake.head;
        const cs = playerCanvas.width / COLS;
        const popup: ScorePopup = {
          text: this.engine.combo > 1 ? `+${diff} x${this.engine.combo}` : `+${diff}`,
          x: head.x * cs + cs / 2,
          y: head.y * cs,
          startTime: performance.now(),
          duration: 800,
        };
        this.scorePopups.push(popup);
      }
      this.lastScore = score;
    };

    this.engine.onFoodEaten = (pos, foodType) => {
      this.sounds.play("eat");
      const cs = playerCanvas.width / COLS;
      const color = foodType === "score" ? "#ffff00" : foodType === "obstacle" ? "#ff3333" : "#cc44ff";
      this.particles.emit(pos.x * cs + cs / 2, pos.y * cs + cs / 2, color, 12);

      if (this.engine.combo >= 2) {
        this.screenFx.flash("rgba(255, 255, 0, 0.15)", 150);
      }
    };

    this.engine.onAttack = (kind, count) => {
      this.onAttack?.(kind, count);
    };

    this.engine.onDeath = () => {
      this.sounds.gameOver();
      this.music.stop();
      this.screenFx.shake(8, 400);
      this.screenFx.flash("rgba(255, 0, 80, 0.3)", 300);

      if (this.battleMode) {
        this.opponentWins++;
        this.updateRoundDisplay();
        if (this.opponentWins >= WINS_NEEDED) {
          this.onGameOver?.();
        } else {
          this.showRoundResult(false);
        }
      } else {
        this.onGameOver?.();
      }
    };

    this.engine.onSuddenDeath = () => {
      this.screenFx.flash("rgba(255, 0, 0, 0.3)", 500);
    };

    this.engine.onShrink = () => {
      this.screenFx.shake(4, 200);
      this.screenFx.flash("rgba(128, 0, 255, 0.2)", 200);
    };

    this.engine.onTick = () => {
      this.sendState();
    };

    window.addEventListener("resize", () => this.renderer.resize());
  }

  private setupKeyboard(): void {
    const keyMap: Record<string, Direction> = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right",
    };
    document.addEventListener("keydown", (e) => {
      const dir = keyMap[e.key];
      if (dir) { e.preventDefault(); this.engine.setDirection(dir); }
    });
  }

  startCountdown(onComplete: () => void): void {
    const countdownEl = this.el.querySelector<HTMLElement>("#countdown")!;
    countdownEl.classList.remove("hidden");
    let count = 3;
    countdownEl.textContent = String(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = String(count);
        this.sounds.play("tick");
      } else {
        countdownEl.textContent = "GO!";
        this.sounds.play("go");
        setTimeout(() => { countdownEl.classList.add("hidden"); onComplete(); }, 500);
        clearInterval(interval);
      }
    }, 1000);
  }

  startGame(): void {
    this.engine.start();
    this.music.start();
    this.lastScore = 0;
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const playerCanvas = this.el.querySelector<HTMLCanvasElement>("#playerCanvas")!;
    const opponentCanvas = this.el.querySelector<HTMLCanvasElement>("#opponentCanvas");

    const loop = () => {
      if (this.paused) { this.animFrame = requestAnimationFrame(loop); return; }

      // Player board
      const level = this.engine.foodEaten;
      const grid = this.engine.getGrid();
      this.renderer.drawGrid(grid, this.engine.snake.head, undefined, level);

      // Score popups
      const now = performance.now();
      for (let i = this.scorePopups.length - 1; i >= 0; i--) {
        const p = this.scorePopups[i];
        const elapsed = now - p.startTime;
        if (elapsed > p.duration) { this.scorePopups.splice(i, 1); continue; }
        this.renderer.drawScorePopup(p.text, p.x, p.y, elapsed / p.duration);
      }

      // Opponent mini-preview
      if (opponentCanvas && this.opponentSegments.length > 0) {
        const ctx = opponentCanvas.getContext("2d")!;
        const miniCell = Math.floor(Math.min(opponentCanvas.parentElement!.clientWidth / COLS, opponentCanvas.parentElement!.clientHeight / ROWS));
        opponentCanvas.width = miniCell * COLS;
        opponentCanvas.height = miniCell * ROWS;
        ctx.fillStyle = "rgba(10, 10, 26, 0.8)";
        ctx.fillRect(0, 0, opponentCanvas.width, opponentCanvas.height);
        ctx.fillStyle = "#ff00aa";
        for (const seg of this.opponentSegments) {
          ctx.fillRect(seg.x * miniCell + 1, seg.y * miniCell + 1, miniCell - 2, miniCell - 2);
        }
      }

      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private sendState(): void {
    this.onSendSnake?.(this.engine.snake.segments, this.engine.score);
  }

  updateOpponentSnake(segments: SnakeSegment[]): void {
    this.opponentSegments = segments;
  }

  updateOpponentScore(score: number): void {
    this.opponentScore = score;
    const el = this.el.querySelector("#opponentScore");
    if (el) el.textContent = score.toLocaleString();
  }

  receiveOpponentDeath(): void {
    if (this.battleMode) {
      this.playerWins++;
      this.engine.addKillBonus();
      this.updateRoundDisplay();
      this.screenFx.flash("rgba(0, 240, 240, 0.2)", 200);
      if (this.playerWins >= WINS_NEEDED) {
        this.engine.stop();
        this.music.stop();
        this.onGameOver?.();
      } else {
        this.showRoundResult(true);
      }
    } else {
      this.engine.addKillBonus();
      this.screenFx.flash("rgba(0, 240, 240, 0.2)", 200);
    }
  }

  receiveAttack(kind: "obstacles" | "shrink", count: number): void {
    if (kind === "obstacles") {
      this.engine.receiveObstacles(count);
      this.screenFx.shake(6, 300);
      this.screenFx.flash("rgba(255, 50, 50, 0.25)", 200);
    } else {
      this.engine.receiveShrink();
    }
  }

  private showRoundResult(won: boolean): void {
    this.engine.stop();
    this.music.stop();

    const overlay = document.createElement("div");
    overlay.className = "pause-overlay";
    overlay.innerHTML = `
      <span class="pause-text">${won ? "ROUND WON!" : "ROUND LOST"}</span>
      <div style="margin-top:12px; font-size:14px; color:var(--text-mid);">
        ${this.playerWins} - ${this.opponentWins}
      </div>
    `;
    const boards = this.el.querySelector(".game-boards");
    if (boards) {
      (boards as HTMLElement).style.position = "relative";
      boards.appendChild(overlay);
    }

    this.round++;
    this.onRoundWin?.(this.round - 1, won ? this.playerWins : this.opponentWins);

    setTimeout(() => {
      overlay.remove();
      this.engine.resetForRound();
      this.scorePopups = [];
      this.lastScore = 0;
      this.opponentSegments = [];
      this.opponentScore = 0;
      const el = this.el.querySelector("#score");
      if (el) el.textContent = "0";
      const oppEl = this.el.querySelector("#opponentScore");
      if (oppEl) oppEl.textContent = "0";
      this.updateRoundDisplay();
      this.startCountdown(() => {
        this.engine.start();
        this.music.start();
      });
    }, 2500);
  }

  private updateRoundDisplay(): void {
    const label = this.el.querySelector("#roundLabel");
    if (label) label.textContent = `Round ${this.round}/3`;
    const dots = this.el.querySelector("#winDots");
    if (dots) dots.innerHTML = this.renderWinDots();
  }

  private renderWinDots(): string {
    let html = "";
    for (let i = 0; i < WINS_NEEDED; i++) {
      const pFill = i < this.playerWins ? "var(--cyan)" : "transparent";
      const oFill = i < this.opponentWins ? "#ff00aa" : "transparent";
      html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--cyan);background:${pFill};margin:0 2px;"></span>`;
      html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid #ff00aa;background:${oFill};margin:0 2px;"></span>`;
    }
    return html;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) { this.engine.stop(); this.showPauseOverlay(); }
    else { this.engine.start(); this.hidePauseOverlay(); }
  }

  private showPauseOverlay(): void {
    if (this.el.querySelector(".pause-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "pause-overlay";
    overlay.innerHTML = '<span class="pause-text">PAUSED</span>';
    const boards = this.el.querySelector(".game-boards");
    if (boards) { (boards as HTMLElement).style.position = "relative"; boards.appendChild(overlay); }
  }

  private hidePauseOverlay(): void {
    this.el.querySelector(".pause-overlay")?.remove();
  }

  saveHighScore(): void { this.engine.saveHighScore(); }
  getScore(): number { return this.engine.score; }
  getIsNewHighScore(): boolean { return this.engine.getIsNewHighScore(); }
  getHighScore(): number { return this.engine.getHighScore(); }
  getPlayerWins(): number { return this.playerWins; }
  getOpponentWins(): number { return this.opponentWins; }

  destroy(): void {
    this.engine.stop();
    this.music.stop();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.particles.destroy();
    this.touchControls?.destroy();
    this.el.remove();
  }

  private createMuteButton(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "hud-icon-btn";
    const update = (): void => { btn.textContent = this.sounds.muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"; };
    update();
    const toggle = (): void => { this.sounds.toggleMute(); this.music.muted = this.sounds.muted; update(); };
    btn.style.touchAction = "manipulation";
    btn.addEventListener("click", toggle);
    btn.addEventListener("touchend", (e) => { e.preventDefault(); toggle(); }, { passive: false });
    return btn;
  }

  private createQuitButton(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "hud-icon-btn";
    btn.textContent = "\u2715";
    btn.style.touchAction = "manipulation";
    btn.addEventListener("click", () => this.onQuit?.());
    btn.addEventListener("touchend", (e) => { e.preventDefault(); this.onQuit?.(); }, { passive: false });
    return btn;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
```

- [ ] **Step 2: Build and check**

Run: `npx tsc --noEmit`
Expected: Errors in `main.ts` — fixed in next task.

- [ ] **Step 3: Commit**

```bash
git add src/ui/GameScreen.ts
git commit -m "feat: separated boards with round HUD and attack effects"
```

---

### Task 8: Update main.ts for Battle Flow

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update message handling and game lifecycle**

In `src/main.ts`, update `handleMessage` to handle new message types. Replace the entire `handleMessage` function:

```typescript
function handleMessage(msg: Message): void {
  switch (msg.type) {
    case "ready":
      if (msg.player) opponentName = msg.player;
      if (!gameScreen) {
        peer?.send({ type: "ready", player: currentPlayer });
        startGame();
      }
      break;
    case "snake":
      if (msg.segments) gameScreen?.updateOpponentSnake(msg.segments);
      if (typeof msg.score === "number") gameScreen?.updateOpponentScore(msg.score);
      break;
    case "attack":
      gameScreen?.receiveAttack(msg.kind, msg.count);
      break;
    case "death":
      gameScreen?.receiveOpponentDeath();
      break;
    case "roundWin":
      // Opponent reports their round win — handled via death
      break;
    case "pause":
      peer?.send({ type: "pauseAccept" });
      gameScreen?.setPaused(true);
      break;
    case "pauseAccept":
      gameScreen?.setPaused(true);
      break;
    case "pauseDeny":
      gameScreen?.setPaused(false);
      break;
    case "unpause":
      gameScreen?.setPaused(false);
      break;
  }
}
```

Update `startGame` to wire up the `onAttack` callback:

After the line `gameScreen.onPauseRequest = ...`, add:

```typescript
  gameScreen.onAttack = (kind, count) => {
    peer?.send({ type: "attack", kind, count });
  };
```

Update `gameScreen.onGameOver` — replace the existing callback:

```typescript
  gameScreen.onGameOver = () => {
    leaderboard.stopPlaying(currentPlayer);
    peer?.send({ type: "death" });
    showGameOver(false);
  };
```

(Removed the `gameOver` message send since that type no longer exists.)

- [ ] **Step 2: Update GameOverScreen call to show match result**

In `showGameOver`, update to pass win counts:

```typescript
function showGameOver(won: boolean): void {
  const score = gameScreen?.getScore() ?? 0;
  const isNewHighScore = gameScreen?.getIsNewHighScore() ?? false;
  const highScore = gameScreen?.getHighScore() ?? 0;
  const playerWins = gameScreen?.getPlayerWins() ?? 0;
  const opponentWins = gameScreen?.getOpponentWins() ?? 0;
  if (score > 0) leaderboard.submitScore(currentPlayer, score);
  leaderboard.stopPlaying(currentPlayer);
  gameScreen?.saveHighScore();
  gameScreen?.destroy();
  gameScreen = null;

  gameOverScreen = new GameOverScreen(
    app,
    won,
    score,
    () => {
      gameOverScreen?.destroy();
      gameOverScreen = null;
      startGame();
    },
    () => {
      gameOverScreen?.destroy();
      gameOverScreen = null;
      peer?.destroy();
      peer = null;
      ensureLobbyMusic();
      showLobby();
    },
    isNewHighScore,
    highScore,
    opponentName,
    playerWins,
    opponentWins
  );
}
```

- [ ] **Step 3: Build and check**

Run: `npx tsc --noEmit`
Expected: Error in GameOverScreen constructor — fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: battle message handling and attack relay in main"
```

---

### Task 9: Update GameOverScreen for Match Results

**Files:**
- Modify: `src/ui/GameOverScreen.ts`

- [ ] **Step 1: Add match result display**

Read the current `GameOverScreen.ts` and update the constructor to accept `playerWins` and `opponentWins` parameters. Add them after the `opponentName` parameter:

```typescript
  constructor(
    _container: HTMLElement,
    won: boolean,
    score: number,
    onRematch: () => void,
    onLobby: () => void,
    isNewHighScore: boolean,
    highScore: number,
    opponentName: string,
    playerWins: number = 0,
    opponentWins: number = 0
  ) {
```

In the overlay HTML, after the opponent name display and before the score display, add the match result if it's a battle:

```typescript
    const matchResult = (playerWins > 0 || opponentWins > 0)
      ? `<div class="gameover-score" style="font-size:20px; margin:8px 0;">
          <span style="color:var(--cyan);">${playerWins}</span>
          <span style="opacity:0.5;"> - </span>
          <span style="color:#ff00aa;">${opponentWins}</span>
        </div>`
      : "";
```

Insert `${matchResult}` into the overlay innerHTML after the title/opponent section.

- [ ] **Step 2: Build and verify everything compiles**

Run: `npx tsc --noEmit`
Expected: No errors — all files should compile cleanly now.

- [ ] **Step 3: Build the full project**

Run: `npx vite build --mode development`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/GameOverScreen.ts
git commit -m "feat: show match result (wins) on game over screen"
```

---

### Task 10: Add CSS for Round HUD

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add win-dots and round label styles**

In `index.html`, after the `.hud-icon-btn:hover` rule, add:

```css
    .hud-center-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .win-dots {
      display: flex;
      gap: 2px;
      align-items: center;
    }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: CSS for battle round HUD"
```

---

### Task 11: Fix Snake Wrapping in Battle Mode

**Files:**
- Modify: `src/game/Snake.ts`

- [ ] **Step 1: Make wrapping configurable**

The current Snake.move() always wraps: `(this.head.x + d.x + COLS) % COLS`. In battle mode, we want wall collision instead. The GameEngine already checks `board.isOutOfBounds()` after move, but the modulo wrapping means the head never goes out of bounds.

In `Snake.ts`, change the `move()` method to NOT wrap:

```typescript
  move(): SnakeSegment | null {
    if (!this.alive) return null;

    this.direction = this.nextDirection;
    const d = DIRECTIONS[this.direction];
    const newHead: SnakeSegment = {
      x: this.head.x + d.x,
      y: this.head.y + d.y,
    };

    this.segments.unshift(newHead);

    if (this.growCount > 0) {
      this.growCount--;
      return null;
    }

    return this.segments.pop() ?? null;
  }
```

This removes the modulo wrapping. For solo mode, we need wrapping back. Add a `wrapMode` flag:

```typescript
export class Snake {
  segments: SnakeSegment[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  growCount: number;
  ghostMode: boolean;
  wrapMode: boolean;

  constructor(startX: number, startY: number, direction: Direction, wrapMode: boolean = true) {
    this.wrapMode = wrapMode;
    // ... rest stays the same
```

And in `move()`:

```typescript
    const newHead: SnakeSegment = this.wrapMode
      ? { x: (this.head.x + d.x + COLS) % COLS, y: (this.head.y + d.y + ROWS) % ROWS }
      : { x: this.head.x + d.x, y: this.head.y + d.y };
```

Also update `reset()` to accept `wrapMode`:

```typescript
  reset(startX: number, startY: number, direction: Direction, wrapMode?: boolean): void {
    if (wrapMode !== undefined) this.wrapMode = wrapMode;
    // ... rest stays the same
```

- [ ] **Step 2: Update GameEngine to pass wrapMode**

In `GameEngine.ts` constructor, change the Snake creation:

```typescript
    this.snake = new Snake(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right", !battleMode);
```

And in `resetForRound()`:

```typescript
    this.snake.reset(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right", !this.battleMode);
```

- [ ] **Step 3: Build and verify**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/Snake.ts src/game/GameEngine.ts
git commit -m "feat: configurable wrap mode — walls kill in battle, wrap in solo"
```

---

### Task 12: Full Build, Test, and Deploy

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Build**

Run: `npx vite build --mode development`
Expected: Build succeeds.

- [ ] **Step 3: Deploy**

Run: `npx vercel deploy --scope thomas-projects-2f71c075 --yes --prod`
Expected: Deploys successfully to https://snakey-khaki.vercel.app

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: snake battle mode — best of 3 with attack food types"
```
