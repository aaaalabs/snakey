import { GameEngine } from "../game/GameEngine";
import { Renderer } from "./Renderer";
import { TouchControls } from "./TouchControls";
import { ParticleSystem } from "../effects/ParticleSystem";
import { ScreenEffects } from "../effects/ScreenEffects";
import { SoundEngine } from "../audio/SoundEngine";
import { MusicEngine } from "../audio/MusicEngine";
import { Direction, SnakeSegment } from "../types";
import { COLS, ROWS, WINS_NEEDED } from "../game/constants";

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
  private music: MusicEngine;
  private muteBtn: HTMLElement;
  private quitBtn: HTMLElement;
  private animFrame: number | null = null;
  private paused = false;
  private scorePopups: ScorePopup[] = [];
  private lastScore = 0;

  // Battle state
  private battleMode: boolean;
  private round = 1;
  private playerWins = 0;
  private opponentWins = 0;
  private opponentSegments: SnakeSegment[] = [];
  private opponentScore = 0;

  onSendSnake: ((segments: SnakeSegment[], score: number) => void) | null = null;
  onGameOver: (() => void) | null = null;
  onPauseRequest: (() => void) | null = null;
  onQuit: (() => void) | null = null;
  onAttack: ((kind: "obstacles" | "shrink", count: number) => void) | null = null;
  onRoundWin: ((round: number, wins: number) => void) | null = null;

  constructor(
    container: HTMLElement,
    difficulty: string,
    playerName: string,
    opponentName: string
  ) {
    this.container = container;
    this.battleMode = !!opponentName;
    this.sounds = new SoundEngine();
    this.music = new MusicEngine();
    this.music.muted = this.sounds.muted;
    this.engine = new GameEngine(difficulty, playerName, this.battleMode);

    this.el = document.createElement("div");
    this.el.className = "game-screen";

    const roundHud = this.battleMode
      ? `<div class="hud-center-top">
          <span id="roundLabel" class="hud-label">Round ${this.round}/3</span>
          <div id="winDots" class="win-dots">${this.renderWinDots()}</div>
        </div>`
      : "";

    this.el.innerHTML = `
      <div class="game-hud">
        <div class="hud-left">
          <span id="muteSlot" class="hud-btn-slot"></span>
          <span id="quitSlot" class="hud-btn-slot"></span>
          <span class="hud-label">Score</span>
          <span id="score" class="hud-value">0</span>
        </div>
        <div class="hud-center">
          ${roundHud}
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
        ${this.battleMode ? '<div class="board-wrapper mini"><canvas id="opponentCanvas"></canvas></div>' : ""}
      </div>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    const playerCanvas = this.el.querySelector<HTMLCanvasElement>("#playerCanvas")!;
    this.renderer = new Renderer(playerCanvas);
    this.particles = new ParticleSystem(playerCanvas);
    this.screenFx = new ScreenEffects(this.el);

    // Controls
    this.setupKeyboard();
    this.touchControls = new TouchControls(playerCanvas, (dir) => {
      this.engine.setDirection(dir);
    });

    // HUD buttons
    this.muteBtn = this.createMuteButton();
    this.quitBtn = this.createQuitButton();
    this.el.querySelector("#muteSlot")!.appendChild(this.muteBtn);
    this.el.querySelector("#quitSlot")!.appendChild(this.quitBtn);

    // Engine callbacks
    this.engine.onScoreChange = (score) => {
      const el = this.el.querySelector("#score");
      if (el) el.textContent = score.toLocaleString();

      const diff = score - this.lastScore;
      if (diff > 0 && this.engine.snake.head) {
        const head = this.engine.snake.head;
        const cs = playerCanvas.width / COLS;
        const popup: ScorePopup = {
          text: this.engine.combo > 1 ? `+${diff} x${this.engine.combo}` : `+${diff}`,
          x: head.x * cs + cs / 2,
          y: head.y * cs,
          startTime: performance.now(),
          duration: 800,
        };
        this.scorePopups.push(popup);
      }
      this.lastScore = score;
    };

    this.engine.onFoodEaten = (pos, foodType) => {
      this.sounds.play("eat");
      const cs = playerCanvas.width / COLS;
      const color = foodType === "score" ? "#ffff00" : foodType === "obstacle" ? "#ff3333" : "#cc44ff";
      this.particles.emit(pos.x * cs + cs / 2, pos.y * cs + cs / 2, color, 12);

      if (this.engine.combo >= 2) {
        this.screenFx.flash("rgba(255, 255, 0, 0.15)", 150);
      }
    };

    this.engine.onAttack = (kind, count) => {
      this.onAttack?.(kind, count);
    };

    this.engine.onDeath = () => {
      this.sounds.gameOver();
      this.music.stop();
      this.screenFx.shake(8, 400);
      this.screenFx.flash("rgba(255, 0, 80, 0.3)", 300);

      if (this.battleMode) {
        this.opponentWins++;
        this.updateRoundDisplay();
        if (this.opponentWins >= WINS_NEEDED) {
          this.onGameOver?.();
        } else {
          this.showRoundResult(false);
        }
      } else {
        this.onGameOver?.();
      }
    };

    this.engine.onSuddenDeath = () => {
      this.screenFx.flash("rgba(255, 0, 0, 0.3)", 500);
    };

    this.engine.onShrink = () => {
      this.screenFx.shake(4, 200);
      this.screenFx.flash("rgba(128, 0, 255, 0.2)", 200);
    };

    this.engine.onTick = () => {
      this.sendState();
    };

    window.addEventListener("resize", () => this.renderer.resize());
  }

  private setupKeyboard(): void {
    const keyMap: Record<string, Direction> = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right",
    };
    document.addEventListener("keydown", (e) => {
      const dir = keyMap[e.key];
      if (dir) { e.preventDefault(); this.engine.setDirection(dir); }
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
        setTimeout(() => { countdownEl.classList.add("hidden"); onComplete(); }, 500);
        clearInterval(interval);
      }
    }, 1000);
  }

  startGame(): void {
    this.engine.start();
    this.music.start();
    this.lastScore = 0;
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const opponentCanvas = this.el.querySelector<HTMLCanvasElement>("#opponentCanvas");

    const loop = () => {
      if (this.paused) { this.animFrame = requestAnimationFrame(loop); return; }

      // Player board
      const level = this.engine.foodEaten;
      const grid = this.engine.getGrid();
      this.renderer.drawGrid(grid, this.engine.snake.head, undefined, level);

      // Score popups
      const now = performance.now();
      for (let i = this.scorePopups.length - 1; i >= 0; i--) {
        const p = this.scorePopups[i];
        const elapsed = now - p.startTime;
        if (elapsed > p.duration) { this.scorePopups.splice(i, 1); continue; }
        this.renderer.drawScorePopup(p.text, p.x, p.y, elapsed / p.duration);
      }

      // Opponent mini-preview
      if (opponentCanvas && this.opponentSegments.length > 0) {
        const ctx = opponentCanvas.getContext("2d")!;
        const parent = opponentCanvas.parentElement!;
        const miniCell = Math.floor(Math.min(parent.clientWidth / COLS, parent.clientHeight / ROWS));
        opponentCanvas.width = miniCell * COLS;
        opponentCanvas.height = miniCell * ROWS;
        ctx.fillStyle = "rgba(10, 10, 26, 0.8)";
        ctx.fillRect(0, 0, opponentCanvas.width, opponentCanvas.height);
        ctx.fillStyle = "#ff00aa";
        for (const seg of this.opponentSegments) {
          ctx.fillRect(seg.x * miniCell + 1, seg.y * miniCell + 1, miniCell - 2, miniCell - 2);
        }
      }

      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  private sendState(): void {
    this.onSendSnake?.(this.engine.snake.segments, this.engine.score);
  }

  updateOpponentSnake(segments: SnakeSegment[]): void {
    this.opponentSegments = segments;
  }

  updateOpponentScore(score: number): void {
    this.opponentScore = score;
    const el = this.el.querySelector("#opponentScore");
    if (el) el.textContent = score.toLocaleString();
  }

  receiveOpponentDeath(): void {
    if (this.battleMode) {
      this.playerWins++;
      this.engine.addKillBonus();
      this.updateRoundDisplay();
      this.screenFx.flash("rgba(0, 240, 240, 0.2)", 200);
      if (this.playerWins >= WINS_NEEDED) {
        this.engine.stop();
        this.music.stop();
        this.onGameOver?.();
      } else {
        this.showRoundResult(true);
      }
    } else {
      this.engine.addKillBonus();
      this.screenFx.flash("rgba(0, 240, 240, 0.2)", 200);
    }
  }

  receiveAttack(kind: "obstacles" | "shrink", count: number): void {
    if (kind === "obstacles") {
      this.engine.receiveObstacles(count);
      this.screenFx.shake(6, 300);
      this.screenFx.flash("rgba(255, 50, 50, 0.25)", 200);
    } else {
      this.engine.receiveShrink();
    }
  }

  private showRoundResult(won: boolean): void {
    this.engine.stop();
    this.music.stop();

    const overlay = document.createElement("div");
    overlay.className = "pause-overlay";
    overlay.innerHTML = `
      <span class="pause-text">${won ? "ROUND WON!" : "ROUND LOST"}</span>
      <div style="margin-top:12px; font-size:14px; color:var(--text-mid);">
        ${this.playerWins} - ${this.opponentWins}
      </div>
    `;
    const boards = this.el.querySelector(".game-boards");
    if (boards) {
      (boards as HTMLElement).style.position = "relative";
      boards.appendChild(overlay);
    }

    this.round++;
    this.onRoundWin?.(this.round - 1, won ? this.playerWins : this.opponentWins);

    setTimeout(() => {
      overlay.remove();
      this.engine.resetForRound();
      this.scorePopups = [];
      this.lastScore = 0;
      this.opponentSegments = [];
      this.opponentScore = 0;
      const el = this.el.querySelector("#score");
      if (el) el.textContent = "0";
      const oppEl = this.el.querySelector("#opponentScore");
      if (oppEl) oppEl.textContent = "0";
      this.updateRoundDisplay();
      this.startCountdown(() => {
        this.engine.start();
        this.music.start();
      });
    }, 2500);
  }

  private updateRoundDisplay(): void {
    const label = this.el.querySelector("#roundLabel");
    if (label) label.textContent = `Round ${this.round}/3`;
    const dots = this.el.querySelector("#winDots");
    if (dots) dots.innerHTML = this.renderWinDots();
  }

  private renderWinDots(): string {
    let html = "";
    for (let i = 0; i < WINS_NEEDED; i++) {
      const pFill = i < this.playerWins ? "var(--cyan)" : "transparent";
      const oFill = i < this.opponentWins ? "#ff00aa" : "transparent";
      html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--cyan);background:${pFill};margin:0 2px;"></span>`;
      html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid #ff00aa;background:${oFill};margin:0 2px;"></span>`;
    }
    return html;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) { this.engine.stop(); this.showPauseOverlay(); }
    else { this.engine.start(); this.hidePauseOverlay(); }
  }

  private showPauseOverlay(): void {
    if (this.el.querySelector(".pause-overlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "pause-overlay";
    overlay.innerHTML = '<span class="pause-text">PAUSED</span>';
    const boards = this.el.querySelector(".game-boards");
    if (boards) { (boards as HTMLElement).style.position = "relative"; boards.appendChild(overlay); }
  }

  private hidePauseOverlay(): void {
    this.el.querySelector(".pause-overlay")?.remove();
  }

  saveHighScore(): void { this.engine.saveHighScore(); }
  getScore(): number { return this.engine.score; }
  getIsNewHighScore(): boolean { return this.engine.getIsNewHighScore(); }
  getHighScore(): number { return this.engine.getHighScore(); }
  getPlayerWins(): number { return this.playerWins; }
  getOpponentWins(): number { return this.opponentWins; }

  destroy(): void {
    this.engine.stop();
    this.music.stop();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.particles.destroy();
    this.touchControls?.destroy();
    this.el.remove();
  }

  private createMuteButton(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "hud-icon-btn";
    const update = (): void => { btn.textContent = this.sounds.muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"; };
    update();
    const toggle = (): void => { this.sounds.toggleMute(); this.music.muted = this.sounds.muted; update(); };
    btn.style.touchAction = "manipulation";
    btn.addEventListener("click", toggle);
    btn.addEventListener("touchend", (e) => { e.preventDefault(); toggle(); }, { passive: false });
    return btn;
  }

  private createQuitButton(): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "hud-icon-btn";
    btn.textContent = "\u2715";
    btn.style.touchAction = "manipulation";
    btn.addEventListener("click", () => this.onQuit?.());
    btn.addEventListener("touchend", (e) => { e.preventDefault(); this.onQuit?.(); }, { passive: false });
    return btn;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
