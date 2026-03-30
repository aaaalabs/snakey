import { describe, it, expect } from "vitest";
import { FoodSpawner } from "../src/game/FoodSpawner";
import { Board } from "../src/game/Board";
import { Snake } from "../src/game/Snake";

describe("FoodSpawner", () => {
  it("spawns food on empty cell", () => {
    const spawner = new FoodSpawner(3);
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    const pos = spawner.spawn(board, snake, null);
    expect(pos).not.toBeNull();
    expect(spawner.food.length).toBe(1);
  });

  it("respects max food limit", () => {
    const spawner = new FoodSpawner(2);
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    spawner.spawn(board, snake, null);
    spawner.spawn(board, snake, null);
    const third = spawner.spawn(board, snake, null);
    expect(third).toBeNull();
    expect(spawner.food.length).toBe(2);
  });

  it("detects eaten food", () => {
    const spawner = new FoodSpawner(3);
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    const pos = spawner.spawn(board, snake, null)!;
    expect(spawner.checkEaten(pos.x, pos.y)).toBe(true);
    expect(spawner.food.length).toBe(0);
  });

  it("returns false for non-food position", () => {
    const spawner = new FoodSpawner(3);
    expect(spawner.checkEaten(99, 99)).toBe(false);
  });

  it("resets food list", () => {
    const spawner = new FoodSpawner(3);
    const board = new Board();
    const snake = new Snake(5, 5, "right");
    spawner.spawn(board, snake, null);
    spawner.spawn(board, snake, null);
    spawner.reset();
    expect(spawner.food.length).toBe(0);
  });
});
