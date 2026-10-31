// Geometry and motion for the Neutrino "algorithmic manifold" mascot.
//
// The lattice is an icosahedron: seen along a vertex-ish axis its outline is a
// hexagon with an interlocking star inside, which is the silhouette in the
// character sheet. Keeping this maths in a pure module (no DOM, no React) means
// the animation loop in the component is a thin shell and the behaviour can be
// unit-tested.

const PHI = (1 + Math.sqrt(5)) / 2;

type Vec3 = readonly [number, number, number];

function normalise([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

// 12 vertices on the unit sphere.
const RAW_VERTICES: Vec3[] = [
  [0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI],
  [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1],
];
export const LATTICE_VERTICES: ReadonlyArray<Vec3> = RAW_VERTICES.map(normalise);

const vertexAt = (index: number): Vec3 => LATTICE_VERTICES[index] ?? [0, 0, 1];

// 30 edges: every pair of vertices separated by the minimum distance.
export const LATTICE_EDGES: ReadonlyArray<readonly [number, number]> = (() => {
  const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let shortest = Infinity;
  for (let i = 0; i < LATTICE_VERTICES.length; i++) {
    for (let j = i + 1; j < LATTICE_VERTICES.length; j++) {
      shortest = Math.min(shortest, distance(vertexAt(i), vertexAt(j)));
    }
  }
  const edges: Array<readonly [number, number]> = [];
  for (let i = 0; i < LATTICE_VERTICES.length; i++) {
    for (let j = i + 1; j < LATTICE_VERTICES.length; j++) {
      if (Math.abs(distance(vertexAt(i), vertexAt(j)) - shortest) < 1e-6) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
})();

export type Angles = { yaw: number; pitch: number; roll: number };

// View straight down a three-fold axis (through the centre of a face). The
// outline is a regular hexagon with an interlocking star inside, matching the
// character sheet. Used for the flat, CSS-rotated fallback.
export const FACE_VIEW_ANGLES: Angles = (() => {
  const [ax, , az] = vertexAt(0);
  const [bx, , bz] = vertexAt(2);
  const [cx, , cz] = vertexAt(8);
  const x = ax + bx + cx;
  const z = az + bz + cz;
  return { yaw: -Math.atan2(x, z), pitch: 0, roll: 0 };
})();
export type Projected = { x: number; y: number; z: number };

const PERSPECTIVE = 0.22;

/**
 * Rotates the lattice (yaw about Y, then pitch about X, then roll about Z) and
 * projects it to the screen with mild perspective. `z` is returned in -1..1
 * (positive = towards the viewer) for depth-cueing edges and nodes.
 */
export function projectLattice(
  angles: Angles,
  radius: number,
  centerX: number,
  centerY: number,
  out: Projected[] = [],
): Projected[] {
  const cy = Math.cos(angles.yaw), sy = Math.sin(angles.yaw);
  const cp = Math.cos(angles.pitch), sp = Math.sin(angles.pitch);
  const cr = Math.cos(angles.roll), sr = Math.sin(angles.roll);

  for (let i = 0; i < LATTICE_VERTICES.length; i++) {
    const [vx, vy, vz] = vertexAt(i);
    // yaw (Y axis)
    const x1 = vx * cy + vz * sy;
    const z1 = -vx * sy + vz * cy;
    // pitch (X axis)
    const y2 = vy * cp - z1 * sp;
    const z2 = vy * sp + z1 * cp;
    // roll (Z axis)
    const x3 = x1 * cr - y2 * sr;
    const y3 = x1 * sr + y2 * cr;

    const scale = 1 / (1 - PERSPECTIVE * z2);
    const point = out[i] ?? (out[i] = { x: 0, y: 0, z: 0 });
    point.x = centerX + x3 * radius * scale;
    point.y = centerY + y3 * radius * scale;
    point.z = z2;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export type MotionMood = "idle" | "thinking";

// radians per second
export const IDLE_YAW_SPEED = 0.1;
export const THINKING_YAW_SPEED = 2.2;

export type MotionState = {
  time: number;
  yaw: number;
  pitch: number;
  roll: number;
  velocity: number;
  spinStart: number;
  spinDuration: number; // 0 when no spin is running
  spinApplied: number;
  nextSpinAt: number;
};

export function createMotionState(rand: () => number = Math.random): MotionState {
  return {
    time: 0,
    yaw: 0.35,
    pitch: 0.42,
    roll: 0,
    velocity: IDLE_YAW_SPEED,
    spinStart: 0,
    spinDuration: 0,
    spinApplied: 0,
    nextSpinAt: 3 + rand() * 3,
  };
}

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const TAU = Math.PI * 2;

/**
 * Advances the motion by `dt` seconds. Idle drifts slowly and, every few
 * seconds, performs one eased full turn ("spins sometimes"). Thinking blends up
 * to a fast steady spin. Mutates and returns `state`.
 */
export function stepMotion(
  state: MotionState,
  dt: number,
  mood: MotionMood,
  rand: () => number = Math.random,
): MotionState {
  // A long gap (tab hidden, debugger) must not teleport the lattice.
  const step = Math.min(Math.max(dt, 0), 0.1);
  state.time += step;

  const target = mood === "thinking" ? THINKING_YAW_SPEED : IDLE_YAW_SPEED;
  state.velocity += (target - state.velocity) * (1 - Math.exp(-step / 0.45));
  state.yaw += state.velocity * step;

  if (state.spinDuration > 0) {
    const progress = Math.min(1, (state.time - state.spinStart) / state.spinDuration);
    const extra = TAU * easeInOutCubic(progress);
    state.yaw += extra - state.spinApplied;
    state.spinApplied = extra;
    if (progress >= 1) {
      state.spinDuration = 0;
      state.spinApplied = 0;
      state.nextSpinAt = state.time + 6 + rand() * 5;
    }
  } else if (mood === "idle" && state.time >= state.nextSpinAt) {
    state.spinStart = state.time;
    state.spinDuration = 1.8 + rand() * 0.8;
    state.spinApplied = 0;
  } else if (mood === "thinking") {
    // Do not start a casual spin right after the thinking burst ends.
    state.nextSpinAt = Math.max(state.nextSpinAt, state.time + 4);
  }

  state.yaw %= TAU;
  const wobble = mood === "thinking" ? 0.1 : 0.05;
  const rate = mood === "thinking" ? 1.9 : 0.7;
  state.pitch = 0.42 + Math.sin(state.time * rate) * wobble;
  state.roll = Math.sin(state.time * 0.5) * 0.06;
  return state;
}

// ---------------------------------------------------------------------------
// Performance monitor (drives the "auto" fallback from 3D to flat rotation)
// ---------------------------------------------------------------------------

export type FrameMonitorOptions = {
  warmupMs: number;
  windowFrames: number;
  slowFrameMs: number;
  ignoreAboveMs: number;
  slowWindowsNeeded: number;
};

const DEFAULT_MONITOR: FrameMonitorOptions = {
  warmupMs: 1500, // ignore start-up jank
  windowFrames: 90,
  slowFrameMs: 1000 / 28, // average below ~28 fps counts as slow
  ignoreAboveMs: 250, // a gap this long means hidden/suspended, not slow
  slowWindowsNeeded: 2, // consecutive slow windows before giving up on 3D
};

export class FrameMonitor {
  private elapsed = 0;
  private sum = 0;
  private count = 0;
  private slowWindows = 0;
  private decided = false;
  private readonly options: FrameMonitorOptions;

  constructor(options: Partial<FrameMonitorOptions> = {}) {
    this.options = { ...DEFAULT_MONITOR, ...options };
  }

  /** Feed one frame's duration in ms. Returns true once, when 3D should be dropped. */
  push(dtMs: number): boolean {
    if (this.decided) return false;
    if (dtMs > this.options.ignoreAboveMs) {
      // Suspended or backgrounded: discard the partial window, keep warm-up progress.
      this.sum = 0;
      this.count = 0;
      return false;
    }
    this.elapsed += dtMs;
    if (this.elapsed < this.options.warmupMs) return false;

    this.sum += dtMs;
    this.count += 1;
    if (this.count < this.options.windowFrames) return false;

    const mean = this.sum / this.count;
    this.sum = 0;
    this.count = 0;
    this.slowWindows = mean > this.options.slowFrameMs ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= this.options.slowWindowsNeeded) {
      this.decided = true;
      return true;
    }
    return false;
  }
}
