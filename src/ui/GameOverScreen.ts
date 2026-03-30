export class GameOverScreen {
  private container: HTMLElement;
  private el: HTMLDivElement;

  constructor(
    container: HTMLElement,
    won: boolean,
    score: number,
    onRematch: () => void,
    onLobby: () => void,
    isNewHighScore: boolean,
    highScore: number,
    opponentName: string
  ) {
    this.container = container;
    this.el = document.createElement("div");
    this.el.className = "game-over-overlay";

    const title = won ? "YOU WIN!" : "GAME OVER";
    const titleClass = won ? "win" : "lose";

    this.el.innerHTML = `
      <div class="game-over-card">
        <h2 class="game-over-title ${titleClass}">${title}</h2>
        ${opponentName ? `<p class="opponent-label">vs ${this.escapeHtml(opponentName)}</p>` : ""}
        <div class="score-display">
          <span class="score-label">Score</span>
          <span class="score-value">${score.toLocaleString()}</span>
        </div>
        ${isNewHighScore ? '<div class="new-high-score">NEW HIGH SCORE!</div>' : ""}
        <div class="high-score-display">
          <span class="hs-label">Best</span>
          <span class="hs-value">${Math.max(score, highScore).toLocaleString()}</span>
        </div>
        <div class="game-over-buttons">
          <button id="rematchBtn" class="btn btn-primary">Rematch</button>
          <button id="lobbyBtn" class="btn btn-secondary">Lobby</button>
        </div>
      </div>
    `;

    this.container.appendChild(this.el);

    this.el.querySelector("#rematchBtn")?.addEventListener("click", onRematch);
    this.el.querySelector("#lobbyBtn")?.addEventListener("click", onLobby);

    // Animate in
    requestAnimationFrame(() => {
      this.el.classList.add("visible");
    });
  }

  destroy(): void {
    this.el.remove();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
