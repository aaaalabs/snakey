import { Cell, Grid, Position } from "../types";
import { COLS, ROWS } from "./constants";
import { Snake } from "./Snake";

export class Board {
  grid: Grid;
  obstacles: Position[];

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

  render(playerSnake: Snake, opponentSnake: Snake | null, food: Position[], powerUps: Position[]): Grid {
    this.clear();

    // Place obstacles
    for (const obs of this.obstacles) {
      this.grid[obs.y][obs.x] = 4;
    }

    // Place food
    for (const f of food) {
      this.grid[f.y][f.x] = 3;
    }

    // Place power-ups (reuse food color for now)
    for (const p of powerUps) {
      this.grid[p.y][p.x] = 3;
    }

    // Place opponent snake
    if (opponentSnake) {
      for (const seg of opponentSnake.segments) {
        if (seg.y >= 0 && seg.y < ROWS && seg.x >= 0 && seg.x < COLS) {
          this.grid[seg.y][seg.x] = 2;
        }
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

  isObstacle(x: number, y: number): boolean {
    return this.obstacles.some((o) => o.x === x && o.y === y);
  }

  getEmptyCell(playerSnake: Snake, opponentSnake: Snake | null): Position | null {
    const emptyCells: Position[] = [];

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.isObstacle(x, y)) continue;
        if (playerSnake.occupies(x, y)) continue;
        if (opponentSnake?.occupies(x, y)) continue;
        emptyCells.push({ x, y });
      }
    }

    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  toNumberGrid(): number[][] {
    return this.grid.map((row) => row.map((cell) => cell as number));
  }
}
