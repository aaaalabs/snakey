interface LobbyCallbacks {
  onSolo: () => void;
  onChallenge: () => void;
  onCancelChallenge: () => void;
  onAcceptChallenge: (opponent: string) => void;
}

export class LobbyScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private callbacks: LobbyCallbacks;
  private _selectedPlayer: string;
  private _selectedDifficulty: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private waiting = false;

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
    this.el.className = "lobby";
    this.statusEl = document.createElement("div");
    this.statusEl.className = "status";
    this.render();
  }

  private render(): void {
    this.el.innerHTML = `
      <h1 class="game-title glitch" data-text="SNAKEY">SNAKEY</h1>
      <p class="subtitle">Snake Battle Arena</p>
      <div class="lobby-form">
        <input type="text" id="playerName" class="input-field" placeholder="Enter your name" value="${this.escapeHtml(this._selectedPlayer)}" />
        <select id="difficulty" class="input-field">
          <option value="chill" ${this._selectedDifficulty === "chill" ? "selected" : ""}>Chill</option>
          <option value="normal" ${this._selectedDifficulty === "normal" ? "selected" : ""}>Normal</option>
          <option value="hard" ${this._selectedDifficulty === "hard" ? "selected" : ""}>Hard</option>
          <option value="insane" ${this._selectedDifficulty === "insane" ? "selected" : ""}>Insane</option>
        </select>
        <button id="soloBtn" class="btn btn-primary">Solo Mode</button>
        <button id="challengeBtn" class="btn btn-secondary">Challenge</button>
        <div id="challengeList" class="challenge-list"></div>
        <input type="text" id="codeInput" class="input-field" placeholder="Enter room code" style="display:none" />
      </div>
    `;

    this.el.appendChild(this.statusEl);
    this.container.innerHTML = "";
    this.container.appendChild(this.el);

    const nameInput = this.el.querySelector<HTMLInputElement>("#playerName")!;
    const diffSelect = this.el.querySelector<HTMLSelectElement>("#difficulty")!;
    const soloBtn = this.el.querySelector<HTMLButtonElement>("#soloBtn")!;
    const challengeBtn = this.el.querySelector<HTMLButtonElement>("#challengeBtn")!;

    nameInput.addEventListener("input", () => {
      this._selectedPlayer = nameInput.value.trim();
      localStorage.setItem("snakey-player", this._selectedPlayer);
    });

    diffSelect.addEventListener("change", () => {
      this._selectedDifficulty = diffSelect.value;
      localStorage.setItem("snakey-difficulty", this._selectedDifficulty);
    });

    soloBtn.addEventListener("click", () => {
      this.saveName();
      this.callbacks.onSolo();
    });

    challengeBtn.addEventListener("click", () => {
      if (this.waiting) {
        this.cancelWaiting();
        this.callbacks.onCancelChallenge();
        return;
      }
      this.saveName();
      this.waiting = true;
      challengeBtn.textContent = "Cancel";
      this.callbacks.onChallenge();
    });

    // Hint for mobile
    const hints = document.querySelector(".hints");
    if (hints) hints.classList.remove("hidden");
  }

  private saveName(): void {
    if (!this._selectedPlayer) {
      this._selectedPlayer = "Player" + Math.floor(Math.random() * 9999);
    }
    localStorage.setItem("snakey-player", this._selectedPlayer);
  }

  setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  cancelWaiting(): void {
    this.waiting = false;
    const btn = this.el.querySelector<HTMLButtonElement>("#challengeBtn");
    if (btn) btn.textContent = "Challenge";
    this.setStatus("");
  }

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.el.remove();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
