import './style.css';
import { Sound } from './audio';
import {
  drawBridge,
  drawDizzy,
  drawGoalGlow,
  drawJoystick,
  drawMouse,
  holeGeometry,
  renderBackground,
  wallThickness,
  type Rect,
} from './draw';
import { Effects } from './effects';
import { DX, DY, generateMaze, type Bridge, type Maze } from './maze';
import { animateMouse, createMouse, moveMouse, type Mouse } from './mouse';

type State = 'menu' | 'playing' | 'caught' | 'escaped';

const DEFAULTS = { side: 'right', speed: '1', size: '1', sound: 'on' };
type Settings = typeof DEFAULTS;

/** Mouse top speed in cells per second for slow / normal / fast. */
const SPEEDS = [2.0, 3.0, 4.2];
/** Target cell size in CSS px for small / medium / large mazes (small maze = big cells). */
const CELL_TARGET = [150, 118, 92];
const JOY_R = 62;
const JOY_DEADZONE = 8;
/** Paw within this many cells of the mouse centre catches it. */
const CATCH_RADIUS = 0.45;
/** Paw within this many cells makes the mouse flinch and squeak. */
const NEAR_MISS = 1.1;
/** Half the bridge deck along the corridor; the mouse centre must be inside it to be hidden. */
const BRIDGE_SAFE = 0.3;

function load<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode); settings just won't persist */
  }
}

const settings: Settings = load('mousehunt.settings', DEFAULTS);
const score = load('mousehunt.score', { cat: 0, mouse: 0 });

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const bg = document.createElement('canvas');
const hud = byId('hud');
const hudTop = byId('hud-top');
const againBtn = byId('btn-again');
const banner = byId('banner');
const menu = byId('menu');

const sound = new Sound();
const effects = new Effects();

let W = 0;
let H = 0;
let dpr = 1;
let panel: Rect = { x: 0, y: 0, w: 0, h: 0 };
let area: Rect = { x: 0, y: 0, w: 0, h: 0 };
let joyZone: Rect = { x: 0, y: 0, w: 0, h: 0 };
let cs = 100;
let ox = 0;
let oy = 0;

let state: State = 'menu';
let maze!: Maze;
let mouse!: Mouse;
let squeakIn = 1;
let againTimer = 0;

// ---------- layout ----------

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function safeInsets() {
  const s = getComputedStyle(byId('safe-probe'));
  return {
    t: parseFloat(s.paddingTop) || 0,
    r: parseFloat(s.paddingRight) || 0,
    b: parseFloat(s.paddingBottom) || 0,
    l: parseFloat(s.paddingLeft) || 0,
  };
}

function layout() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ins = safeInsets();
  const landscape = W >= H;
  // "left" means left in landscape and top in portrait.
  const first = settings.side === 'left';
  if (landscape) {
    const pw = Math.round(clamp(W * 0.2, 190, 260));
    panel = first ? { x: 0, y: 0, w: pw + ins.l, h: H } : { x: W - pw - ins.r, y: 0, w: pw + ins.r, h: H };
    const left = first ? panel.w : ins.l;
    const right = first ? W - ins.r : panel.x;
    area = { x: left, y: ins.t, w: right - left, h: H - ins.t - ins.b };
  } else {
    const ph = Math.round(clamp(H * 0.2, 200, 260));
    panel = first ? { x: 0, y: 0, w: W, h: ph + ins.t } : { x: 0, y: H - ph - ins.b, w: W, h: ph + ins.b };
    const top = first ? panel.h : ins.t;
    const bottom = first ? H - ins.b : panel.y;
    area = { x: ins.l, y: top, w: W - ins.l - ins.r, h: bottom - top };
  }

  Object.assign(hud.style, {
    left: `${panel.x}px`,
    top: `${panel.y}px`,
    width: `${panel.w}px`,
    height: `${panel.h}px`,
  });
  hud.classList.toggle('portrait', !landscape);
  const tb = hudTop.getBoundingClientRect();
  const pad = 16;
  const bottomInset = panel.y + panel.h >= H - 1 ? ins.b : 0;
  joyZone = {
    x: panel.x + pad,
    y: tb.bottom + pad,
    w: panel.w - pad * 2,
    h: panel.y + panel.h - bottomInset - pad - (tb.bottom + pad),
  };

  if (maze) {
    fitMaze();
    redrawBackground();
  }
}

