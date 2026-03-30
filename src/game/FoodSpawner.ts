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
