import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS, DIRECTIONS, OPPOSITE, INITIAL_SNAKE_LENGTH } from "./constants";

export class Snake {
  segments: SnakeSegment[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  growCount: number;
  ghostMode: boolean;

  constructor(startX: number, startY: number, direction: Direction) {
    this.direction = direction;
    this.nextDirection = direction;
    this.alive = true;
    this.growCount = 0;
    this.ghostMode = false;

    const dx = -DIRECTIONS[direction].x;
    const dy = -DIRECTIONS[direction].y;
    this.segments = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      this.segments.push({
        x: startX + dx * i,
        y: startY + dy * i,
      });
    }
  }

  get head(): SnakeSegment {
    return this.segments[0];
  }

  get length(): number {
    return this.segments.length;
  }

  setDirection(dir: Direction): void {
    if (OPPOSITE[dir] !== this.direction) {
      this.nextDirection = dir;
    }
  }

  move(): SnakeSegment | null {
    if (!this.alive) return null;

    this.direction = this.nextDirection;
    const d = DIRECTIONS[this.direction];
    const newHead: SnakeSegment = {
      x: (this.head.x + d.x + COLS) % COLS,
      y: (this.head.y + d.y + ROWS) % ROWS,
    };

    this.segments.unshift(newHead);

    if (this.growCount > 0) {
      this.growCount--;
      return null; // no tail removed
    }

    return this.segments.pop() ?? null;
  }

  grow(amount: number = 1): void {
    this.growCount += amount;
  }

  occupies(x: number, y: number): boolean {
    return this.segments.some((s) => s.x === x && s.y === y);
  }

  collidesWithSelf(): boolean {
    const h = this.head;
    return this.segments.slice(1).some((s) => s.x === h.x && s.y === h.y);
  }

  collidesWithSnake(other: Snake): boolean {
    const h = this.head;
    return other.segments.some((s) => s.x === h.x && s.y === h.y);
  }

  reset(startX: number, startY: number, direction: Direction): void {
    this.direction = direction;
    this.nextDirection = direction;
    this.alive = true;
    this.growCount = 0;
    this.ghostMode = false;

    const dx = -DIRECTIONS[direction].x;
    const dy = -DIRECTIONS[direction].y;
    this.segments = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      this.segments.push({
        x: startX + dx * i,
        y: startY + dy * i,
      });
    }
  }
}
