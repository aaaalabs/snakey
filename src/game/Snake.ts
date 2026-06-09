import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS, DIRECTIONS, OPPOSITE, INITIAL_SNAKE_LENGTH } from "./constants";

export class Snake {
  segments: SnakeSegment[];
  direction: Direction;
  directionQueue: Direction[]; // buffered turns, max 2 deep
  alive: boolean;
  growCount: number;
  ghostMode: boolean;
  wrapMode: boolean;

  constructor(startX: number, startY: number, direction: Direction, wrapMode: boolean = true) {
    this.direction = direction;
    this.directionQueue = [];
    this.alive = true;
    this.growCount = 0;
    this.ghostMode = false;
    this.wrapMode = wrapMode;

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
    if (this.directionQueue.length >= 2) return;
    // Validate against the direction the snake will have when this turn applies
    const effective = this.directionQueue[this.directionQueue.length - 1] ?? this.direction;
    if (dir === effective || OPPOSITE[dir] === effective) return;
    this.directionQueue.push(dir);
  }

  nextHeadFor(dir: Direction): SnakeSegment {
    const d = DIRECTIONS[dir];
    return this.wrapMode
      ? { x: (this.head.x + d.x + COLS) % COLS, y: (this.head.y + d.y + ROWS) % ROWS }
      : { x: this.head.x + d.x, y: this.head.y + d.y };
  }

  move(): SnakeSegment | null {
    if (!this.alive) return null;

    const queued = this.directionQueue.shift();
    if (queued) this.direction = queued;
    const newHead = this.nextHeadFor(this.direction);

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

  reset(startX: number, startY: number, direction: Direction, wrapMode?: boolean): void {
    this.direction = direction;
    this.directionQueue = [];
    this.alive = true;
    this.growCount = 0;
    this.ghostMode = false;
    if (wrapMode !== undefined) this.wrapMode = wrapMode;

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
