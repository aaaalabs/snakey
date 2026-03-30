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
  private suddenDeathTimeout: ReturnType<typeof setTimeout> | null = null;
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
      this.suddenDeathTimeout = setTimeout(() => {
        if (!this.gameOver && !this.suddenDeathActive) {
          this.startSuddenDeath();
        }
      }, SUDDEN_DEATH_TIMEOUT);
    }
  }

  stop(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.suddenDeathTimeout) { clearTimeout(this.suddenDeathTimeout); this.suddenDeathTimeout = null; }
    if (this.suddenDeathTimer) { clearInterval(this.suddenDeathTimer); this.suddenDeathTimer = null; }
  }

  setDirection(dir: Direction): void {
    this.snake.setDirection(dir);
  }

  tick(): void {
    if (this.gameOver) return;

    this.snake.move();
    const head = this.snake.head;

    // Wall collision (in battle mode, no wrapping)
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

  receiveObstacles(count: number): void {
    this.board.getRandomEmptyCells(count, this.snake);
  }

  receiveShrink(): void {
    const edge = this.board.shrinkFromEdge();
    if (edge) {
      this.onShrink?.(edge);
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
