# Neutrino mascot: how it works now

The study companion's mascot ("the algorithmic manifold", M-01) is a draggable, animated SVG. This file records what is built and why. Code is the source of truth.

## What the student sees
- A dark circular plate holding a glowing icosahedral lattice, a bright core, and a tilted pink/blue "Cherenkov shock boundary" ring with a highlight travelling around it.
- **Idle:** gentle vertical hover, slow core pulse, slow drift, and every 6 to 11 seconds one eased full turn ("spins sometimes").
- **Thinking** (while a chat reply is pending): fast steady spin, streaming trails, quicker pulse, small node shimmer.
- Drag it anywhere (pointer), or focus it and use the arrow keys (Shift = bigger steps). Click or Enter opens the panel. Position is stored as a fraction of the available space in `localStorage` (`neutrino-position-v1`), so resizing or rotating a phone never strands it off-screen.
- The panel has three tabs: Study chat, Study timer, Settings. It opens beside the mascot (above or below, whichever has room) and as a bottom sheet under 640px wide.

## Settings (account page and the panel's Settings tab share one component)
| Field | Values | Stored | Signed out |
| --- | --- | --- | --- |
| `name` | 1 to 32 chars | `companion_settings.name` | not available |
| `enabled` | boolean | `companion_settings.enabled` | not available |
| `size` | small 56px, medium 76px, large 104px | `companion_settings.size` | `localStorage` (`neutrino-prefs-v1`) |
| `rotation` | `auto`, `3d`, `flat` | `companion_settings.rotation` | `localStorage` (`neutrino-prefs-v1`) |

`PATCH /api/companion/settings` takes a partial body and rejects the whole request if any field is invalid. Migration `0004_neutrino_mascot_settings` adds the columns with defaults (existing rows become enabled / medium / auto) and CHECK constraints that must stay in sync with `lib/companion-settings.ts`.

All surfaces stay in sync through one window event (`neutrino-prefs-changed`) wired in `use-companion-prefs.ts`; there is no shared provider.

## Rotation modes
- **3d:** `manifold-mascot.tsx` runs a `requestAnimationFrame` loop that rotates the 12 icosahedron vertices (`lib/manifold-geometry.ts`), projects them with mild perspective and writes SVG attributes directly (no React re-render per frame). Back edges and nodes are dimmer and thinner (depth cueing).
- **flat:** a static face-on projection (hexagon outline with an inner star) turned in the plane by CSS keyframes. No JavaScript per frame.
- **auto:** starts in 3d and a `FrameMonitor` watches frame times. If the average stays under about 28 fps for two consecutive 90-frame windows (after a 1.5 s warm-up; gaps over 250 ms are ignored as "tab was hidden"), it switches to flat for the rest of the tab session (`sessionStorage`). Choosing Automatic again retries 3d. Forced `3d` never falls back.
- Small avatars (`lite`, e.g. the panel header) are always flat so they cost nothing.

## Floating window (Document Picture-in-Picture)
The animation loop uses the `requestAnimationFrame` of the window that owns the SVG (`svg.ownerDocument.defaultView`). A page that is not visible has its own `requestAnimationFrame` paused, but the floating window keeps running. CSS animations are unaffected. Only the panel (with its small header avatar) is shown in the floating window, not the draggable mascot.

## Accessibility and comfort
- Colours are the `--mf-*` tokens in `app/globals.css`, identical in light and dark themes because the mascot always sits on its own dark plate. The brightest colour is pale blue (relative luminance 0.77, never white); halos are low-alpha.
- Measured contrast: lattice edges on the plate 9.1:1, nodes 11.7:1, pink ring 6.8:1, plate rim against a white page 3.96:1 and against the dark page 4.51:1 (WCAG 1.4.11 needs 3:1 to identify the control). The mascot's focus ring is two-tone (white outline plus a navy halo) so it shows on both themes.
- Nothing flashes. The fastest effect is a node shimmer under 1 Hz at 15% amplitude, well inside WCAG 2.3.1.
- `prefers-reduced-motion`: JS draws one still frame and CSS animations are off; "thinking" is still shown by static trails.
- Mascot button: name, `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`, a screen-reader description of drag and arrow keys. The panel is a non-modal `role="dialog"`; Escape closes it and returns focus to the mascot. Targets are at least 44px (the small hide button has a 44px hit area).
- Dragging has a keyboard alternative (arrows) and a Reset position button, as required for any drag-only interaction.

## Deliberately not built yet
- More states (for example timer running, break, or session finished). The structure supports it: add a value to `MascotMood`, a `data-mood` rule in `globals.css`, and a branch in `stepMotion`.
- Persisting the dock position to the account (it is per device on purpose, because the viewport differs per device).
- Name and "show the companion" for signed-out visitors (they are account features).

## Files
`lib/companion-settings.ts` (types, validation) · `lib/companion-position.ts` (drag and panel geometry) · `lib/manifold-geometry.ts` (3D maths, motion, frame monitor) · `components/study/manifold-mascot.tsx` · `components/study/neutrino-launcher.tsx` · `components/study/companion-preferences.tsx` · `components/study/use-companion-prefs.ts` · `app/api/companion/settings/route.ts` · mascot CSS at the end of `app/globals.css`.
