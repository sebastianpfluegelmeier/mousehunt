import { DX, DY, isOpen, type Bridge, type Maze } from './maze';
import type { Mouse } from './mouse';

type Ctx = CanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hole {
  /** Centre of the opening, on the maze's outer edge. */
  x: number;
  y: number;
  /** Angle pointing out of the maze, into the hole. */
  angle: number;
  r: number;
}

const TAU = Math.PI * 2;
export const wallThickness = (s: number) => Math.max(8, s * 0.15);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

export function holeGeometry(m: Maze, ox: number, oy: number, s: number): Hole {
  const d = m.goalDir;
  return {
    x: ox + (m.goal.x + 0.5 + DX[d] * 0.5) * s,
    y: oy + (m.goal.y + 0.5 + DY[d] * 0.5) * s,
    angle: Math.atan2(DY[d], DX[d]),
    r: s * 0.32,
  };
}

// ---------- shape helpers ----------

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Four-pointed twinkle. */
export function sparkPath(c: Ctx, r: number) {
  const k = r * 0.14;
  c.beginPath();
  c.moveTo(0, -r);
  c.quadraticCurveTo(k, -k, r, 0);
  c.quadraticCurveTo(k, k, 0, r);
  c.quadraticCurveTo(-k, k, -r, 0);
  c.quadraticCurveTo(-k, -k, 0, -r);
  c.closePath();
}

export function starPath(c: Ctx, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}

export function pawPath(c: Ctx, r: number) {
  c.beginPath();
  c.ellipse(0, r * 0.3, r * 0.44, r * 0.36, 0, 0, TAU);
  const toes: [number, number, number][] = [
    [-0.52, -0.14, -0.35],
    [-0.19, -0.5, -0.1],
    [0.19, -0.5, 0.1],
    [0.52, -0.14, 0.35],
  ];
  for (const [tx, ty, rot] of toes) {
    const cx = tx * r;
    const cy = ty * r;
    c.moveTo(cx + Math.cos(rot) * r * 0.17, cy + Math.sin(rot) * r * 0.17);
    c.ellipse(cx, cy, r * 0.17, r * 0.22, rot, 0, TAU);
  }
}

export function heartPath(c: Ctx, r: number) {
  c.beginPath();
  c.moveTo(0, r * 0.9);
  c.bezierCurveTo(-r * 1.25, r * 0.05, -r * 0.7, -r * 1.0, 0, -r * 0.35);
  c.bezierCurveTo(r * 0.7, -r * 1.0, r * 1.25, r * 0.05, 0, r * 0.9);
  c.closePath();
}

export function drawCheese(c: Ctx, r: number) {
  c.beginPath();
  c.moveTo(-r, r * 0.55);
  c.lineTo(r, r * 0.55);
  c.lineTo(r * 0.7, -r * 0.6);
  c.closePath();
  c.fillStyle = '#ffcf3d';
  c.fill();
  c.lineWidth = Math.max(1, r * 0.12);
  c.strokeStyle = '#d99b17';
  c.stroke();
  c.fillStyle = '#e9ac1f';
  ellipse(c, r * 0.25, r * 0.15, r * 0.14, r * 0.12);
  c.fill();
  ellipse(c, -r * 0.35, r * 0.32, r * 0.1, r * 0.08);
  c.fill();
}

// ---------- static background ----------

