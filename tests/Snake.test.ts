import { describe, it, expect } from "vitest";
import { Snake } from "../src/game/Snake";

describe("Snake", () => {
  it("initializes with correct length", () => {
    const snake = new Snake(5, 10, "right");
    expect(snake.length).toBe(3);
    expect(snake.head).toEqual({ x: 5, y: 10 });
  });

  it("moves in the current direction", () => {
    const snake = new Snake(5, 10, "right");
    snake.move();
    expect(snake.head).toEqual({ x: 6, y: 10 });
    expect(snake.length).toBe(3);
  });

  it("grows when grow is called", () => {
    const snake = new Snake(5, 10, "right");
    snake.grow();
    snake.move();
    expect(snake.length).toBe(4);
  });

  it("cannot reverse direction", () => {
    const snake = new Snake(5, 10, "right");
    snake.setDirection("left");
    snake.move();
    expect(snake.head).toEqual({ x: 6, y: 10 });
  });

  it("can change to perpendicular direction", () => {
    const snake = new Snake(5, 10, "right");
    snake.setDirection("up");
    snake.move();
    expect(snake.head).toEqual({ x: 5, y: 9 });
  });

  it("wraps around the board", () => {
    const snake = new Snake(0, 10, "left");
    snake.move();
    expect(snake.head.x).toBe(19); // COLS - 1
  });

  it("detects self-collision", () => {
    const snake = new Snake(5, 10, "right");
    // Make snake long enough to collide
    for (let i = 0; i < 5; i++) snake.grow();
    snake.move(); // right
    snake.setDirection("down");
    snake.move(); // down
    snake.setDirection("left");
    snake.move(); // left
    snake.setDirection("up");
    snake.move(); // up - back into self
    expect(snake.collidesWithSelf()).toBe(true);
  });

  it("detects collision with another snake", () => {
    const snake1 = new Snake(5, 10, "right");
    const snake2 = new Snake(6, 10, "left");
    snake1.move();
    expect(snake1.collidesWithSnake(snake2)).toBe(true);
  });

  it("occupies its positions", () => {
    const snake = new Snake(5, 10, "right");
    expect(snake.occupies(5, 10)).toBe(true);
    expect(snake.occupies(4, 10)).toBe(true);
    expect(snake.occupies(3, 10)).toBe(true);
    expect(snake.occupies(6, 10)).toBe(false);
  });

  it("resets properly", () => {
    const snake = new Snake(5, 10, "right");
    snake.grow();
    snake.move();
    snake.move();
    snake.reset(2, 2, "down");
    expect(snake.head).toEqual({ x: 2, y: 2 });
    expect(snake.length).toBe(3);
    expect(snake.direction).toBe("down");
  });
});
