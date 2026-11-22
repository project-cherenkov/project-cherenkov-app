"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Particle = { id: number; x: number; y: number; time: number; kind: "star" | "lattice"; size: number; turn: number };
const LIFETIME = 1500;
const PIXEL_UNIT = 2;

// Samples the visible mascot position, so the same cosmic trail follows both
// the ambient screen-wide drift and direct pointer dragging.
export function CompanionTrail({
  targetRef,
  enabled,
  active,
  pixel = false,
}: {
  targetRef: RefObject<HTMLButtonElement | null>;
  enabled: boolean;
  active: boolean;
  /** Square cells instead of stars and lattice fragments. */
  pixel?: boolean;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const previous = useRef<{ x: number; y: number } | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) {
      previous.current = null;
      setParticles([]);
      return undefined;
    }
    if (!active) previous.current = null;

    const timer = window.setInterval(() => {
      const rect = active ? targetRef.current?.getBoundingClientRect() : null;
      const point = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
      const last = point ? previous.current : null;
      previous.current = point;
      const now = performance.now();
      setParticles((current) => {
        const live = current.filter((particle) => now - particle.time < LIFETIME);
        if (point && last && Math.hypot(point.x - last.x, point.y - last.y) >= 3) {
          const id = nextId.current++;
          live.push({ id, x: last.x, y: last.y, time: now, kind: id % 3 === 0 ? "lattice" : "star", size: 3 + (id % 4) * 0.8, turn: (id * 47) % 360 });
        }
        if (live.length === current.length) return current;
        return live.slice(-22);
      });
    }, 110);
    return () => window.clearInterval(timer);
  }, [active, enabled, targetRef]);

  return (
    <svg aria-hidden="true" className="companion-cosmos-trail">
      {particles.map((particle) => {
        const age = performance.now() - particle.time;
        if (pixel) {
          // Square cells on a 2px grid that fade in three steps over the same
          // lifetime. Sizes are multiples of the base unit.
          const step = Math.min(2, Math.floor((age / LIFETIME) * 3));
          const opacity = reducedMotion ? 0.55 : [0.6, 0.35, 0.15][step]!;
          const cell = (1 + (particle.id % 3)) * PIXEL_UNIT * 2;
          const x = Math.round(particle.x / PIXEL_UNIT) * PIXEL_UNIT - cell / 2;
          const y = Math.round(particle.y / PIXEL_UNIT) * PIXEL_UNIT - cell / 2;
          return <rect key={particle.id} x={x} y={y} width={cell} height={cell} opacity={opacity} shapeRendering="crispEdges" className="companion-cosmos-star" style={{ filter: "none" }} />;
        }
        const opacity = reducedMotion ? 0.55 : Math.max(0, 0.58 * (1 - age / LIFETIME));
        return particle.kind === "star" ? (
          <path key={particle.id} d="M0 -4L1.1 -1.1L4 0L1.1 1.1L0 4L-1.1 1.1L-4 0L-1.1 -1.1Z" transform={`translate(${particle.x} ${particle.y}) rotate(${particle.turn}) scale(${particle.size / 4})`} opacity={opacity} className="companion-cosmos-star" />
        ) : (
          <g key={particle.id} transform={`translate(${particle.x} ${particle.y}) rotate(${particle.turn}) scale(${particle.size / 5})`} opacity={opacity} className="companion-cosmos-lattice">
            <path d="M-5 -3L4 -4L2 5ZM-5 -3L2 5M4 -4L2 5" />
            <circle cx="-5" cy="-3" r="0.8" /><circle cx="4" cy="-4" r="0.8" /><circle cx="2" cy="5" r="0.8" />
          </g>
        );
      })}
    </svg>
  );
}
