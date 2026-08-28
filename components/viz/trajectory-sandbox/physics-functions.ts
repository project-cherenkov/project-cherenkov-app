// Named-function registry — see the comment in ./types.ts for why vizConfig
// can't hold a literal function. Add a new scenario by adding a key here.
//
// TICKET-02 / ARCH-001: this lives in its own module (rather than inline in
// ./index.tsx, a "use client" component) so ./types.ts's
// isTrajectorySandboxConfig can import PHYSICS_TYPE_KEYS to validate a
// vizConfig's physicsType at the type-guard level — the same place every
// other engine's config validity is decided — without statically pulling
// the client component (and its React/canvas dependencies) into
// viz-engine.tsx's import graph, which would defeat the per-engine dynamic
// import code-splitting that module is built around.
export interface PhysicsInitial {
  speed: number;
  angleDeg: number;
}

export const PHYSICS_FUNCTIONS: Record<
  string,
  {
    position: (
      t: number,
      initial: PhysicsInitial,
      gravity: number,
    ) => { x: number; y: number };
    flightTime: (initial: PhysicsInitial, gravity: number) => number;
  }
> = {
  projectile: {
    position: (t, initial, gravity) => {
      const theta = (initial.angleDeg * Math.PI) / 180;
      const x = initial.speed * Math.cos(theta) * t;
      const y = Math.max(
        initial.speed * Math.sin(theta) * t - 0.5 * gravity * t * t,
        0,
      );
      return { x, y };
    },
    flightTime: (initial, gravity) =>
      (2 * initial.speed * Math.sin((initial.angleDeg * Math.PI) / 180)) /
      gravity,
  },
};

export const PHYSICS_TYPE_KEYS = Object.keys(PHYSICS_FUNCTIONS);