function gridSize() {
  const t = CELL_TARGET[Number(settings.size)] ?? CELL_TARGET[1];
  return {
    cols: Math.max(4, Math.round(area.w / t - 0.9)),
    rows: Math.max(3, Math.round(area.h / t - 0.9)),
  };
}

/** Scales the current maze to the play area, leaving ~half a cell of margin for the hole. */
function fitMaze() {
  // Floor of 10px keeps drawing valid while a window is momentarily tiny (e.g. mid-resize).
  cs = Math.max(10, Math.min(area.w / (maze.cols + 0.9), area.h / (maze.rows + 0.9)));
  ox = area.x + (area.w - maze.cols * cs) / 2;
  oy = area.y + (area.h - maze.rows * cs) / 2;
  const box = banner.style;
  box.left = `${ox}px`;
  box.top = `${oy}px`;
  box.width = `${maze.cols * cs}px`;
  box.height = `${maze.rows * cs}px`;
}

function redrawBackground() {
  renderBackground(bg, dpr, W, H, panel, maze, ox, oy, cs);
}

const toPx = (cx: number, cy: number) => ({ x: ox + (cx + 0.5) * cs, y: oy + (cy + 0.5) * cs });
const mazeRect = (): Rect => ({ x: ox, y: oy, w: maze.cols * cs, h: maze.rows * cs });

// ---------- rounds ----------

function newMaze() {
  const g = gridSize();
  maze = generateMaze(g.cols, g.rows);
  fitMaze();
  redrawBackground();
  mouse = createMouse(maze.start.x, maze.start.y, maze.goalDir);
}

function startRound() {
  newMaze();
  effects.clear();
  state = 'playing';
  banner.hidden = true;
  againBtn.hidden = true;
  window.clearTimeout(againTimer);
  squeakIn = 0.5;
}

function endRound(title: string, text: string) {
  byId('banner-title').textContent = title;
  byId('banner-text').textContent = text;
  banner.hidden = false;
  joy.id = -1;
  updateScore();
  save('mousehunt.score', score);
  // Short delay so a cat pawing at the celebration does not hit "Play again" right away.
  againTimer = window.setTimeout(() => (againBtn.hidden = false), 1500);
}

function catchMouse() {
  state = 'caught';
  mouse.caughtT = 0;
  score.cat++;
  const p = toPx(mouse.x, mouse.y);
  effects.celebrateCat(p.x, p.y, cs, mazeRect());
  sound.caught();
  sound.squeak();
  endRound('Gotcha!', 'Your cat caught the mouse. Good kitty!');
}

function escapeMouse() {
  state = 'escaped';
  mouse.homeT = 0;
  score.mouse++;
  const h = holeGeometry(maze, ox, oy, cs);
  effects.celebrateMouse(h.x, h.y, cs, mazeRect());
  sound.escaped();
  endRound('Safe at home!', 'The mouse made it through the maze.');
}

function updateScore() {
  byId('score-cat').textContent = String(score.cat);
  byId('score-mouse').textContent = String(score.mouse);
}

/** The bridge the mouse is currently hiding under, if any. */
function hidingUnder(): Bridge | undefined {
  return maze.bridges.find(
    (b) =>
      Math.round(mouse.x) === b.x &&
      Math.round(mouse.y) === b.y &&
      Math.abs(b.axis === 'h' ? mouse.x - b.x : mouse.y - b.y) <= BRIDGE_SAFE,
  );
}

function bridgeAt(x: number, y: number): Bridge | undefined {
  const wt = wallThickness(cs);
  return maze.bridges.find((b) => {
    const p = toPx(b.x, b.y);
    const along = b.axis === 'h' ? x - p.x : y - p.y;
    const across = b.axis === 'h' ? y - p.y : x - p.x;
    return Math.abs(along) < cs * 0.4 && Math.abs(across) < cs * 0.5 + wt;
  });
}

const catchable = () => state === 'playing' && mouse.spawn >= 1 && !hidingUnder();

// ---------- input ----------

interface Paw {
  x: number;
  y: number;
  lastTrail: number;
}
const paws = new Map<number, Paw>();
const joy = { id: -1, base: { x: 0, y: 0 }, knob: { x: 0, y: 0 } };
const keys = new Set<string>();

const inRect = (x: number, y: number, r: Rect) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

