export class ScreenEffects {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  flash(color: string = "#ff0000", duration: number = 200): void {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 999;
      background: ${color}; opacity: 0.3;
      transition: opacity ${duration}ms ease-out;
    `;
    this.container.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), duration);
    });
  }

  shake(intensity: number = 5, duration: number = 300): void {
    const el = this.container;
    const start = performance.now();

    const shakeLoop = (now: number) => {
      const elapsed = now - start;
      if (elapsed > duration) {
        el.style.transform = "";
        return;
      }
      const progress = 1 - elapsed / duration;
      const x = (Math.random() - 0.5) * intensity * progress;
      const y = (Math.random() - 0.5) * intensity * progress;
      el.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(shakeLoop);
    };

    requestAnimationFrame(shakeLoop);
  }
}