export function renderBackground(
  bg: HTMLCanvasElement,
  dpr: number,
  W: number,
  H: number,
  panel: Rect,
  m: Maze,
  ox: number,
  oy: number,
  s: number,
) {
  bg.width = Math.round(W * dpr);
  bg.height = Math.round(H * dpr);
  const c = bg.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#2b211c';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#201814';
  c.fillRect(panel.x, panel.y, panel.w, panel.h);

  const wt = wallThickness(s);
  const hole = holeGeometry(m, ox, oy, s);

  // Floor with a faint checker so the grid reads at a glance.
  c.fillStyle = '#f2e3c2';
  roundRect(c, ox - wt / 2, oy - wt / 2, m.cols * s + wt, m.rows * s + wt, wt / 2);
  c.fill();
  c.fillStyle = 'rgba(150,105,50,0.06)';
  for (let j = 0; j < m.rows; j++) {
    for (let i = 0; i < m.cols; i++) if ((i + j) % 2) c.fillRect(ox + i * s, oy + j * s, s, s);
  }

  // Doormat in front of the hole, and the dark opening itself.
  c.save();
  c.translate(hole.x, hole.y);
  c.rotate(hole.angle);
  c.fillStyle = '#4f9a86';
  roundRect(c, -s * 0.4, -s * 0.3, s * 0.3, s * 0.6, s * 0.05);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = Math.max(1, s * 0.018);
  c.beginPath();
  for (let k = 1; k < 5; k++) {
    const y = -s * 0.3 + (k * s * 0.6) / 5;
    c.moveTo(-s * 0.37, y);
    c.lineTo(-s * 0.13, y);
  }
  c.stroke();
  const g = c.createRadialGradient(0, 0, hole.r * 0.2, 0, 0, hole.r);
  g.addColorStop(0, '#0b0705');
  g.addColorStop(1, '#3b2516');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, hole.r, -Math.PI / 2, Math.PI / 2);
  c.closePath();
  c.fill();
  c.restore();

  // Walls: one segment per closed cell edge, drawn in three passes for a raised look.
  const segs: [number, number, number, number][] = [];
  for (let j = 0; j < m.rows; j++) {
    for (let i = 0; i < m.cols; i++) {
      const x0 = ox + i * s;
      const y0 = oy + j * s;
      if (!isOpen(m, i, j, 0)) segs.push([x0, y0, x0 + s, y0]);
      if (!isOpen(m, i, j, 3)) segs.push([x0, y0, x0, y0 + s]);
      if (i === m.cols - 1 && !isOpen(m, i, j, 1)) segs.push([x0 + s, y0, x0 + s, y0 + s]);
      if (j === m.rows - 1 && !isOpen(m, i, j, 2)) segs.push([x0, y0 + s, x0 + s, y0 + s]);
    }
  }
  // Short wall pieces either side of the hole.
  const px = -DY[m.goalDir];
  const py = DX[m.goalDir];
  const gap = hole.r + wt * 0.45;
  for (const side of [-1, 1]) {
    segs.push([
      hole.x + px * side * s * 0.5,
      hole.y + py * side * s * 0.5,
      hole.x + px * side * gap,
      hole.y + py * side * gap,
    ]);
  }
  const pass = (color: string, width: number, dx: number, dy: number) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      c.moveTo(x1 + dx, y1 + dy);
      c.lineTo(x2 + dx, y2 + dy);
    }
    c.stroke();
  };
  pass('rgba(60,35,15,0.25)', wt, wt * 0.3, wt * 0.45);
  pass('#a8743f', wt, 0, 0);
  pass('#d3a266', wt * 0.45, -wt * 0.1, -wt * 0.14);

  // Wooden arch around the hole.
  c.save();
  c.translate(hole.x, hole.y);
  c.rotate(hole.angle);
  c.lineCap = 'round';
  c.strokeStyle = '#7d4b29';
  c.lineWidth = wt * 0.9;
  c.beginPath();
  c.arc(0, 0, hole.r + wt * 0.35, -Math.PI / 2, Math.PI / 2);
  c.stroke();
  c.strokeStyle = '#b97d48';
  c.lineWidth = wt * 0.35;
  c.beginPath();
  c.arc(0, 0, hole.r + wt * 0.35, -Math.PI / 2, Math.PI / 2);
  c.stroke();
  c.restore();
}

// ---------- dynamic pieces ----------

export function drawGoalGlow(c: Ctx, h: Hole, s: number, t: number) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  c.save();
  c.strokeStyle = `rgba(255,204,77,${0.3 + 0.4 * pulse})`;
  c.lineWidth = s * 0.045;
  c.beginPath();
  c.arc(h.x, h.y, h.r * 1.35 + pulse * s * 0.06, 0, TAU);
  c.stroke();
  c.restore();
}

