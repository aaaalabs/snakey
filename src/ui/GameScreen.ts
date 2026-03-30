import { GameEngine } from "../game/GameEngine";
import { Snake } from "../game/Snake";
import { Renderer } from "./Renderer";
import { TouchControls } from "./TouchControls";
import { ParticleSystem } from "../effects/ParticleSystem";
import { ScreenEffects } from "../effects/ScreenEffects";
import { SoundEngine } from "../audio/SoundEngine";
import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS } from "../game/constants";

interface ScorePopup {
  text: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
}

export class GameScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;
  private engine: GameEngine;
  private renderer: Renderer;
  private particles: ParticleSystem;
  private screenFx: ScreenEffects;
  private touchControls: TouchControls | null = null;
  private sounds: SoundEngine;
  private opponentSnake: Snake | null = null;
  private animFrame: number | null = null;
  private paused = false;
  private scorePopups: ScorePopup[] = [];
  private lastScore = 0;

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
          <span class="hud-label">${this.escapeHtml(opponentName) || "Solo"}</span>
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
        <button id="pauseBtn" class="lobby-btn btn-ghost" style="padding:8px 16px; font-size:10px;">Pause</button>
        <button id="quitBtn" class="lobby-btn btn-danger" style="padding:8px 16px; font-size:10px;">Quit</button>
      </div>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    const playerCanvas = this.el.querySelector<HTMLCanvasElement>("#playerCanvas")!;
    this.renderer = new Renderer(playerCanvas);
    this.particles = new ParticleSystem(playerCanvas);
    this.screenFx = new ScreenEffects(this.el);

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
      if (el) el.textContent = score.toLocaleString();

      // Score popup at head position
      const diff = score - this.lastScore;
      if (diff > 0 && this.engine.snake.head) {
        const head = this.engine.snake.head;
        const cs = playerCanvas.width / COLS;
        const popup: ScorePopup = {
          text: `+${diff}`,
          x: head.x * cs + cs / 2,
          y: head.y * cs,
          startTime: performance.now(),
          duration: 800,
        };
        // Show combo text
        if (this.engine.combo > 1) {
          popup.text = `+${diff} x${this.engine.combo}`;
        }
        this.scorePopups.push(popup);
      }
      this.lastScore = score;
    };

    this.engine.onFoodEaten = (pos) => {
      this.sounds.play("eat");
      // Particle burst at food location
      const cs = playerCanvas.width / COLS;
      this.particles.emit(
        pos.x * cs + cs / 2,
        pos.y * cs + cs / 2,
        "#ffff00",
        12
      );

      // Screen flash on combo
      if (this.engine.combo >= 2) {
        this.screenFx.flash("rgba(255, 255, 0, 0.15)", 150);
      }
    };

    this.engine.onDeath = () => {
      this.sounds.play("death");
      this.screenFx.shake(8, 400);
      this.screenFx.flash("rgba(255, 0, 80, 0.3)", 300);
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
    this.lastScore = 0;
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const loop = () => {
      if (this.paused) {
        this.animFrame = requestAnimationFrame(loop);
        return;
      }

      // Level = food eaten (for hue shifting)
      const level = this.engine.foodEaten;
      const grid = this.engine.getGrid(this.opponentSnake);
      this.renderer.drawGrid(grid, this.engine.snake.head, this.opponentSnake?.head, level);

      // Draw score popups
      const now = performance.now();
      for (let i = this.scorePopups.length - 1; i >= 0; i--) {
        const p = this.scorePopups[i];
        const elapsed = now - p.startTime;
        if (elapsed > p.duration) {
          this.scorePopups.splice(i, 1);
          continue;
        }
        this.renderer.drawScorePopup(p.text, p.x, p.y, elapsed / p.duration);
      }

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
    if (el) el.textContent = score.toLocaleString();
  }

  receiveOpponentDeath(): void {
    this.engine.addKillBonus();
    this.screenFx.flash("rgba(0, 240, 240, 0.2)", 200);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.engine.stop();
      this.showPauseOverlay();
    } else {
      this.engine.start();
      this.hidePauseOverlay();
    }
  }

  private showPauseOverlay(): void {
    if (this.el.querySelector(".pause-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "pause-overlay";
    overlay.innerHTML = '<span class="pause-text">PAUSED</span>';
    const boards = this.el.querySelector(".game-boards");
    if (boards) {
      (boards as HTMLElement).style.position = "relative";
      boards.appendChild(overlay);
    }
  }

  private hidePauseOverlay(): void {
    this.el.querySelector(".pause-overlay")?.remove();
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
    this.particles.destroy();
    this.touchControls?.destroy();
    this.el.remove();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
