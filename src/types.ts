export type Direction = "up" | "down" | "left" | "right";

export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 = empty, 1 = player snake, 2 = opponent snake, 3 = score food, 4 = wall/obstacle, 5 = obstacle food, 6 = shrink food

export type Grid = Cell[][];

export interface Position {
  x: number;
  y: number;
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export type GameState = "lobby" | "countdown" | "playing" | "paused" | "gameOver";

export type FoodType = "score" | "obstacle" | "shrink";