export function drawBridge(c: Ctx, b: Bridge, px: number, py: number, s: number, t: number, safe: boolean) {
  const wt = wallThickness(s);
  const hw = s * 0.34; // half width along the corridor
  const hl = s * 0.5 + wt * 0.55; // half length across it, resting on the walls
  c.save();
  c.translate(px, py);
  if (b.axis === 'v') c.rotate(Math.PI / 2);
  if (b.wobble > 0) {
    c.rotate(Math.sin(t * 45) * 0.06 * b.wobble);
    const k = 1 + 0.05 * b.wobble;
    c.scale(k, k);
  }
  c.fillStyle = 'rgba(60,35,15,0.3)';
  roundRect(c, -hw + s * 0.05, -hl + s * 0.07, hw * 2, hl * 2, s * 0.04);
  c.fill();
  c.fillStyle = '#6b3f20';
  c.fillRect(-hw, -hl, hw * 2, hl * 2);
  const n = 7;
  const ph = (hl * 2) / n;
  const gapW = Math.max(1, s * 0.014);
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? '#b77a45' : '#c78c52';
    c.fillRect(-hw, -hl + i * ph + gapW / 2, hw * 2, ph - gapW);
  }
  c.fillStyle = '#6e4224';
  c.fillRect(-hw - s * 0.02, -hl, s * 0.06, hl * 2);
  c.fillRect(hw - s * 0.04, -hl, s * 0.06, hl * 2);
  c.fillStyle = '#56321a';
  for (const yy of [-hl, 0, hl]) {
    for (const xx of [-hw, hw]) c.fillRect(xx - s * 0.045, yy - s * 0.045, s * 0.09, s * 0.09);
  }
  if (safe) {
    c.strokeStyle = `rgba(90,210,160,${0.55 + 0.3 * Math.sin(t * 6)})`;
    c.lineWidth = s * 0.04;
    roundRect(c, -hw - s * 0.07, -hl - s * 0.07, hw * 2 + s * 0.14, hl * 2 + s * 0.14, s * 0.08);
    c.stroke();
  }
  c.restore();
}

function drawTail(c: Ctx, m: Mouse, L: number, s: number, moving: boolean, caught: boolean) {
  const N = 16;
  const seg = s * 0.048;
  const bend = caught ? 0.04 : moving ? 0.26 : 0.12;
  let x = -L * 0.5;
  let y = 0;
  let a = Math.PI;
  c.strokeStyle = '#e595a2';
  c.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const f = i / N;
    a += Math.sin(m.tailPhase - i * 0.5) * bend * (0.35 + f);
    const nx = x + Math.cos(a) * seg;
    const ny = y + Math.sin(a) * seg;
    c.lineWidth = s * (0.05 - 0.036 * f);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(nx, ny);
    c.stroke();
    x = nx;
    y = ny;
  }
}

/** Top-down mouse facing +x in local space. `s` is the cell size. */
export function drawMouse(c: Ctx, m: Mouse, px: number, py: number, s: number) {
  const L = s * 0.58;
  const B = s * 0.33;
  const caught = m.caughtT >= 0;
  const moving = m.moving && !caught;
  c.save();
  c.translate(px, py);
  let angle = m.angle;
  if (caught) angle += easeOutCubic(Math.min(1, m.caughtT / 0.6)) * TAU;
  c.rotate(angle);
  if (m.startle > 0) c.translate(Math.sin(m.time * 70) * s * 0.025 * m.startle, 0);
  const k = easeOutBack(m.spawn) * (1 + m.startle * 0.25);
  const stretch = moving ? 1 + Math.sin(m.runPhase * 2) * 0.06 : 1;
  c.scale(k * stretch, (k / stretch) * (caught ? 0.85 : 1));

  c.fillStyle = 'rgba(80,50,20,0.22)';
  ellipse(c, s * 0.03, s * 0.05, L * 0.62, B * 0.6);
  c.fill();

  drawTail(c, m, L, s, moving, caught);

  c.fillStyle = '#e9a3ae';
  const feet: [number, number, number][] = [
    [0.26, 1, 0],
    [0.26, -1, Math.PI],
    [-0.24, 1, Math.PI],
    [-0.24, -1, 0],
  ];
  for (const [fx, side, ph] of feet) {
    const stepX = moving ? Math.sin(m.runPhase + ph) * L * 0.12 : 0;
    ellipse(c, fx * L + stepX, side * B * 0.5, B * 0.15, B * 0.1);
    c.fill();
  }

  const fur = c.createRadialGradient(L * 0.05, -B * 0.25, B * 0.1, 0, 0, L * 0.75);
  fur.addColorStop(0, '#a5a9b3');
  fur.addColorStop(1, '#5d616b');
  c.fillStyle = fur;
  ellipse(c, -L * 0.06, 0, L * 0.5, B * 0.52);
  c.fill();
  c.beginPath();
  c.moveTo(L * 0.1, -B * 0.42);
  c.bezierCurveTo(L * 0.45, -B * 0.46, L * 0.7, -B * 0.2, L * 0.8, 0);
  c.bezierCurveTo(L * 0.7, B * 0.2, L * 0.45, B * 0.46, L * 0.1, B * 0.42);
  c.closePath();
  c.fill();

  for (const side of [-1, 1]) {
    const twitch = Math.pow(Math.max(0, Math.sin(m.time * 1.3 + side * 1.1)), 24) * 0.3;
    c.save();
    c.translate(L * 0.24, side * B * 0.45);
    c.rotate(side * (0.3 + twitch));
    c.fillStyle = '#80848e';
    ellipse(c, 0, 0, B * 0.27, B * 0.33);
    c.fill();
    c.fillStyle = '#f0aab6';
    ellipse(c, B * 0.02, side * B * 0.02, B * 0.17, B * 0.22);
    c.fill();
    c.restore();
  }

  for (const side of [-1, 1]) {
    const ex = L * 0.52;
    const ey = side * B * 0.19;
    if (caught) {
      c.strokeStyle = '#1b1b20';
      c.lineWidth = Math.max(1.5, B * 0.05);
      const r = B * 0.07;
      c.beginPath();
      c.moveTo(ex - r, ey - r);
      c.lineTo(ex + r, ey + r);
      c.moveTo(ex + r, ey - r);
      c.lineTo(ex - r, ey + r);
      c.stroke();
    } else {
      c.fillStyle = '#121216';
      ellipse(c, ex, ey, B * 0.075, B * 0.075);
      c.fill();
      c.fillStyle = '#fff';
      ellipse(c, ex + B * 0.025, ey - B * 0.025, B * 0.025, B * 0.025);
      c.fill();
    }
  }

  // Sniffing nose and twitching whiskers while idle.
  const sniffing = !moving && !caught && Math.sin(m.time * 1.1) > 0.1;
  const sniff = sniffing ? Math.sin(m.time * 22) * B * 0.035 : 0;
  c.strokeStyle = 'rgba(35,35,42,0.55)';
  c.lineWidth = Math.max(1, s * 0.008);
  c.beginPath();
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const a = side * (0.55 + j * 0.38) + (sniffing ? Math.sin(m.time * 22 + j) * 0.08 : 0);
      const wl = L * (0.48 - j * 0.06);
      c.moveTo(L * 0.72 + sniff, side * B * 0.06);
      c.lineTo(L * 0.72 + sniff + Math.cos(a) * wl, side * B * 0.06 + Math.sin(a) * wl);
    }
  }
  c.stroke();
  c.fillStyle = '#f08a9c';
  ellipse(c, L * 0.8 + sniff, 0, B * 0.085, B * 0.075);
  c.fill();

  c.restore();
}

