export class MusicEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private running = false;
  private bpm = 85;
  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem("snakey-muted") === "true";
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.ctx = new AudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.muted ? 0 : 0.08;
    this.gainNode.connect(this.ctx.destination);

    const stepDuration = (60 / this.bpm / 4) * 1000;

    // Looping bass pattern
    const bassNotes = [65, 65, 82, 82, 73, 73, 98, 98]; // C2, E2, D2, G2 pattern

    this.stepTimer = setInterval(() => {
      if (!this.ctx || !this.gainNode) return;

      const note = bassNotes[this.step % bassNotes.length];
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.value = note;
      osc.connect(env);
      env.connect(this.gainNode);

      const now = this.ctx.currentTime;
      env.gain.setValueAtTime(0.5, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + stepDuration / 1000 * 0.8);

      osc.start(now);
      osc.stop(now + stepDuration / 1000);

      this.step++;
    }, stepDuration);
  }

  stop(): void {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    for (const osc of this.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.oscillators = [];
    this.ctx?.close();
    this.ctx = null;
    this.gainNode = null;
    this.running = false;
    this.step = 0;
  }

  set volume(v: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = this.muted ? 0 : v;
    }
  }
}
