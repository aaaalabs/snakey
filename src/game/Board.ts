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
        this.obstacles.push(pos);
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