/** Keeps the knob within reach: if the finger drifts past the rim, the base follows it. */
function followFinger() {
  const dx = joy.knob.x - joy.base.x;
  const dy = joy.knob.y - joy.base.y;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) {
    joy.base.x = joy.knob.x - (dx / d) * JOY_R;
    joy.base.y = joy.knob.y - (dy / d) * JOY_R;
  }
  const m = JOY_R * 0.6;
  joy.base.x = clamp(joy.base.x, joyZone.x + m, joyZone.x + joyZone.w - m);
  joy.base.y = clamp(joy.base.y, joyZone.y + m, joyZone.y + joyZone.h - m);
}

function readInput() {
  if (joy.id !== -1) {
    const dx = joy.knob.x - joy.base.x;
    const dy = joy.knob.y - joy.base.y;
    const d = Math.hypot(dx, dy);
    if (d < JOY_DEADZONE) return { x: 0, y: 0, mag: 0 };
    return { x: dx / d, y: dy / d, mag: clamp((d - JOY_DEADZONE) / (JOY_R - JOY_DEADZONE), 0, 1) };
  }
  const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  const ky = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  if (!kx && !ky) return { x: 0, y: 0, mag: 0 };
  const d = Math.hypot(kx, ky);
  return { x: kx / d, y: ky / d, mag: 1 };
}

function pawDown(x: number, y: number) {
  if (state === 'menu') return;
  const mp = toPx(mouse.x, mouse.y);
  const d = Math.hypot(x - mp.x, y - mp.y);
  if (catchable() && d < cs * CATCH_RADIUS) {
    catchMouse();
    return;
  }
  const bridge = bridgeAt(x, y);
  if (bridge) {
    bridge.wobble = 1;
    effects.thud(x, y, cs);
    sound.thud();
  } else {
    effects.sparkle(x, y, cs);
    sound.sparkle();
  }
  if (state === 'playing' && d < cs * NEAR_MISS) {
    mouse.startle = 1;
    sound.squeak();
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const { clientX: x, clientY: y } = e;
  if (inRect(x, y, panel)) {
    if (state === 'playing' && joy.id === -1) {
      joy.id = e.pointerId;
      joy.base = { x, y };
      joy.knob = { x, y };
      followFinger();
    }
    return;
  }
  paws.set(e.pointerId, { x, y, lastTrail: performance.now() });
  pawDown(x, y);
});

window.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    joy.knob = { x: e.clientX, y: e.clientY };
    followFinger();
    return;
  }
  const p = paws.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  const now = performance.now();
  if (now - p.lastTrail > 35 && state !== 'menu') {
    p.lastTrail = now;
    effects.trail(p.x, p.y, cs);
  }
});

const pointerEnd = (e: PointerEvent) => {
  if (e.pointerId === joy.id) joy.id = -1;
  paws.delete(e.pointerId);
};
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', pointerEnd);

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  keys.add(k);
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys.delete(k);
});
window.addEventListener('blur', () => keys.clear());

// Stop iOS Safari from scrolling, pinch-zooming or rubber-banding the page.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- update / render ----------

function update(dt: number) {
  effects.update(dt);
  for (const b of maze.bridges) b.wobble = Math.max(0, b.wobble - dt * 2.5);

  let moved = 0;
  if (state === 'playing') {
    const inp = readInput();
    if (inp.mag > 0) {
      const speed = SPEEDS[Number(settings.speed)] ?? SPEEDS[1];
      moved = moveMouse(mouse, maze, inp.x, inp.y, speed * (0.35 + 0.65 * inp.mag) * dt);
    }

    const g = maze.goal;
    const gd = maze.goalDir;
    const out = (mouse.x - g.x) * DX[gd] + (mouse.y - g.y) * DY[gd];
    const lateral = Math.abs((mouse.x - g.x) * DY[gd]) + Math.abs((mouse.y - g.y) * DX[gd]);
    if (out > 0.35 && lateral < 0.01) {
      escapeMouse();
    } else if (catchable()) {
      // A paw that stays down still counts when the mouse runs into it.
      const mp = toPx(mouse.x, mouse.y);
      for (const p of paws.values()) {
        if (Math.hypot(p.x - mp.x, p.y - mp.y) < cs * CATCH_RADIUS) {
          catchMouse();
          break;
        }
      }
    }

    squeakIn -= dt;
    if (squeakIn <= 0 && moved > 0) {
      sound.squeak();
      squeakIn = 1.8 + Math.random() * 3;
    }
  } else if (state === 'escaped') {
    // Scurry the rest of the way into the hole.
    const step = Math.min(dt * 2, Math.max(0, 0.9 - ((mouse.x - maze.goal.x) * DX[maze.goalDir] + (mouse.y - maze.goal.y) * DY[maze.goalDir])));
    mouse.x += DX[maze.goalDir] * step;
    mouse.y += DY[maze.goalDir] * step;
    moved = step;
  }
  animateMouse(mouse, dt, moved);
}

