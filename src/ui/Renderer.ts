import { COLS, ROWS, CELL_COLORS, HEAD_COLORS } from "../game/constants";
import { SnakeSegment } from "../types";

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cellSize = 0;
    this.resize();
  }

  resize(): void {
    const container = this.canvas.parentElement!;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    this.cellSize = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    this.canvas.width = this.cellSize * COLS;
    this.canvas.height = this.cellSize * ROWS;
  }

  drawGrid(grid: number[][], playerHead?: SnakeSegment, opponentHead?: SnakeSegment, level: number = 0): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Level-based background hue shifting
    const hue = (260 + level * 15) % 360;
    const intensity = Math.min(level * 0.02, 0.2);
    ctx.fillStyle = `hsla(${hue}, 50%, ${4 + intensity * 4}%, 1)`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines with hue-aware coloring
    const gridAlpha = 0.12 + intensity * 0.2;
    ctx.strokeStyle = `hsla(${hue}, 35%, 18%, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, ROWS * cs);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cs);
      ctx.lineTo(COLS * cs, y * cs);
      ctx.stroke();
    }

    // Cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell === 0) continue;

        const isPlayerHead = playerHead && playerHead.x === x && playerHead.y === y;
        const isOpponentHead = opponentHead && opponentHead.x === x && opponentHead.y === y;

        let color: string;
        let glow = false;

        if (isPlayerHead) {
          color = HEAD_COLORS[1];
          glow = true;
        } else if (isOpponentHead) {
          color = HEAD_COLORS[2];
          glow = true;
        } else if (cell === 3) {
          // Score food — yellow glow
          color = CELL_COLORS[cell];
          glow = true;
        } else if (cell === 5) {
          // Obstacle food — red glow
          color = CELL_COLORS[cell];
          glow = true;
        } else if (cell === 6) {
          // Shrink food — purple glow
          color = CELL_COLORS[cell];
          glow = true;
        } else {
          color = CELL_COLORS[cell] ?? "#666";
        }

        this.drawCell(x * cs, y * cs, cs, color, glow);
      }
    }
  }

  private drawCell(x: number, y: number, size: number, color: string, glow: boolean = false): void {
    const ctx = this.ctx;

    if (glow) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
    }

    // Main cell fill
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Highlight: top-left edge shine
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x + 1, y + 1, size - 2, 2);
    ctx.fillRect(x + 1, y + 1, 2, size - 2);
  }

  drawMiniGrid(grid: number[][]): void {
    const ctx = this.ctx;
    const miniCell = Math.floor(this.cellSize * 0.4);
    const offsetX = (this.canvas.width - miniCell * COLS) / 2;

    ctx.globalAlpha = 0.6;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const cell = grid[y][x];
        if (cell === 0) continue;
        const color = CELL_COLORS[cell] ?? "#666";
        this.drawCell(offsetX + x * miniCell, y * miniCell, miniCell, color);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawCountdown(count: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.textAlign = "center";

    if (count > 0) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 72px Orbitron, monospace";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00f0f0";
    } else {
      ctx.fillStyle = "#00f0f0";
      ctx.font = "bold 80px Orbitron, monospace";
      ctx.shadowBlur = 40;
      ctx.shadowColor = "#00f0f0";
    }

    ctx.fillText(
      count > 0 ? String(count) : "GO!",
      this.canvas.width / 2,
      this.canvas.height / 2 + 24
    );

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.textAlign = "start";
  }

  drawScorePopup(text: string, x: number, y: number, progress: number): void {
    const ctx = this.ctx;
    const alpha = 1 - progress;
    const offsetY = -30 * progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffff00";
    ctx.font = "bold 16px Orbitron, monospace";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ffff00";
    ctx.fillText(text, x, y + offsetY);
    ctx.restore();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
