export class GameOverScreen {
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private confettiCanvas: HTMLCanvasElement | null = null;
  private confettiAnimId = 0;

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
    this.overlay = document.createElement("div");
    this.overlay.className = "gameover-overlay";

    const title = won ? "VICTORY!" : "DEFEATED";
    const titleClass = won ? "win" : "lose";

    this.overlay.innerHTML = `
      <div class="gameover-content">
        <h2 class="gameover-title ${titleClass}">${title}</h2>
        ${opponentName ? `<div class="gameover-score">vs <span>${this.escapeHtml(opponentName)}</span></div>` : ""}
        <div class="gameover-score">Score <span>${score.toLocaleString()}</span></div>
        ${isNewHighScore ? '<div class="new-high-score">NEW HIGH SCORE!</div>' : ""}
        <div class="gameover-highscore">Best <span>${Math.max(score, highScore).toLocaleString()}</span></div>
        <div class="gameover-buttons">
          <button class="lobby-btn btn-primary" id="go-rematch">Rematch</button>
          <button class="lobby-btn btn-ghost" id="go-lobby">Lobby</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Button events with touch support
    const rematchBtn = this.overlay.querySelector("#go-rematch")!;
    const lobbyBtn = this.overlay.querySelector("#go-lobby")!;

    rematchBtn.addEventListener("click", onRematch);
    rematchBtn.addEventListener("touchend", (e) => { e.preventDefault(); onRematch(); });
    lobbyBtn.addEventListener("click", onLobby);
    lobbyBtn.addEventListener("touchend", (e) => { e.preventDefault(); onLobby(); });

    // Launch confetti for wins or high scores
    if (won || isNewHighScore) {
      this.startConfetti();
    }
  }

  private startConfetti(): void {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.zIndex = "101";
    canvas.style.pointerEvents = "none";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    this.confettiCanvas = canvas;

    const ctx = canvas.getContext("2d")!;
    const colors = ["#00f0f0", "#ff00aa", "#ffff00", "#ffffff", "#a855f7", "#00ff88"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rotation: number; rotSpeed: number; life: number;
    }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        life: 300 + Math.floor(Math.random() * 100),
      });
    }

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        if (frame > p.life) continue;
        alive = true;

        p.x += p.vx;
        p.vy += 0.05; // gravity
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        const alpha = Math.max(0, 1 - frame / p.life);
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      frame++;

      if (alive) {
        this.confettiAnimId = requestAnimationFrame(draw);
      } else {
        canvas.remove();
        this.confettiCanvas = null;
      }
    };

    this.confettiAnimId = requestAnimationFrame(draw);
  }

  destroy(): void {
    cancelAnimationFrame(this.confettiAnimId);
    this.confettiCanvas?.remove();
    this.overlay.remove();
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
