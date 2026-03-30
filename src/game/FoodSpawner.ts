import { Position } from "../types";
import { Board } from "./Board";
import { Snake } from "./Snake";

export class FoodSpawner {
  food: Position[];
  maxFood: number;

  constructor(maxFood: number = 3) {
    this.food = [];
    this.maxFood = maxFood;
  }

  spawn(board: Board, playerSnake: Snake, opponentSnake: Snake | null): Position | null {
    if (this.food.length >= this.maxFood) return null;

    const pos = board.getEmptyCell(playerSnake, opponentSnake);
    if (!pos) return null;

    // Avoid spawning too close to snake heads
    const ph = playerSnake.head;
    const dist = Math.abs(pos.x - ph.x) + Math.abs(pos.y - ph.y);
    if (dist < 3) {
      // Try again with a different cell (one retry)
      const pos2 = board.getEmptyCell(playerSnake, opponentSnake);
      if (pos2) {
        this.food.push(pos2);
        return pos2;
      }
    }

    this.food.push(pos);
    return pos;
  }

  checkEaten(x: number, y: number): boolean {
    const idx = this.food.findIndex((f) => f.x === x && f.y === y);
    if (idx !== -1) {
      this.food.splice(idx, 1);
      return true;
    }
    return false;
  }

  isFood(x: number, y: number): boolean {
    return this.food.some((f) => f.x === x && f.y === y);
  }

  reset(): void {
    this.food = [];
  }
}
