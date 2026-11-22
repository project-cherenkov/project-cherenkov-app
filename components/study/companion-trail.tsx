"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { PIXEL_UNIT, snapToPixel } from "@/lib/pixel-grid";

export type TrailKind = "star" | "lattice" | "pixel";
export type Particle = {
  id: number;
  x: number;
  y: number;
  time: number;
  kind: TrailKind;
  size: number;
  turn: number;
  /** Lifetime in ms. Pixels vary a little so a burst does not vanish at once. */
  life: number;
  /** Pixel cells only: edge length in CSS px (a multiple of PIXEL_UNIT) and colour index. */
  cell: number;
  tone: number;
};

const LIFETIME = 1500;
const SHAPE_CAP = 22;
const PIXEL_CAP = 24;
const TICK_MS = 110;
const PIXEL_JITTER = 6;
export const MAX_PIXEL_CELL = 6;

// A tiny deterministic hash, so a particle's look depends only on its id.
function hash(id: number, salt: number) {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * The pixel cells for one tick: one or two squares on the 2px grid, sprayed a
 * little sideways of the direction of travel. Mostly 2px and 4px, 6px about one
 * time in eight, never larger.
 */
export function pixelCells(startId: number, x: number, y: number, dx: number, dy: number, now: number): Particle[] {
  const count = hash(startId, 1) < 0.5 ? 1 : 2;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index;
    const roll = hash(id, 2);
    const cell = roll < 0.125 ? 3 * PIXEL_UNIT : roll < 0.6 ? PIXEL_UNIT : 2 * PIXEL_UNIT;
    const offset = (hash(id, 3) * 2 - 1) * PIXEL_JITTER;
    return {
      id,
      x: x + nx * offset,
      y: y + ny * offset,
      time: now,
      kind: "pixel" as const,
      size: cell,
      turn: 0,
      life: 900 + Math.round(hash(id, 4) * 300),
      cell,
      tone: Math.floor(hash(id, 5) * 3),
    };
  });
}

// Samples the visible mascot position, so the same cosmic trail follows both
// the ambient screen-wide drift and direct pointer dragging. Stars, polygons
// and pixel cells are always all drawn, in either style.
export function CompanionTrail({
  targetRef,
  enabled,
  active,
}: {
  targetRef: RefObject<HTMLButtonElement | null>;
  enabled: boolean;
  active: boolean;
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

    // The interval only spawns and prunes. Fading is done by CSS, so it keeps
    // going between ticks (and when the mascot has stopped).
    const timer = window.setInterval(() => {
      const rect = active ? targetRef.current?.getBoundingClientRect() : null;
      const point = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
      const last = point ? previous.current : null;
      previous.current = point;
      const now = performance.now();
      setParticles((current) => {
        const live = current.filter((particle) => now - particle.time < particle.life);
        const added: Particle[] = [];
        if (point && last && Math.hypot(point.x - last.x, point.y - last.y) >= 3) {
          const id = nextId.current;
          nextId.current += 3;
          added.push({ id, x: last.x, y: last.y, time: now, kind: id % 9 === 0 ? "lattice" : "star", size: 3 + ((id / 3) % 4) * 0.8, turn: (id * 47) % 360, life: LIFETIME, cell: 0, tone: 0 });
          added.push(...pixelCells(id + 1, last.x, last.y, point.x - last.x, point.y - last.y, now));
        }
        if (added.length === 0 && live.length === current.length) return current;
        const all = [...live, ...added];
        // Pixels have their own pool, so they can never starve the shapes.
        const shapes = all.filter((particle) => particle.kind !== "pixel").slice(-SHAPE_CAP);
        const pixels = all.filter((particle) => particle.kind === "pixel").slice(-PIXEL_CAP);
        return [...pixels, ...shapes];
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [active, enabled, targetRef]);

  const pixels = particles.filter((particle) => particle.kind === "pixel");
  const lattices = particles.filter((particle) => particle.kind === "lattice");
  const stars = particles.filter((particle) => particle.kind === "star");
  const fade = (life: number, extra?: CSSProperties): CSSProperties | undefined =>
    reducedMotion ? { opacity: 0.55, ...extra } : { animationDuration: `${life}ms`, ...extra };

  // Draw order: pixels behind, then polygons, then stars.
  return (
    <svg aria-hidden="true" className="companion-cosmos-trail" data-reduced={reducedMotion ? "true" : "false"}>
      {pixels.map((particle) => (
        <rect
          key={particle.id}
          x={snapToPixel(particle.x - particle.cell / 2)}
          y={snapToPixel(particle.y - particle.cell / 2)}
          width={particle.cell}
          height={particle.cell}
          shapeRendering="crispEdges"
          className="companion-cosmos-pixel"
          data-tone={particle.tone}
          style={fade(particle.life)}
        />
      ))}
      {lattices.map((particle) => (
        <g key={particle.id} transform={`translate(${particle.x} ${particle.y}) rotate(${particle.turn}) scale(${particle.size / 5})`} className="companion-cosmos-lattice" style={fade(particle.life)}>
          <path d="M-5 -3L4 -4L2 5ZM-5 -3L2 5M4 -4L2 5" />
          <circle cx="-5" cy="-3" r="0.8" /><circle cx="4" cy="-4" r="0.8" /><circle cx="2" cy="5" r="0.8" />
        </g>
      ))}
      {stars.map((particle) => (
        <path key={particle.id} d="M0 -4L1.1 -1.1L4 0L1.1 1.1L0 4L-1.1 1.1L-4 0L-1.1 -1.1Z" transform={`translate(${particle.x} ${particle.y}) rotate(${particle.turn}) scale(${particle.size / 4})`} className="companion-cosmos-star" style={fade(particle.life)} />
      ))}
    </svg>
  );
}
