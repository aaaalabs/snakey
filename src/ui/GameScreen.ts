import { GameEngine } from "../game/GameEngine";
import { Snake } from "../game/Snake";
import { Renderer } from "./Renderer";
import { TouchControls } from "./TouchControls";
import { SoundEngine } from "../audio/SoundEngine";
import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS } from "../game/constants";

export class GameScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;
  private engine: GameEngine;
  private renderer: Renderer;
  private opponentRenderer: Renderer | null = null;
  private touchControls: TouchControls | null = null;
  private sounds: SoundEngine;
  private opponentSnake: Snake | null = null;
  private animFrame: number | null = null;
  private paused = false;

  onSendSnake: ((segments: SnakeSegment[], score: number) => void) | null = null;
  onGameOver: (() => void) | null = null;
  onPauseRequest: (() => void) | null = null;
  onQuit: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    difficulty: string,
    playerName: string,
    opponentName: string
  ) {
    this.container = container;
    this.sounds = new SoundEngine();
    this.engine = new GameEngine(difficulty, playerName);

    this.el = document.createElement("div");
    this.el.className = "game-screen";

    // Build layout
    this.el.innerHTML = `
      <div class="game-hud">
        <div class="hud-left">
          <span class="hud-label">Score</span>
          <span id="score" class="hud-value">0</span>
        </div>
        <div class="hud-center">
          <span id="countdown" class="countdown hidden"></span>
        </div>
        <div class="hud-right">
          <span class="hud-label">${opponentName || "Solo"}</span>
          <span id="opponentScore" class="hud-value">0</span>
        </div>
      </div>
      <div class="game-boards">
        <div class="board-wrapper">
          <canvas id="playerCanvas"></canvas>
        </div>
        ${opponentName ? '<div class="board-wrapper mini"><canvas id="opponentCanvas"></canvas></div>' : ""}
      </div>
      <div class="game-controls">
        <button id="pauseBtn" class="btn btn-small">Pause</button>
        <button id="quitBtn" class="btn btn-small btn-danger">Quit</button>
      </div>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    const playerCanvas = this.el.querySelector<HTMLCanvasElement>("#playerCanvas")!;
    this.renderer = new Renderer(playerCanvas);

    const opponentCanvas = this.el.querySelector<HTMLCanvasElement>("#opponentCanvas");
    if (opponentCanvas) {
      this.opponentRenderer = new Renderer(opponentCanvas);
    }

    if (opponentName) {
      this.opponentSnake = new Snake(
        Math.floor((COLS * 3) / 4),
        Math.floor(ROWS / 2),
        "left"
      );
    }

    // Controls
    this.setupKeyboard();
    this.touchControls = new TouchControls(playerCanvas, (dir) => {
      this.engine.setDirection(dir);
    });

    // Buttons
    this.el.querySelector("#pauseBtn")?.addEventListener("click", () => {
      this.onPauseRequest?.();
    });
    this.el.querySelector("#quitBtn")?.addEventListener("click", () => {
      this.onQuit?.();
    });

    // Engine callbacks
    this.engine.onScoreChange = (score) => {
      const el = this.el.querySelector("#score");
      if (el) el.textContent = String(score);
    };
    this.engine.onFoodEaten = () => {
      this.sounds.play("eat");
    };
    this.engine.onDeath = () => {
      this.sounds.play("death");
      this.onGameOver?.();
    };
    this.engine.onTick = () => {
      this.sendState();
    };

    // Resize handler
    window.addEventListener("resize", () => this.renderer.resize());
  }

  private setupKeyboard(): void {
    const keyMap: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };

    document.addEventListener("keydown", (e) => {
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        this.engine.setDirection(dir);
      }
    });
  }

  startCountdown(onComplete: () => void): void {
    const countdownEl = this.el.querySelector<HTMLElement>("#countdown")!;
    countdownEl.classList.remove("hidden");
    let count = 3;
    countdownEl.textContent = String(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = String(count);
        this.sounds.play("tick");
      } else {
        countdownEl.textContent = "GO!";
        this.sounds.play("go");
        setTimeout(() => {
          countdownEl.classList.add("hidden");
          onComplete();
        }, 500);
        clearInterval(interval);
      }
    }, 1000);
  }

  startGame(): void {
    this.engine.start();
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const loop = () => {
      if (this.paused) {
        this.animFrame = requestAnimationFrame(loop);
        return;
      }
      const grid = this.engine.getGrid(this.opponentSnake);
      this.renderer.drawGrid(grid, this.engine.snake.head, this.opponentSnake?.head);
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private sendState(): void {
    this.onSendSnake?.(
      this.engine.snake.segments,
      this.engine.score
    );
  }

  updateOpponentSnake(segments: SnakeSegment[]): void {
    if (this.opponentSnake) {
      this.opponentSnake.segments = segments;
    }
  }

  updateOpponentScore(score: number): void {
    const el = this.el.querySelector("#opponentScore");
    if (el) el.textContent = String(score);
  }

  receiveOpponentDeath(): void {
    this.engine.addKillBonus();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.engine.stop();
    } else {
      this.engine.start();
    }
  }

  saveHighScore(): void {
    this.engine.saveHighScore();
  }

  getScore(): number {
    return this.engine.score;
  }

  getIsNewHighScore(): boolean {
    return this.engine.getIsNewHighScore();
  }

  getHighScore(): number {
    return this.engine.getHighScore();
  }

  destroy(): void {
    this.engine.stop();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.touchControls?.destroy();
    this.el.remove();
  }
}