export function drawDizzy(c: Ctx, x: number, y: number, s: number, t: number) {
  for (let k = 0; k < 3; k++) {
    const a = t * 5 + (k * TAU) / 3;
    c.save();
    c.translate(x + Math.cos(a) * s * 0.32, y - s * 0.28 + Math.sin(a) * s * 0.1);
    c.rotate(t * 3);
    c.fillStyle = '#ffd23f';
    c.strokeStyle = '#a87908';
    c.lineWidth = 1.5;
    starPath(c, s * 0.08);
    c.fill();
    c.stroke();
    c.restore();
  }
}

export function drawJoystick(
  c: Ctx,
  zone: Rect,
  active: boolean,
  base: { x: number; y: number },
  knob: { x: number; y: number },
  R: number,
) {
  let bx = base.x;
  let by = base.y;
  let kx = knob.x;
  let ky = knob.y;
  if (!active) {
    bx = kx = zone.x + zone.w / 2;
    by = ky = zone.y + zone.h / 2;
  }
  const d = Math.hypot(kx - bx, ky - by);
  if (d > R) {
    kx = bx + ((kx - bx) / d) * R;
    ky = by + ((ky - by) / d) * R;
  }
  c.save();
  c.globalAlpha = active ? 1 : 0.6;
  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.strokeStyle = 'rgba(251,239,217,0.35)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(bx, by, R, 0, TAU);
  c.fill();
  c.stroke();
  // Direction ticks.
  c.fillStyle = 'rgba(251,239,217,0.35)';
  for (let i = 0; i < 4; i++) {
    c.save();
    c.translate(bx, by);
    c.rotate((i * Math.PI) / 2);
    c.beginPath();
    c.moveTo(R - 10, -7);
    c.lineTo(R - 3, 0);
    c.lineTo(R - 10, 7);
    c.closePath();
    c.fill();
    c.restore();
  }
  c.shadowColor = 'rgba(0,0,0,0.4)';
  c.shadowBlur = 10;
  c.shadowOffsetY = 4;
  c.fillStyle = '#ffcc4d';
  c.beginPath();
  c.arc(kx, ky, R * 0.48, 0, TAU);
  c.fill();
  c.restore();
  if (!active && by + R + 34 < zone.y + zone.h + 20) {
    c.save();
    c.fillStyle = 'rgba(251,239,217,0.6)';
    c.font = '600 15px ui-rounded, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('Drag here to steer', bx, by + R + 30);
    c.restore();
  }
}
