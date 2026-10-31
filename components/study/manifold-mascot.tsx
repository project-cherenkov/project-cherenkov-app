"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  FACE_VIEW_ANGLES,
  FrameMonitor,
  LATTICE_EDGES,
  createMotionState,
  projectLattice,
  stepMotion,
  type Projected,
} from "@/lib/manifold-geometry";

export type MascotMood = "idle" | "thinking";
export type MascotRotation = "3d" | "flat";

const CENTER = 60;
const RADIUS = 33;

function edgeLook(depth: number) {
  const t = (depth + 1) / 2;
  return { opacity: 0.16 + 0.76 * t, width: 0.9 + 0.7 * t };
}

function nodeLook(depth: number) {
  const t = (depth + 1) / 2;
  return { r: 1.3 + 1.2 * t, opacity: 0.35 + 0.65 * t };
}

function spark(x: number, y: number, s: number) {
  const k = s * 0.27;
  return `M${x} ${y - s}L${x + k} ${y - k}L${x + s} ${y}L${x + k} ${y + k}L${x} ${y + s}L${x - k} ${y + k}L${x - s} ${y}L${x - k} ${y - k}Z`;
}

const SPARKLES: Array<[number, number, number]> = [
  [20, 32, 3.4],
  [101, 36, 2.6],
  [95, 92, 3.2],
  [25, 90, 2.4],
];

function usePrefersReducedMotion(ref: React.RefObject<SVGSVGElement | null>) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    // Read from the window that owns the element: in the floating
    // (Picture-in-Picture) window that is not the main page's window.
    const win = ref.current?.ownerDocument.defaultView ?? window;
    const query = win.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [ref]);
  return reduced;
}

/**
 * The Neutrino mascot: a glowing "algorithmic manifold" (icosahedral lattice,
 * luminous core, Cherenkov shock ring) on a dark plate.
 *
 * - rotation="3d": the lattice is truly rotated in 3D and projected every
 *   frame by a small requestAnimationFrame loop that writes SVG attributes
 *   directly (no React re-renders).
 * - rotation="flat": the lattice is a static projection that CSS rotates in the
 *   plane. No JavaScript runs per frame, so it is the low-power fallback.
 * - lite: drops trails/sparkles/comet and is always flat. For small avatars.
 *
 * Colours come from the --mf-* tokens in globals.css so they stay in one
 * place and stay soft: no pure white, and nothing flashes faster than ~1 Hz.
 */
