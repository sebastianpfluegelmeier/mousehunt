export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

export interface Cell {
  x: number;
  y: number;
}

export interface Bridge extends Cell {
  /** Direction the corridor runs underneath the bridge. */
  axis: 'h' | 'v';
  /** 0..1, set when the cat hits the bridge and decays over time. */
  wobble: number;
}

export interface Maze {
  cols: number;
  rows: number;
  /** Bitmask per cell: bit d is set when the cell is open towards direction d. */
  open: Uint8Array;
  start: Cell;
  goal: Cell;
  /** Direction from the goal cell through the outer wall into the mouse hole. */
  goalDir: Dir;
  bridges: Bridge[];
}

const H_STRAIGHT = (1 << 1) | (1 << 3);
const V_STRAIGHT = (1 << 0) | (1 << 2);

const randInt = (n: number) => Math.floor(Math.random() * n);

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function inBounds(m: Maze, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.cols && y < m.rows;
}

export function isOpen(m: Maze, x: number, y: number, d: Dir): boolean {
  if (!inBounds(m, x, y)) return false;
  return (m.open[y * m.cols + x] & (1 << d)) !== 0;
}

function carve(m: Maze, x: number, y: number, d: Dir) {
  const nx = x + DX[d];
  const ny = y + DY[d];
  if (!inBounds(m, nx, ny)) return;
  m.open[y * m.cols + x] |= 1 << d;
  m.open[ny * m.cols + nx] |= 1 << opposite(d);
}

function degree(m: Maze, x: number, y: number): number {
  let v = m.open[y * m.cols + x];
  let n = 0;
  while (v) {
    n += v & 1;
    v >>= 1;
  }
  return n;
}

const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function generateMaze(cols: number, rows: number): Maze {
  // Start and goal sit on opposite ends of the longer axis.
  const horizontal = cols >= rows;
  const start = horizontal ? { x: 0, y: randInt(rows) } : { x: randInt(cols), y: 0 };
  const goal = horizontal ? { x: cols - 1, y: randInt(rows) } : { x: randInt(cols), y: rows - 1 };
  const m: Maze = {
    cols,
    rows,
    open: new Uint8Array(cols * rows),
    start,
    goal,
    goalDir: horizontal ? 1 : 2,
    bridges: [],
  };

  // Depth-first backtracker: long, winding corridors.
  const seen = new Uint8Array(cols * rows);
  const stack: Cell[] = [start];
  seen[start.y * cols + start.x] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const next = shuffle([...DIRS]).find((d) => {
      const nx = c.x + DX[d];
      const ny = c.y + DY[d];
      return inBounds(m, nx, ny) && !seen[ny * cols + nx];
    });
    if (next === undefined) {
      stack.pop();
      continue;
    }
    carve(m, c.x, c.y, next);
    const n = { x: c.x + DX[next], y: c.y + DY[next] };
    seen[n.y * cols + n.x] = 1;
    stack.push(n);
  }

  // A perfect maze is mostly dead ends, which makes the mouse easy prey.
  // Open up most dead ends and add a few extra gaps so there are loops to run around.
  const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })));
  for (const c of cells) {
    if (degree(m, c.x, c.y) !== 1 || Math.random() > 0.6) continue;
    const closed = DIRS.filter((d) => !isOpen(m, c.x, c.y, d) && inBounds(m, c.x + DX[d], c.y + DY[d]));
    const toDeadEnd = closed.filter((d) => degree(m, c.x + DX[d], c.y + DY[d]) === 1);
    const options = toDeadEnd.length ? toDeadEnd : closed;
    if (options.length) carve(m, c.x, c.y, options[randInt(options.length)]);
  }
  for (let k = Math.round(cols * rows * 0.04); k > 0; k--) {
    const c = cells[randInt(cells.length)];
    const closed = DIRS.filter((d) => !isOpen(m, c.x, c.y, d) && inBounds(m, c.x + DX[d], c.y + DY[d]));
    if (closed.length) carve(m, c.x, c.y, closed[randInt(closed.length)]);
  }

  placeBridges(m, cells);
  // Opening into the mouse hole. Added last so it does not count as a corridor above.
  m.open[goal.y * cols + goal.x] |= 1 << m.goalDir;
  return m;
}

/** Bridges go over straight corridor cells, spread out and away from start and goal. */
function placeBridges(m: Maze, shuffledCells: Cell[]) {
  const want = Math.max(2, Math.min(6, Math.round((m.cols * m.rows) / 12)));
  for (const c of shuffledCells) {
    if (m.bridges.length >= want) break;
    const v = m.open[c.y * m.cols + c.x];
    if (v !== H_STRAIGHT && v !== V_STRAIGHT) continue;
    if (manhattan(c, m.start) < 2 || manhattan(c, m.goal) < 2) continue;
    if (m.bridges.some((b) => manhattan(b, c) < 3)) continue;
    m.bridges.push({ x: c.x, y: c.y, axis: v === H_STRAIGHT ? 'h' : 'v', wobble: 0 });
  }
}
