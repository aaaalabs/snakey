import { Direction } from "../types";

export class TouchControls {
  private canvas: HTMLCanvasElement;
  private callback: (dir: Direction) => void;
  private startX = 0;
  private startY = 0;
  private threshold = 20;

  private handleTouchStart: (e: TouchEvent) => void;
  private handleTouchEnd: (e: TouchEvent) => void;

  constructor(canvas: HTMLCanvasElement, callback: (dir: Direction) => void) {
    this.canvas = canvas;
    this.callback = callback;

    this.handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.startX = touch.clientX;
      this.startY = touch.clientY;
    };

    this.handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.startX;
      const dy = touch.clientY - this.startY;

      if (Math.abs(dx) < this.threshold && Math.abs(dy) < this.threshold) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        this.callback(dx > 0 ? "right" : "left");
      } else {
        this.callback(dy > 0 ? "down" : "up");
      }
    };

    this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    this.canvas.addEventListener("touchend", this.handleTouchEnd, { passive: false });
  }

  destroy(): void {
    this.canvas.removeEventListener("touchstart", this.handleTouchStart);
    this.canvas.removeEventListener("touchend", this.handleTouchEnd);
  }
}
