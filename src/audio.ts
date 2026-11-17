/** Tiny synthesized sound effects, so there are no audio files to load. */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private lastSparkle = 0;

  /** Must run inside a user gesture on iOS, otherwise the context stays suspended. */
  unlock() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.6;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  private tone(type: OscillatorType, delay: number, dur: number, vol: number, f0: number, f1 = f0, f2 = f1) {
    if (!this.enabled || !this.ctx || !this.out) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** One to three short high chirps, roughly in the range of a real mouse squeak. */
  squeak() {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = 2700 + Math.random() * 900;
      this.tone('sine', i * 0.12 + Math.random() * 0.03, 0.09, 0.22, f * 0.85, f * 1.25, f);
    }
  }

  sparkle() {
    const now = performance.now();
    if (now - this.lastSparkle < 90) return;
    this.lastSparkle = now;
    const notes = [1568, 1760, 2093, 2349, 2637, 3136];
    for (let i = 0; i < 2; i++) {
      const f = notes[Math.floor(Math.random() * notes.length)];
      this.tone('sine', i * 0.05, 0.28, 0.07, f);
    }
  }

  thud() {
    this.tone('triangle', 0, 0.14, 0.3, 260, 170, 120);
  }

  caught() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone('triangle', i * 0.09, 0.2, 0.22, f));
    [1046.5, 1318.5, 1568].forEach((f) => this.tone('sine', 0.4, 0.7, 0.12, f));
  }

  escaped() {
    [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => this.tone('triangle', i * 0.08, 0.22, 0.2, f));
    [783.99, 987.77, 1174.66].forEach((f) => this.tone('sine', 0.45, 0.7, 0.1, f));
  }
}
