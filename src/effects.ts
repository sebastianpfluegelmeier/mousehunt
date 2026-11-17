import { drawCheese, heartPath, pawPath, sparkPath, type Rect } from './draw';

type Kind = 'spark' | 'ring' | 'paw' | 'heart' | 'cheese' | 'confetti';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  alpha: number;
}

// Saturated blues and golds: they stand out on the beige floor and sit in the range cats see best.
const SPARK = ['#2f80ff', '#5aa9ff', '#7c5cff', '#f2b705', '#00b3a4', '#ff5d8f'];
const PAW = ['#2f6fe0', '#7c5cff', '#00a396', '#e0a100'];
const HEART = ['#ff5d8f', '#ff7aa8', '#e8457a'];
const CONFETTI = ['#ffcc4d', '#5aa9ff', '#ff5d8f', '#7ee0c3', '#b9a4ff', '#ffffff'];

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export class Effects {
  private ps: Particle[] = [];
  private timers: { t: number; fn: () => void }[] = [];
  flash = 0;
  flashColor = '255,255,255';

  clear() {
    this.ps.length = 0;
    this.timers.length = 0;
    this.flash = 0;
  }

  private add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>) {
    if (this.ps.length > 800) this.ps.shift();
    this.ps.push({
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 10,
      color: '#fff',
      rot: 0,
      vr: 0,
      gravity: 0,
      drag: 0,
      alpha: 1,
      ...p,
    });
  }

  private after(sec: number, fn: () => void) {
    this.timers.push({ t: sec, fn });
  }

  private burst(x: number, y: number, s: number, n: number, colors: readonly string[], speed: [number, number]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const v = rand(speed[0], speed[1]) * s;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.45, 0.95),
        size: rand(0.07, 0.15) * s,
        color: pick(colors),
        rot: rand(0, Math.PI),
        vr: rand(-5, 5),
        drag: 2.8,
      });
    }
  }

  private ring(x: number, y: number, size: number, color: string, life = 0.6) {
    this.add({ kind: 'ring', x, y, size, color, life });
  }

  /** Cat touched an empty spot. */
  sparkle(x: number, y: number, s: number) {
    this.add({ kind: 'paw', x, y, size: s * 0.42, life: 1.4, rot: rand(-0.4, 0.4), color: pick(PAW), alpha: 0.35 });
    this.ring(x, y, s * 0.9, '#2f80ff', 0.55);
    this.burst(x, y, s * 1.3, 18, SPARK, [1.5, 4.5]);
  }

  /** Small sparkles while a paw drags across the screen. */
  trail(x: number, y: number, s: number) {
    for (let i = 0; i < 2; i++) {
      this.add({
        kind: 'spark',
        x: x + rand(-0.1, 0.1) * s,
        y: y + rand(-0.1, 0.1) * s,
        vx: rand(-0.5, 0.5) * s,
        vy: rand(-0.5, 0.5) * s,
        life: rand(0.3, 0.6),
        size: rand(0.05, 0.09) * s,
        color: pick(SPARK),
        rot: rand(0, Math.PI),
        drag: 2,
      });
    }
  }

  /** Cat hit a bridge while the mouse hides beneath it. */
  thud(x: number, y: number, s: number) {
    this.ring(x, y, s * 0.7, '#8a5530', 0.4);
    this.burst(x, y, s * 0.7, 6, ['#c78c52', '#a8743f', '#e0b47e'], [1, 3]);
  }

  celebrateCat(x: number, y: number, s: number, area: Rect) {
    this.flash = 0.8;
    this.flashColor = '255,255,255';
    this.burst(x, y, s, 50, SPARK, [3, 9]);
    for (let k = 0; k < 3; k++) this.after(k * 0.12, () => this.ring(x, y, s * (1.4 + k), '#2f80ff', 0.8));
    for (let k = 0; k < 10; k++) {
      this.after(0.25 + k * 0.22, () => {
        const fx = rand(area.x + s, area.x + area.w - s);
        const fy = rand(area.y + s, area.y + area.h * 0.75);
        const color = pick(SPARK);
        this.burst(fx, fy, s, 26, [color, color, '#ffffff'], [2, 6]);
        this.ring(fx, fy, s * 1.6, color, 0.7);
      });
    }
    for (let k = 0; k < 36; k++) {
      this.after(rand(0, 2.5), () =>
        this.add({
          kind: 'paw',
          x: rand(area.x, area.x + area.w),
          y: area.y - s * 0.5,
          vx: rand(-0.4, 0.4) * s,
          vy: rand(1.6, 3) * s,
          rot: rand(-0.6, 0.6),
          vr: rand(-1.5, 1.5),
          size: rand(0.3, 0.5) * s,
          life: 4,
          color: pick(PAW),
          alpha: 0.9,
        }),
      );
    }
  }

  celebrateMouse(x: number, y: number, s: number, area: Rect) {
    this.flash = 0.4;
    this.flashColor = '255,236,170';
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const v = rand(1.5, 5) * s;
      const heart = i % 2 === 0;
      this.add({
        kind: heart ? 'heart' : 'cheese',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - s * 2,
        gravity: s * 4,
        drag: 1.2,
        size: rand(0.12, 0.2) * s,
        life: rand(1.3, 2.1),
        rot: rand(-0.5, 0.5),
        vr: rand(-3, 3),
        color: pick(HEART),
      });
    }
    for (let k = 0; k < 3; k++) this.after(k * 0.15, () => this.ring(x, y, s * (1.2 + k), '#f2b705', 0.8));
    for (let k = 0; k < 6; k++) {
      this.after(0.3 + k * 0.3, () => {
        const fx = rand(area.x + s, area.x + area.w - s);
        const fy = rand(area.y + s, area.y + area.h * 0.75);
        this.burst(fx, fy, s, 22, ['#f2b705', '#ffcc4d', '#ff5d8f', '#ffffff'], [2, 6]);
      });
    }
    for (let k = 0; k < 80; k++) {
      this.after(rand(0, 2.2), () =>
        this.add({
          kind: Math.random() < 0.15 ? 'cheese' : 'confetti',
          x: rand(area.x, area.x + area.w),
          y: area.y - s * 0.3,
          vx: rand(-0.5, 0.5) * s,
          vy: rand(1.2, 2.4) * s,
          rot: rand(0, TAU),
          vr: rand(-6, 6),
          size: rand(0.1, 0.16) * s,
          life: 4.5,
          color: pick(CONFETTI),
        }),
      );
    }
  }

  update(dt: number) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }
    let n = 0;
    for (const p of this.ps) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      this.ps[n++] = p;
    }
    this.ps.length = n;
    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  draw(c: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const k = p.age / p.life;
      const tailFade = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      switch (p.kind) {
        case 'spark': {
          const r = p.size * (1 - 0.4 * k);
          c.globalAlpha = p.alpha * (1 - k * k);
          c.fillStyle = p.color;
          sparkPath(c, r);
          c.fill();
          c.fillStyle = '#fff';
          sparkPath(c, r * 0.4);
          c.fill();
          break;
        }
        case 'ring': {
          const e = 1 - Math.pow(1 - k, 3);
          c.globalAlpha = p.alpha * (1 - k);
          c.strokeStyle = p.color;
          c.lineWidth = Math.max(1.5, p.size * 0.07 * (1 - k));
          c.beginPath();
          c.arc(0, 0, p.size * (0.25 + 0.75 * e), 0, TAU);
          c.stroke();
          break;
        }
        case 'paw':
          c.globalAlpha = p.alpha * (k > 0.6 ? (1 - k) / 0.4 : 1);
          c.fillStyle = p.color;
          pawPath(c, p.size);
          c.fill();
          break;
        case 'heart':
          c.globalAlpha = p.alpha * tailFade;
          c.fillStyle = p.color;
          heartPath(c, p.size);
          c.fill();
          break;
        case 'cheese':
          c.globalAlpha = p.alpha * tailFade;
          drawCheese(c, p.size);
          break;
        case 'confetti':
          c.globalAlpha = p.alpha * tailFade;
          c.scale(1, Math.cos(p.age * 7 + p.x));
          c.fillStyle = p.color;
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
      }
      c.restore();
    }
  }
}