function render(t: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (bg.width > 0 && bg.height > 0) ctx.drawImage(bg, 0, 0, W, H);

  const hole = holeGeometry(maze, ox, oy, cs);
  if (state === 'playing' || state === 'menu') drawGoalGlow(ctx, hole, cs, t);

  const mp = toPx(mouse.x, mouse.y);
  ctx.save();
  // Clip to the maze plus the hole, so the mouse disappears into the opening.
  ctx.beginPath();
  ctx.rect(ox, oy, maze.cols * cs, maze.rows * cs);
  ctx.moveTo(hole.x, hole.y);
  ctx.arc(hole.x, hole.y, hole.r, hole.angle - Math.PI / 2, hole.angle + Math.PI / 2);
  ctx.closePath();
  ctx.clip();
  if (mouse.homeT >= 0) ctx.globalAlpha = Math.max(0, 1 - mouse.homeT * 1.6);
  drawMouse(ctx, mouse, mp.x, mp.y, cs);
  ctx.restore();

  const hiding = state === 'playing' ? hidingUnder() : undefined;
  for (const b of maze.bridges) {
    const p = toPx(b.x, b.y);
    drawBridge(ctx, b, p.x, p.y, cs, t, b === hiding);
  }
  if (mouse.caughtT >= 0) drawDizzy(ctx, mp.x, mp.y, cs, t);

  effects.draw(ctx);

  if (state === 'playing') drawJoystick(ctx, joyZone, joy.id !== -1, joy.base, joy.knob, JOY_R);

  if (effects.flash > 0) {
    ctx.fillStyle = `rgba(${effects.flashColor},${effects.flash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}

// ---------- menu, fullscreen, wake lock ----------

function syncMenu() {
  menu.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
    const key = seg.dataset.key as keyof Settings;
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.v === settings[key]));
    });
  });
}

menu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg button');
  if (!b) return;
  const key = b.parentElement!.dataset.key as keyof Settings;
  settings[key] = b.dataset.v!;
  save('mousehunt.settings', settings);
  syncMenu();
  sound.enabled = settings.sound === 'on';
  if (key === 'side') layout();
  if (key === 'size') newMaze();
});

function enterFullscreen() {
  const standalone =
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  const doc = document as Document & { webkitFullscreenElement?: Element };
  if (standalone || doc.fullscreenElement || doc.webkitFullscreenElement) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not supported; the game works without it */
  }
}

let wakeLock: WakeLockSentinel | null = null;
async function keepAwake() {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
  } catch {
    /* denied or unsupported */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state !== 'menu') void keepAwake();
});

byId('btn-play').addEventListener('click', () => {
  sound.unlock();
  sound.enabled = settings.sound === 'on';
  menu.hidden = true;
  enterFullscreen();
  void keepAwake();
  startRound();
  sound.squeak();
});
byId('btn-new').addEventListener('click', () => startRound());
againBtn.addEventListener('click', () => {
  sound.unlock();
  startRound();
});
byId('btn-menu').addEventListener('click', () => {
  state = 'menu';
  banner.hidden = true;
  againBtn.hidden = true;
  window.clearTimeout(againTimer);
  joy.id = -1;
  syncMenu();
  menu.hidden = false;
});

let resizeTimer = 0;
function onResize() {
  const wasLandscape = maze.cols >= maze.rows;
  layout();
  // A maze generated for landscape looks tiny in portrait; start fresh when the iPad is rotated.
  if (wasLandscape !== area.w >= area.h) {
    if (state === 'menu') newMaze();
    else startRound();
  }
}
window.addEventListener('resize', () => {
  onResize();
  // iOS sometimes reports stale sizes right after rotating.
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onResize, 350);
});

// ---------- boot ----------

sound.enabled = settings.sound === 'on';
syncMenu();
updateScore();
layout();
newMaze();
mouse.spawn = 1;
requestAnimationFrame(frame);

// Dev-only handle for poking at the game from the browser console; stripped from production builds.
if (import.meta.env.DEV) {
  Object.assign(window, { game: { get maze() { return maze; }, get mouse() { return mouse; } } });
}
