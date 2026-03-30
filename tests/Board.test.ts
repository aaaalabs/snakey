import { describe, it, expect } from "vitest";
import { Board } from "../src/game/Board";
import { Snake } from "../src/game/Snake";
import { FoodItem } from "../src/game/FoodSpawner";
import { COLS, ROWS } from "../src/game/constants";

describe("Board", () => {
  it("creates empty grid with correct dimensions", () => {
    const board = new Board();
    expect(board.grid.length).toBe(ROWS);
    expect(board.grid[0].length).toBe(COLS);
    expect(board.grid[0][0]).toBe(0);
  });

  it("renders snake on grid", () => {
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    board.render(snake, []);
    expect(board.grid[5][5]).toBe(1); // player head
    expect(board.grid[5][4]).toBe(1); // player body
  });

  it("renders food on grid", () => {
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    const food: FoodItem[] = [{ x: 10, y: 10, type: "score" }];
    board.render(snake, food);
    expect(board.grid[10][10]).toBe(3);
  });

  it("renders obstacles on grid", () => {
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    board.addObstacle({ x: 15, y: 15 });
    board.render(snake, []);
    expect(board.grid[15][15]).toBe(4);
  });

  it("finds empty cells", () => {
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    const cell = board.getEmptyCell(snake, null);
    expect(cell).not.toBeNull();
    expect(snake.occupies(cell!.x, cell!.y)).toBe(false);
  });

  it("detects obstacles", () => {
    const board = new Board();
    board.addObstacle({ x: 3, y: 7 });
    expect(board.isObstacle(3, 7)).toBe(true);
    expect(board.isObstacle(3, 8)).toBe(false);
  });
});
