import { describe, expect, it } from "vitest";
import {
  FACE_VIEW_ANGLES,
  FrameMonitor,
  IDLE_YAW_SPEED,
  LATTICE_EDGES,
  LATTICE_VERTICES,
  THINKING_YAW_SPEED,
  createMotionState,
  projectLattice,
  stepMotion,
} from "./manifold-geometry";

describe("lattice", () => {
  it("is an icosahedron: 12 vertices, 30 equal edges, unit radius", () => {
    expect(LATTICE_VERTICES).toHaveLength(12);
    expect(LATTICE_EDGES).toHaveLength(30);
    for (const [x, y, z] of LATTICE_VERTICES) expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    const lengths = LATTICE_EDGES.map(([a, b]) => {
      const p = LATTICE_VERTICES[a]!;
      const q = LATTICE_VERTICES[b]!;
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    });
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0]!);
  });

  it("every vertex has exactly 5 neighbours", () => {
    const degree = new Array(12).fill(0);
    for (const [a, b] of LATTICE_EDGES) {
      degree[a]++;
      degree[b]++;
    }
    expect(degree.every((d) => d === 5)).toBe(true);
  });
});

describe("projectLattice", () => {
  it("keeps every point inside the plate and depth in -1..1", () => {
    for (let yaw = 0; yaw < 6.3; yaw += 0.7) {
      const points = projectLattice({ yaw, pitch: 0.42, roll: 0.05 }, 33, 60, 60);
      for (const p of points) {
        expect(Math.hypot(p.x - 60, p.y - 60)).toBeLessThan(45);
        expect(p.z).toBeGreaterThanOrEqual(-1.0001);
        expect(p.z).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("the face view is a hexagon outline around two interlocking triangles", () => {
    // Down a three-fold axis the 12 vertices form four rings of three: the
    // middle two rings are the hexagon outline, the end rings are the
    // triangles that make the inner star.
    const points = projectLattice(FACE_VIEW_ANGLES, 33, 60, 60);
    const polar = points
      .map((p) => ({ r: Math.hypot(p.x - 60, p.y - 60), a: Math.atan2(p.y - 60, p.x - 60) }))
      .sort((m, n) => n.r - m.r);
    const outline = polar.slice(0, 6).sort((m, n) => m.a - n.a);
    for (let i = 0; i < 6; i++) {
      const next = outline[(i + 1) % 6]!;
      const step = (((next.a - outline[i]!.a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      expect(step).toBeCloseTo(Math.PI / 3, 2);
    }
    expect(polar[5]!.r).toBeGreaterThan(polar[6]!.r);
  });
});

describe("stepMotion", () => {
  const seeded = () => 0.5;

  it("idle drifts slowly; thinking settles to a much faster spin", () => {
    const idle = createMotionState(seeded);
    const thinking = createMotionState(seeded);
    for (let i = 0; i < 120; i++) {
      stepMotion(idle, 1 / 60, "idle", seeded);
      stepMotion(thinking, 1 / 60, "thinking", seeded);
    }
    expect(idle.velocity).toBeCloseTo(IDLE_YAW_SPEED, 1);
    expect(thinking.velocity).toBeGreaterThan(THINKING_YAW_SPEED * 0.9);
  });

  it("is frame-rate independent: 30 fps and 120 fps end at the same angle", () => {
    const run = (fps: number) => {
      const state = createMotionState(seeded);
      for (let i = 0; i < fps * 2; i++) stepMotion(state, 1 / fps, "thinking", seeded);
      return state.yaw;
    };
    const a = run(30);
    const b = run(120);
    const diff = Math.abs(a - b);
    expect(Math.min(diff, Math.PI * 2 - diff)).toBeLessThan(0.15);
  });

  it("performs an occasional eased spin while idle, then rests", () => {
    const state = createMotionState(seeded);
    let started = false;
    let finished = false;
    for (let i = 0; i < 60 * 20; i++) {
      stepMotion(state, 1 / 60, "idle", seeded);
      if (state.spinDuration > 0) started = true;
      if (started && state.spinDuration === 0) finished = true;
    }
    expect(started).toBe(true);
    expect(finished).toBe(true);
  });

  it("does not start a casual spin while thinking", () => {
    const state = createMotionState(seeded);
    for (let i = 0; i < 60 * 20; i++) stepMotion(state, 1 / 60, "thinking", seeded);
    expect(state.spinDuration).toBe(0);
  });

  it("a long pause does not teleport the lattice", () => {
    const state = createMotionState(seeded);
    const before = state.yaw;
    stepMotion(state, 30, "thinking", seeded);
    expect(Math.abs(state.yaw - before)).toBeLessThan(0.5);
  });
});

describe("FrameMonitor", () => {
  const feed = (monitor: FrameMonitor, ms: number, frames: number) => {
    let slow = false;
    for (let i = 0; i < frames; i++) slow = monitor.push(ms) || slow;
    return slow;
  };

  it("never flags a smooth 60 fps run", () => {
    expect(feed(new FrameMonitor(), 16.7, 60 * 20)).toBe(false);
  });

  it("flags a sustained ~15 fps run, once", () => {
    const monitor = new FrameMonitor();
    expect(feed(monitor, 66, 400)).toBe(true);
    expect(feed(monitor, 66, 400)).toBe(false);
  });

  it("ignores start-up jank and long suspended gaps", () => {
    const monitor = new FrameMonitor();
    expect(feed(monitor, 90, 10)).toBe(false); // inside warm-up
    expect(monitor.push(5000)).toBe(false); // tab was hidden
    expect(feed(monitor, 16.7, 60 * 10)).toBe(false);
  });

  it("needs two consecutive slow windows, so one hiccup is forgiven", () => {
    const monitor = new FrameMonitor({ warmupMs: 0 });
    expect(feed(monitor, 60, 90)).toBe(false); // one slow window
    expect(feed(monitor, 16.7, 90)).toBe(false); // recovers
    expect(feed(monitor, 60, 90)).toBe(false); // slow again but not consecutive
  });
});
