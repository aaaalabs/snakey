import { Direction, Position } from "../types";
import { Board } from "./Board";
import { Snake } from "./Snake";
import { FoodSpawner } from "./FoodSpawner";
import {
  COLS, ROWS, INITIAL_SPEED, MIN_SPEED, SPEED_DECREASE,
  FOOD_SCORE, KILL_SCORE, SURVIVAL_BONUS_PER_SEC,
  COMBO_WINDOW, COMBO_MULTIPLIER,
  OBSTACLE_INTERVAL, MAX_OBSTACLES,
} from "./constants";

interface DifficultyConfig {
  speed: number;
  speedDecrease: number;
  minSpeed: number;
  maxFood: number;
  obstaclesEnabled: boolean;
  scoreMultiplier: number;
}

const DIFFICULTIES: Record<string, DifficultyConfig> = {
  chill: {
    speed: 200,
    speedDecrease: 2,
    minSpeed: 100,
    maxFood: 5,
    obstaclesEnabled: false,
    scoreMultiplier: 0.5,
  },
  normal: {
    speed: INITIAL_SPEED,
    speedDecrease: SPEED_DECREASE,
    minSpeed: MIN_SPEED,
    maxFood: 3,
    obstaclesEnabled: false,
    scoreMultiplier: 1,
  },
  hard: {
    speed: 120,
    speedDecrease: SPEED_DECREASE * 1.5,
    minSpeed: 50,
    maxFood: 2,
    obstaclesEnabled: true,
    scoreMultiplier: 1.5,
  },
  insane: {
    speed: 80,
    speedDecrease: SPEED_DECREASE * 2,
    minSpeed: 40,
    maxFood: 1,
    obstaclesEnabled: true,
    scoreMultiplier: 2,
  },
};

export class GameEngine {
  board: Board;
  snake: Snake;
  foodSpawner: FoodSpawner;
  config: DifficultyConfig;
  score: number;
  combo: number;
  lastFoodTime: number;
  speed: number;
  foodEaten: number;
  startTime: number;
  gameOver: boolean;
  playerName: string;

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private obstacleTimer: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  onTick: (() => void) | null = null;
  onFoodEaten: ((pos: Position) => void) | null = null;
  onDeath: (() => void) | null = null;
  onScoreChange: ((score: number) => void) | null = null;
  onObstacleSpawned: ((pos: Position) => void) | null = null;

  constructor(difficulty: string, playerName: string) {
    this.config = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
    this.playerName = playerName;
    this.board = new Board();
    this.snake = new Snake(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right");
    this.foodSpawner = new FoodSpawner(this.config.maxFood);
    this.score = 0;
    this.combo = 0;
    this.lastFoodTime = 0;
    this.speed = this.config.speed;
    this.foodEaten = 0;
    this.startTime = Date.now();
    this.gameOver = false;
  }

  start(): void {
    // Spawn initial food
    for (let i = 0; i < this.config.maxFood; i++) {
      this.foodSpawner.spawn(this.board, this.snake, null);
    }

    this.startTime = Date.now();
    this.tickTimer = setInterval(() => this.tick(), this.speed);

    if (this.config.obstaclesEnabled) {
      this.obstacleTimer = setInterval(() => this.spawnObstacle(), OBSTACLE_INTERVAL);
    }
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.obstacleTimer) {
      clearInterval(this.obstacleTimer);
      this.obstacleTimer = null;
    }
  }

  setDirection(dir: Direction): void {
    this.snake.setDirection(dir);
  }

  tick(): void {
    if (this.gameOver) return;

    this.snake.move();
    const head = this.snake.head;

    // Check self-collision
    if (this.snake.collidesWithSelf() && !this.snake.ghostMode) {
      this.die();
      return;
    }

    // Check obstacle collision
    if (this.board.isObstacle(head.x, head.y) && !this.snake.ghostMode) {
      this.die();
      return;
    }

    // Check food
    if (this.foodSpawner.checkEaten(head.x, head.y)) {
      this.handleFoodEaten(head);
    }

    // Spawn food if needed
    this.foodSpawner.spawn(this.board, this.snake, null);

    this.onTick?.();
  }

  private handleFoodEaten(pos: Position): void {
    this.foodEaten++;
    this.snake.grow();

    // Combo check
    const now = Date.now();
    if (now - this.lastFoodTime < COMBO_WINDOW) {
      this.combo++;
    } else {
      this.combo = 0;
    }
    this.lastFoodTime = now;

    // Score calculation
    const comboMult = this.combo > 0 ? Math.pow(COMBO_MULTIPLIER, this.combo) : 1;
    const points = Math.round(FOOD_SCORE * this.config.scoreMultiplier * comboMult);
    this.score += points;

    // Speed up
    this.speed = Math.max(
      this.config.minSpeed,
      this.speed - this.config.speedDecrease
    );
    this.restartTick();

    this.onFoodEaten?.(pos);
    this.onScoreChange?.(this.score);
  }

  addKillBonus(): void {
    this.score += Math.round(KILL_SCORE * this.config.scoreMultiplier);
    this.onScoreChange?.(this.score);
  }

  private die(): void {
    this.gameOver = true;
    this.snake.alive = false;

    // Survival bonus
    const survivalSecs = Math.floor((Date.now() - this.startTime) / 1000);
    this.score += survivalSecs * SURVIVAL_BONUS_PER_SEC;

    this.stop();
    this.onDeath?.();
  }

  private spawnObstacle(): void {
    if (this.board.obstacles.length >= MAX_OBSTACLES) return;

    const pos = this.board.getEmptyCell(this.snake, null);
    if (pos) {
      this.board.addObstacle(pos);
      this.onObstacleSpawned?.(pos);
    }
  }

  private restartTick(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), this.speed);
  }

  getGrid(opponentSnake: Snake | null): number[][] {
    return this.board.render(
      this.snake,
      opponentSnake,
      this.foodSpawner.food,
      []
    ).map((row) => row.map((cell) => cell as number));
  }

  getHighScore(): number {
    try {
      return parseInt(localStorage.getItem(`snakey-hs-${this.playerName}`) ?? "0", 10);
    } catch {
      return 0;
    }
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
    } catch {
      // non-browser environment
    }
  }

  reset(): void {
    this.stop();
    this.score = 0;
    this.combo = 0;
    this.lastFoodTime = 0;
    this.speed = this.config.speed;
    this.foodEaten = 0;
    this.gameOver = false;
    this.board = new Board();
    this.foodSpawner.reset();
    this.snake.reset(Math.floor(COLS / 4), Math.floor(ROWS / 2), "right");
  }
}
