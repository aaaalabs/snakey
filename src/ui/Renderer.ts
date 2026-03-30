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

  drawGrid(grid: number[][], playerHead?: SnakeSegment, opponentHead?: SnakeSegment): void {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid lines
    ctx.strokeStyle = "#1a1a3a";
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

        // Check if this is a head
        const isPlayerHead = playerHead && playerHead.x === x && playerHead.y === y;
        const isOpponentHead = opponentHead && opponentHead.x === x && opponentHead.y === y;

        if (isPlayerHead) {
          ctx.fillStyle = HEAD_COLORS[1];
          ctx.shadowColor = HEAD_COLORS[1];
          ctx.shadowBlur = 12;
        } else if (isOpponentHead) {
          ctx.fillStyle = HEAD_COLORS[2];
          ctx.shadowColor = HEAD_COLORS[2];
          ctx.shadowBlur = 12;
        } else if (cell === 3) {
          // Food glow
          ctx.fillStyle = CELL_COLORS[cell];
          ctx.shadowColor = CELL_COLORS[cell];
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = CELL_COLORS[cell];
          ctx.shadowBlur = 0;
        }

        const padding = 1;
        ctx.fillRect(
          x * cs + padding,
          y * cs + padding,
          cs - padding * 2,
          cs - padding * 2
        );
        ctx.shadowBlur = 0;
      }
    }
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
        ctx.fillStyle = CELL_COLORS[cell] ?? "#666";
        ctx.fillRect(
          offsetX + x * miniCell,
          y * miniCell,
          miniCell - 1,
          miniCell - 1
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
