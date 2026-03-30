import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameEngine } from "../src/game/GameEngine";

describe("GameEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with zero score", () => {
    const engine = new GameEngine("normal", "test");
    expect(engine.score).toBe(0);
    expect(engine.gameOver).toBe(false);
  });

  it("spawns initial food on start", () => {
    const engine = new GameEngine("normal", "test");
    engine.start();
    expect(engine.foodSpawner.food.length).toBeGreaterThan(0);
    engine.stop();
  });

  it("moves snake on tick", () => {
    const engine = new GameEngine("normal", "test");
    const startX = engine.snake.head.x;
    engine.start();
    vi.advanceTimersByTime(200);
    expect(engine.snake.head.x).not.toBe(startX);
    engine.stop();
  });

  it("changes direction", () => {
    const engine = new GameEngine("normal", "test");
    engine.setDirection("down");
    engine.start();
    vi.advanceTimersByTime(200);
    expect(engine.snake.direction).toBe("down");
    engine.stop();
  });

  it("resets game state", () => {
    const engine = new GameEngine("normal", "test");
    engine.score = 500;
    engine.foodEaten = 10;
    engine.reset();
    expect(engine.score).toBe(0);
    expect(engine.foodEaten).toBe(0);
    expect(engine.gameOver).toBe(false);
  });

  it("adds kill bonus", () => {
    const engine = new GameEngine("normal", "test");
    engine.addKillBonus();
    expect(engine.score).toBe(500); // KILL_SCORE * 1 multiplier
  });

  it("stops ticking when stopped", () => {
    const engine = new GameEngine("normal", "test");
    engine.start();
    engine.stop();
    const pos = { ...engine.snake.head };
    vi.advanceTimersByTime(1000);
    expect(engine.snake.head).toEqual(pos);
  });
});
