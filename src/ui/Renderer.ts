import { COLS, ROWS, CELL_COLORS, HEAD_COLORS } from "../game/constants";
import { SnakeSegment } from "../types";

const FOOD_CELLS = new Set([3, 5, 6]);

// Mix a hex color toward white (amt > 0) or black (amt < 0). [DM02]
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const t = amt > 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.round(Math.min(255, Math.max(0, t)));
  };
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  // Baked sprites (per color+size) — avoids per-frame gradient creation
  private spriteCache = new Map<string, HTMLCanvasElement>();
  private shadowLayer = document.createElement("canvas");
  private frameOverlay: HTMLCanvasElement | null = null;

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
    this.shadowLayer.width = this.canvas.width;
    this.shadowLayer.height = this.canvas.height;
    this.spriteCache.clear();
    this.frameOverlay = null;
  }

  drawGrid(grid: number[][], playerHead?: SnakeSegment, opponentHead?: SnakeSegment, level: number = 0): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const now = performance.now();

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

    // Collect cells by kind
    type Cell = { x: number; y: number; cell: number };
    const snakeCells: Cell[] = [];
    const foodCells: Cell[] = [];
    const solidCells: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell === 0) continue;
        if (cell === 1 || cell === 2) snakeCells.push({ x, y, cell });
        else if (FOOD_CELLS.has(cell)) foodCells.push({ x, y, cell });
        else solidCells.push({ x, y, cell });
      }
    }

    // Connected soft drop shadow under the snakes (offset down-right)
    if (snakeCells.length > 0) {
      const sctx = this.shadowLayer.getContext("2d")!;
      sctx.clearRect(0, 0, this.shadowLayer.width, this.shadowLayer.height);
      const blob = this.getShadowBlobSprite(cs);
      for (const s of snakeCells) {
        sctx.drawImage(blob, s.x * cs + (cs - blob.width) / 2, s.y * cs + (cs - blob.height) / 2);
      }
      ctx.globalAlpha = 0.34;
      ctx.drawImage(this.shadowLayer, cs * 0.16, cs * 0.22);
      ctx.globalAlpha = 1;
    }

    // Obstacles
    for (const s of solidCells) {
      ctx.drawImage(this.getSegmentSprite(CELL_COLORS[s.cell] ?? "#666666", cs), s.x * cs, s.y * cs);
    }

    // Snake segments + heads
    for (const s of snakeCells) {
      const isPlayerHead = playerHead && playerHead.x === s.x && playerHead.y === s.y;
      const isOpponentHead = opponentHead && opponentHead.x === s.x && opponentHead.y === s.y;
      if (isPlayerHead || isOpponentHead) {
        const sprite = this.getHeadSprite(HEAD_COLORS[isPlayerHead ? 1 : 2], cs);
        ctx.drawImage(sprite, s.x * cs - (sprite.width - cs) / 2, s.y * cs - (sprite.height - cs) / 2);
      } else {
        ctx.drawImage(this.getSegmentSprite(CELL_COLORS[s.cell] ?? "#666666", cs), s.x * cs, s.y * cs);
      }
    }

    // Food: bobbing orb (~1Hz) + counter-scaling shadow ellipse beneath
    for (const f of foodCells) {
      const phase = ((f.x * 7 + f.y * 13) % 10) * 0.2 * Math.PI;
      const bob = Math.sin((now / 1000) * Math.PI * 2 + phase); // 1 = up
      const down = (1 - bob) / 2; // 0 = top of bob, 1 = bottom
      const cx = f.x * cs + cs / 2;

      ctx.fillStyle = `rgba(0,0,0,${0.16 + 0.22 * down})`;
      ctx.beginPath();
      ctx.ellipse(cx, f.y * cs + cs * 0.86, cs * (0.2 + 0.13 * down), cs * (0.06 + 0.05 * down), 0, 0, Math.PI * 2);
      ctx.fill();

      const sprite = this.getFoodSprite(CELL_COLORS[f.cell] ?? "#ffffff", cs);
      const lift = bob * cs * 0.1;
      ctx.drawImage(sprite, cx - sprite.width / 2, f.y * cs + cs * 0.42 - lift - sprite.height / 2);
    }

    // Board depth: inner bevel + vignette (baked once per size)
    ctx.drawImage(this.getFrameOverlay(), 0, 0);
  }

  private bakeSprite(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const cached = this.spriteCache.get(key);
    if (cached) return cached;
    const sprite = document.createElement("canvas");
    sprite.width = Math.max(1, w);
    sprite.height = Math.max(1, h);
    draw(sprite.getContext("2d")!);
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  // Rounded body segment: radial gradient (light top-left) + rim highlight
  private getSegmentSprite(color: string, size: number): HTMLCanvasElement {
    return this.bakeSprite(`seg|${color}|${size}`, size, size, (c) => {
      const inset = Math.max(1, size * 0.06);
      const w = size - inset * 2;
      const r = w * 0.26;

      const g = c.createRadialGradient(size * 0.32, size * 0.3, size * 0.06, size * 0.5, size * 0.55, size * 0.8);
      g.addColorStop(0, shadeHex(color, 0.5));
      g.addColorStop(0.45, color);
      g.addColorStop(1, shadeHex(color, -0.45));
      c.beginPath();
      c.roundRect(inset, inset, w, w, r);
      c.fillStyle = g;
      c.fill();

      // Rim: bright top-left, dark bottom-right
      const rim = c.createLinearGradient(0, 0, size, size);
      rim.addColorStop(0, "rgba(255,255,255,0.5)");
      rim.addColorStop(0.5, "rgba(255,255,255,0.05)");
      rim.addColorStop(1, "rgba(0,0,0,0.3)");
      const lw = Math.max(1, size * 0.05);
      c.beginPath();
      c.roundRect(inset + lw / 2, inset + lw / 2, w - lw, w - lw, r);
      c.strokeStyle = rim;
      c.lineWidth = lw;
      c.stroke();
    });
  }

  // Head: slightly larger, glossier, with baked glow
  private getHeadSprite(color: string, size: number): HTMLCanvasElement {
    const pad = Math.ceil(size * 0.28);
    const full = size + pad * 2;
    return this.bakeSprite(`head|${color}|${size}`, full, full, (c) => {
      const s = size * 1.14;
      const o = (full - s) / 2;
      const r = s * 0.3;

      c.shadowBlur = size * 0.45;
      c.shadowColor = color;
      const g = c.createRadialGradient(o + s * 0.32, o + s * 0.28, s * 0.06, o + s * 0.5, o + s * 0.55, s * 0.8);
      g.addColorStop(0, shadeHex(color, 0.7));
      g.addColorStop(0.45, color);
      g.addColorStop(1, shadeHex(color, -0.4));
      c.beginPath();
      c.roundRect(o, o, s, s, r);
      c.fillStyle = g;
      c.fill();
      c.shadowBlur = 0;

      const rim = c.createLinearGradient(o, o, o + s, o + s);
      rim.addColorStop(0, "rgba(255,255,255,0.65)");
      rim.addColorStop(0.5, "rgba(255,255,255,0.08)");
      rim.addColorStop(1, "rgba(0,0,0,0.3)");
      const lw = Math.max(1, size * 0.05);
      c.beginPath();
      c.roundRect(o + lw / 2, o + lw / 2, s - lw, s - lw, r);
      c.strokeStyle = rim;
      c.lineWidth = lw;
      c.stroke();

      // Specular gloss dot
      const gloss = c.createRadialGradient(o + s * 0.32, o + s * 0.26, 0, o + s * 0.32, o + s * 0.26, s * 0.3);
      gloss.addColorStop(0, "rgba(255,255,255,0.6)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gloss;
      c.beginPath();
      c.arc(o + s * 0.32, o + s * 0.26, s * 0.3, 0, Math.PI * 2);
      c.fill();
    });
  }

  // Glossy orb with baked glow halo
  private getFoodSprite(color: string, size: number): HTMLCanvasElement {
    const pad = Math.ceil(size * 0.4);
    const full = size + pad * 2;
    return this.bakeSprite(`food|${color}|${size}`, full, full, (c) => {
      const cx = full / 2;
      const r = size * 0.32;

      c.shadowBlur = size * 0.5;
      c.shadowColor = color;
      const g = c.createRadialGradient(cx - r * 0.4, cx - r * 0.45, r * 0.1, cx, cx, r);
      g.addColorStop(0, shadeHex(color, 0.75));
      g.addColorStop(0.5, color);
      g.addColorStop(1, shadeHex(color, -0.4));
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cx, r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    });
  }

  // Soft dark blob — drawn per snake cell onto the shadow layer, overlaps merge
  private getShadowBlobSprite(size: number): HTMLCanvasElement {
    const d = Math.ceil(size * 1.35);
    return this.bakeSprite(`blob|${size}`, d, d, (c) => {
      const r = d / 2;
      const g = c.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.55, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, d, d);
    });
  }

  // Inner edge bevel (light top/left, dark bottom/right) + vignette
  private getFrameOverlay(): HTMLCanvasElement {
    if (this.frameOverlay) return this.frameOverlay;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const c = document.createElement("canvas");
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    const o = c.getContext("2d")!;
    const edge = Math.max(3, this.cellSize * 0.35);

    const fade = (x0: number, y0: number, x1: number, y1: number, color: string, rect: [number, number, number, number]) => {
      const g = o.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
      o.fillRect(...rect);
    };
    fade(0, 0, 0, edge, "rgba(255,255,255,0.10)", [0, 0, w, edge]);
    fade(0, 0, edge, 0, "rgba(255,255,255,0.10)", [0, 0, edge, h]);
    fade(0, h, 0, h - edge, "rgba(0,0,0,0.4)", [0, h - edge, w, edge]);
    fade(w, 0, w - edge, 0, "rgba(0,0,0,0.4)", [w - edge, 0, edge, h]);

    const vg = o.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.3)");
    o.fillStyle = vg;
    o.fillRect(0, 0, w, h);

    this.frameOverlay = c;
    return c;
  }

  // Flat cell — used by the mini opponent preview only
  private drawCell(x: number, y: number, size: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
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
