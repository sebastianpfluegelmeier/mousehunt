import { DIRS, DX, DY, isOpen, type Dir, type Maze } from './maze';

export interface Mouse {
  /** Position in cell units; cell (i, j) has its centre at (i, j). */
  x: number;
  y: number;
  heading: Dir;
  /** Rendered rotation, eased towards the heading. */
  angle: number;
  moving: boolean;
  time: number;
  tailPhase: number;
  runPhase: number;
  /** 0..1, set on a near miss. */
  startle: number;
  /** 0..1 pop-in animation when a round starts. */
  spawn: number;
  /** Seconds since caught, or -1. */
  caughtT: number;
  /** Seconds since reaching the hole, or -1. */
  homeT: number;
}

const HEADING_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const EPS = 1e-4;

export function createMouse(x: number, y: number, heading: Dir): Mouse {
  return {
    x,
    y,
    heading,
    angle: HEADING_ANGLE[heading],
    moving: false,
    time: 0,
    tailPhase: 0,
    runPhase: 0,
    startle: 0,
    spawn: 0,
    caughtT: -1,
    homeT: -1,
  };
}

/** Grid directions roughly matching the stick, best match first. */
function preferredDirs(ix: number, iy: number): Dir[] {
  return DIRS.map((d) => ({ d, s: DX[d] * ix + DY[d] * iy }))
    .filter((o) => o.s > 0.3)
    .sort((a, b) => b.s - a.s)
    .map((o) => o.d);
}

/**
 * Moves the mouse along corridor centre lines (like a rail), so it never scrapes walls.
 * Between two cells it can only go forward or back; if the stick points sideways it runs
 * to whichever end of the corridor allows that turn. Returns the distance travelled.
 */
export function moveMouse(m: Mouse, maze: Maze, ix: number, iy: number, dist: number): number {
  const wanted = preferredDirs(ix, iy);
  let moved = 0;
  for (let guard = 0; guard < 6 && dist > EPS && wanted.length; guard++) {
    const rx = Math.round(m.x);
    const ry = Math.round(m.y);
    const onVertical = Math.abs(m.x - rx) < EPS;
    const onHorizontal = Math.abs(m.y - ry) < EPS;
    let dir: Dir | undefined;
    let tx: number;
    let ty: number;

    if (onVertical && onHorizontal) {
      m.x = rx;
      m.y = ry;
      dir = wanted.find((d) => isOpen(maze, rx, ry, d));
      if (dir === undefined) break;
      tx = rx + DX[dir];
      ty = ry + DY[dir];
    } else {
      const horiz = onHorizontal;
      if (horiz) m.y = ry;
      else m.x = rx;
      // Corridor endpoints: a is the lower coordinate, b the higher one.
      const ax = horiz ? Math.floor(m.x) : rx;
      const ay = horiz ? ry : Math.floor(m.y);
      const bx = horiz ? ax + 1 : ax;
      const by = horiz ? ay : ay + 1;
      const toA: Dir = horiz ? 3 : 0;
      const toB: Dir = horiz ? 1 : 2;
      const distA = horiz ? m.x - ax : m.y - ay;
      let target: 'a' | 'b' | undefined;
      for (const d of wanted) {
        if (d === toA || d === toB) {
          target = d === toA ? 'a' : 'b';
          break;
        }
        const okA = isOpen(maze, ax, ay, d);
        const okB = isOpen(maze, bx, by, d);
        if (okA && okB) target = distA <= 0.5 ? 'a' : 'b';
        else if (okA) target = 'a';
        else if (okB) target = 'b';
        if (target) break;
      }
      if (!target) break;
      dir = target === 'a' ? toA : toB;
      tx = target === 'a' ? ax : bx;
      ty = target === 'a' ? ay : by;
    }

    const remaining = Math.abs(tx - m.x) + Math.abs(ty - m.y);
    const step = Math.min(dist, remaining);
    m.x += DX[dir] * step;
    m.y += DY[dir] * step;
    if (step >= remaining - EPS) {
      m.x = tx;
      m.y = ty;
    }
    m.heading = dir;
    dist -= step;
    moved += step;
  }
  return moved;
}

export function animateMouse(m: Mouse, dt: number, moved: number) {
  m.time += dt;
  m.moving = moved > 1e-5;
  const diff = HEADING_ANGLE[m.heading] - m.angle;
  m.angle += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, dt * 16);
  if (m.caughtT < 0) m.tailPhase += dt * (m.moving ? 17 : 3.2);
  m.runPhase += moved * Math.PI * 2 * 3.2;
  m.startle = Math.max(0, m.startle - dt * 2.5);
  m.spawn = Math.min(1, m.spawn + dt * 2.5);
  if (m.caughtT >= 0) m.caughtT += dt;
  if (m.homeT >= 0) m.homeT += dt;
}