export function ManifoldMascot({
  size = 64,
  mood = "idle",
  rotation = "3d",
  lite = false,
  monitor = false,
  onSlow,
  className,
}: {
  size?: number;
  mood?: MascotMood;
  rotation?: MascotRotation;
  lite?: boolean;
  /** Watch the frame rate and call `onSlow` once if 3D cannot keep up. */
  monitor?: boolean;
  onSlow?: () => void;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const edgesRef = useRef<SVGGElement>(null);
  const nodesRef = useRef<SVGGElement>(null);
  const moodRef = useRef<MascotMood>(mood);
  const onSlowRef = useRef(onSlow);
  const reduced = usePrefersReducedMotion(svgRef);

  useEffect(() => {
    moodRef.current = mood;
    onSlowRef.current = onSlow;
  });

  const mode: MascotRotation = lite ? "flat" : rotation;
  const initialState = createMotionState(() => 0.5);
  const angles = mode === "3d" ? initialState : FACE_VIEW_ANGLES;
  const initial = projectLattice(angles, RADIUS, CENTER, CENTER);

  useEffect(() => {
    if (mode !== "3d") return;
    const svg = svgRef.current;
    const edgeGroup = edgesRef.current;
    const nodeGroup = nodesRef.current;
    if (!svg || !edgeGroup || !nodeGroup) return;

    // Use the animation clock of the window that actually shows the mascot.
    // A page that is not visible has its own requestAnimationFrame paused, but
    // the floating window keeps running.
    const win = svg.ownerDocument.defaultView ?? window;
    const lines = Array.from(edgeGroup.children) as SVGLineElement[];
    const dots = Array.from(nodeGroup.children) as SVGCircleElement[];
    const state = createMotionState();
    const points: Projected[] = [];
    const frameMonitor = monitor ? new FrameMonitor() : null;

    const draw = () => {
      projectLattice(state, RADIUS, CENTER, CENTER, points);
      const thinking = moodRef.current === "thinking";
      for (let i = 0; i < LATTICE_EDGES.length; i++) {
        const edge = LATTICE_EDGES[i];
        const line = lines[i];
        const pa = edge ? points[edge[0]] : undefined;
        const pb = edge ? points[edge[1]] : undefined;
        if (!line || !pa || !pb) continue;
        const look = edgeLook((pa.z + pb.z) / 2);
        line.setAttribute("x1", pa.x.toFixed(2));
        line.setAttribute("y1", pa.y.toFixed(2));
        line.setAttribute("x2", pb.x.toFixed(2));
        line.setAttribute("y2", pb.y.toFixed(2));
        line.setAttribute("stroke-opacity", look.opacity.toFixed(2));
        line.setAttribute("stroke-width", look.width.toFixed(2));
      }
      for (let i = 0; i < dots.length; i++) {
        const p = points[i];
        const dot = dots[i];
        if (!p || !dot) continue;
        const look = nodeLook(p.z);
        // A gentle shimmer while thinking: small amplitude, under 1 Hz.
        const shimmer = thinking ? 0.85 + 0.15 * Math.sin(state.time * 5 + i * 1.7) : 1;
        dot.setAttribute("cx", p.x.toFixed(2));
        dot.setAttribute("cy", p.y.toFixed(2));
        dot.setAttribute("r", look.r.toFixed(2));
        dot.setAttribute("fill-opacity", (look.opacity * shimmer).toFixed(2));
      }
    };

    draw();
    if (reduced) return; // one still frame; mood is still shown by the trails

    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      stepMotion(state, dt / 1000, moodRef.current);
      draw();
      if (frameMonitor?.push(dt)) {
        onSlowRef.current?.();
        return; // parent switches to flat; stop driving the lattice
      }
      frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
    return () => win.cancelAnimationFrame(frame);
  }, [mode, reduced, monitor]);

  const id = (name: string) => `mf-${name}-${uid}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={["mf-root", className].filter(Boolean).join(" ")}
      data-mood={mood}
      data-mode={mode}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id("plate")} cx="50%" cy="42%" r="62%">
          <stop offset="0" style={{ stopColor: "var(--mf-plate-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--mf-plate-b)" }} />
        </radialGradient>
        <radialGradient id={id("halo")}>
          <stop offset="0" style={{ stopColor: "var(--mf-core)", stopOpacity: 0.2 }} />
          <stop offset="0.65" style={{ stopColor: "var(--mf-accent)", stopOpacity: 0.09 }} />
          <stop offset="1" style={{ stopColor: "var(--mf-accent)", stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={id("core")}>
          <stop offset="0" style={{ stopColor: "var(--mf-core-hi)", stopOpacity: 0.95 }} />
          <stop offset="0.5" style={{ stopColor: "var(--mf-core)", stopOpacity: 0.82 }} />
          <stop offset="1" style={{ stopColor: "var(--mf-core)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={id("ring")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--mf-accent)", stopOpacity: 0.85 }} />
          <stop offset="0.5" style={{ stopColor: "var(--mf-edge)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--mf-accent)", stopOpacity: 0.85 }} />
        </linearGradient>
        <clipPath id={id("front")}>
          <rect x="0" y={CENTER} width="120" height="60" />
        </clipPath>
      </defs>

      <circle cx="60" cy="60" r="58" fill={`url(#${id("plate")})`} />
      <circle cx="60" cy="60" r="57.2" fill="none" strokeWidth="1.2" style={{ stroke: "var(--mf-rim)" }} />

      <g className="mf-float">
        <circle className="mf-halo" cx="60" cy="60" r="47" fill={`url(#${id("halo")})`} />

        {/* Shock boundary, behind the lattice */}
        <g transform="rotate(-32 60 60)">
          <ellipse cx="60" cy="60" rx="48" ry="16" fill="none" strokeWidth="1.6" stroke={`url(#${id("ring")})`} />
        </g>

        <circle className="mf-core" cx="60" cy="60" r="14" fill={`url(#${id("core")})`} />

        <g key={mode} className={mode === "flat" ? "mf-lattice-flat" : undefined}>
          <g ref={edgesRef} fill="none" strokeLinecap="round" style={{ stroke: "var(--mf-edge)" }}>
            {LATTICE_EDGES.map(([a, b], i) => {
              const pa = initial[a]!;
              const pb = initial[b]!;
              const look = edgeLook((pa.z + pb.z) / 2);
              return (
                <line
                  key={i}
                  x1={pa.x.toFixed(2)}
                  y1={pa.y.toFixed(2)}
                  x2={pb.x.toFixed(2)}
                  y2={pb.y.toFixed(2)}
                  strokeOpacity={look.opacity.toFixed(2)}
                  strokeWidth={look.width.toFixed(2)}
                />
              );
            })}
          </g>
          <g ref={nodesRef} style={{ fill: "var(--mf-node)" }}>
            {initial.map((p, i) => {
              const look = nodeLook(p.z);
              return (
                <circle
                  key={i}
                  className="mf-node"
                  cx={p.x.toFixed(2)}
                  cy={p.y.toFixed(2)}
                  r={look.r.toFixed(2)}
                  fillOpacity={look.opacity.toFixed(2)}
                />
              );
            })}
          </g>
        </g>

        {/* Front half of the shock boundary, in front of the lattice */}
        <g transform="rotate(-32 60 60)">
          <ellipse
            cx="60" cy="60" rx="48" ry="16" fill="none" strokeWidth="1.8"
            stroke={`url(#${id("ring")})`} clipPath={`url(#${id("front")})`}
          />
          {lite ? null : (
            <ellipse
              className="mf-comet" cx="60" cy="60" rx="48" ry="16" pathLength={100}
              fill="none" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="9 91"
              style={{ stroke: "var(--mf-node)" }}
            />
          )}
        </g>

        {lite ? null : (
          <>
            <g className="mf-trails" fill="none" strokeLinecap="round" strokeWidth="1.6" style={{ stroke: "var(--mf-accent)" }}>
              <path className="mf-trail" pathLength={100} strokeDasharray="34 66" d="M16 72A46 46 0 0 1 38 20" />
              <path className="mf-trail mf-trail-b" pathLength={100} strokeDasharray="34 66" d="M104 48A46 46 0 0 1 82 100" />
              <path className="mf-trail mf-trail-c" pathLength={100} strokeDasharray="28 72" d="M30 98A48 48 0 0 0 90 98" style={{ stroke: "var(--mf-edge)" }} />
            </g>
            <g className="mf-sparkles" style={{ fill: "var(--mf-node)" }}>
              {SPARKLES.map(([x, y, s], i) => (
                <path key={i} className="mf-sparkle" d={spark(x, y, s)} />
              ))}
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
