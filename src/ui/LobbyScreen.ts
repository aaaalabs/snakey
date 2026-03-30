const IS_TABLET = window.innerWidth >= 600;
const SELECTOR_FONT = IS_TABLET ? "12px" : "9px";
const SELECTOR_PAD = IS_TABLET ? "14px 8px" : "10px 4px";
const DIFF_PAD = IS_TABLET ? "12px 0" : "8px 0";
const DIFF_SUB_FONT = IS_TABLET ? "9px" : "7px";

interface LobbyCallbacks {
  onSolo: () => void;
  onChallenge: () => void;
  onCancelChallenge: () => void;
  onAcceptChallenge: (opponent: string) => void;
}

export class LobbyScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;
  private callbacks: LobbyCallbacks;
  private _selectedPlayer: string;
  private _selectedDifficulty: string;
  private waiting = false;
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgAnimId = 0;
  private bgSegments: { x: number; y: number; vy: number; vx: number; size: number; color: string; opacity: number }[] = [];

  get selectedPlayer(): string {
    return this._selectedPlayer;
  }

  get selectedDifficulty(): string {
    return this._selectedDifficulty;
  }

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this._selectedPlayer = localStorage.getItem("snakey-player") ?? "";
    this._selectedDifficulty = localStorage.getItem("snakey-difficulty") ?? "normal";
    this.el = document.createElement("div");
    this.el.id = "lobby";
    this.render();
    this.bgCanvas = this.createBackground();
    this.startBackground();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="lobby">
        <h1 class="lobby-title">SNAKEY</h1>
        <p class="lobby-subtitle">Snake Battle Arena</p>
        <div class="lobby-actions">
          <input type="text" id="playerName" class="name-input" placeholder="Enter your name" value="${this.escapeHtml(this._selectedPlayer)}" />
          <div class="divider"></div>
          <div id="difficulty-selector" style="display:flex; gap:${IS_TABLET ? '10px' : '6px'}; justify-content:center;">
            <button data-diff="chill" class="lobby-btn btn-ghost" style="flex:1; padding:${DIFF_PAD}; font-size:${SELECTOR_FONT};"><div>CHILL</div><div style="font-size:${DIFF_SUB_FONT}; opacity:0.6; margin-top:2px;">×0.5</div></button>
            <button data-diff="normal" class="lobby-btn btn-ghost" style="flex:1; padding:${DIFF_PAD}; font-size:${SELECTOR_FONT};"><div>NORMAL</div><div style="font-size:${DIFF_SUB_FONT}; opacity:0.6; margin-top:2px;">×1</div></button>
            <button data-diff="hard" class="lobby-btn btn-ghost" style="flex:1; padding:${DIFF_PAD}; font-size:${SELECTOR_FONT};"><div>HARD</div><div style="font-size:${DIFF_SUB_FONT}; opacity:0.6; margin-top:2px;">×1.5</div></button>
            <button data-diff="insane" class="lobby-btn btn-ghost" style="flex:1; padding:${DIFF_PAD}; font-size:${SELECTOR_FONT};"><div>INSANE</div><div style="font-size:${DIFF_SUB_FONT}; opacity:0.6; margin-top:2px;">×2</div></button>
          </div>
          <div class="divider"></div>
          <button id="btn-solo" class="lobby-btn btn-primary">Solo Mode</button>
          <button id="btn-challenge" class="lobby-btn btn-secondary">Challenge</button>
          <div id="challenge-list"></div>
        </div>
        <div id="lobby-status" class="lobby-status"></div>
        <div class="controls-hint">
          <p>Swipe to steer · Arrow keys or WASD on desktop</p>
        </div>
      </div>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    // Name input
    const nameInput = this.el.querySelector<HTMLInputElement>("#playerName")!;
    nameInput.addEventListener("input", () => {
      this._selectedPlayer = nameInput.value.trim();
      localStorage.setItem("snakey-player", this._selectedPlayer);
    });

    // Difficulty selector
    const diffBtns = this.el.querySelectorAll("#difficulty-selector button");
    this.updateDiffButtons(diffBtns);
    diffBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this._selectedDifficulty = (btn as HTMLElement).dataset.diff ?? "normal";
        localStorage.setItem("snakey-difficulty", this._selectedDifficulty);
        this.updateDiffButtons(diffBtns);
      });
    });

    // Solo button
    this.el.querySelector("#btn-solo")!.addEventListener("click", () => {
      this.saveName();
      this.callbacks.onSolo();
    });

    // Challenge button
    this.el.querySelector("#btn-challenge")!.addEventListener("click", () => {
      if (this.waiting) {
        this.cancelWaiting();
        this.callbacks.onCancelChallenge();
        return;
      }
      this.saveName();
      this.waiting = true;
      this.updateChallengeButton();
      this.callbacks.onChallenge();
    });
  }

  private saveName(): void {
    if (!this._selectedPlayer) {
      this._selectedPlayer = "Player" + Math.floor(Math.random() * 9999);
      const input = this.el.querySelector<HTMLInputElement>("#playerName");
      if (input) input.value = this._selectedPlayer;
    }
    localStorage.setItem("snakey-player", this._selectedPlayer);
  }

  private updateDiffButtons(btns: NodeListOf<Element>): void {
    btns.forEach(b => {
      const el = b as HTMLElement;
      const active = el.dataset.diff === this._selectedDifficulty;
      el.style.opacity = active ? "1" : "0.5";
      el.style.borderColor = active ? "var(--cyan)" : "rgba(255,255,255,0.08)";
      el.style.color = active ? "var(--cyan)" : "var(--text-mid)";
    });
  }

  private updateChallengeButton(): void {
    const btn = this.el.querySelector("#btn-challenge") as HTMLButtonElement;
    if (!btn) return;
    if (this.waiting) {
      btn.textContent = "Cancel";
      btn.style.opacity = "0.6";
    } else {
      btn.textContent = "Challenge";
      btn.style.opacity = "1";
    }
  }

  setStatus(msg: string): void {
    const el = this.el.querySelector("#lobby-status") as HTMLElement;
    if (el) {
      el.textContent = msg;
      el.classList.remove("has-code");
    }
  }

  cancelWaiting(): void {
    this.waiting = false;
    this.updateChallengeButton();
    this.setStatus("");
  }

  private createBackground(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.zIndex = "-1";
    canvas.style.pointerEvents = "none";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    return canvas;
  }

  private startBackground(): void {
    if (!this.bgCanvas) return;
    const colors = ["#00f0f0", "#00d0d0", "#00b0b0", "#ff00aa", "#cc0088"];
    this.bgSegments = Array.from({ length: 20 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vy: 0.15 + Math.random() * 0.25,
      vx: (Math.random() - 0.5) * 0.3,
      size: 8 + Math.random() * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.02 + Math.random() * 0.04,
    }));

    const ctx = this.bgCanvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      if (!this.bgCanvas) return;
      ctx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
      for (const s of this.bgSegments) {
        s.y += s.vy;
        s.x += s.vx;
        if (s.y > this.bgCanvas.height + s.size) {
          s.y = -s.size;
          s.x = Math.random() * this.bgCanvas.width;
        }
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.color;
        // Draw rounded square (snake segment-like)
        const r = s.size * 0.2;
        ctx.beginPath();
        ctx.moveTo(s.x + r, s.y);
        ctx.lineTo(s.x + s.size - r, s.y);
        ctx.quadraticCurveTo(s.x + s.size, s.y, s.x + s.size, s.y + r);
        ctx.lineTo(s.x + s.size, s.y + s.size - r);
        ctx.quadraticCurveTo(s.x + s.size, s.y + s.size, s.x + s.size - r, s.y + s.size);
        ctx.lineTo(s.x + r, s.y + s.size);
        ctx.quadraticCurveTo(s.x, s.y + s.size, s.x, s.y + s.size - r);
        ctx.lineTo(s.x, s.y + r);
        ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      this.bgAnimId = requestAnimationFrame(draw);
    };
    this.bgAnimId = requestAnimationFrame(draw);
  }

  private stopBackground(): void {
    cancelAnimationFrame(this.bgAnimId);
    this.bgCanvas?.remove();
    this.bgCanvas = null;
  }

  destroy(): void {
    this.stopBackground();
    this.el.remove();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
