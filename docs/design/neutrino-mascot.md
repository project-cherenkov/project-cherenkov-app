# Neutrino mascot: how it works now

> Moved from docs/neutrino-mascot.md on 2026-11-08.

The study companion's mascot ("the algorithmic manifold", M-01) is a draggable, animated SVG. This file records what is built and why. Code is the source of truth.

## What the student sees
- A dark circular plate holding a glowing icosahedral lattice, a bright core, and a tilted pink/blue "Cherenkov shock boundary" ring with a highlight travelling around it.
- **Idle:** gentle vertical hover, slow core pulse, and a screen-wide roam made of random legs: each picks a new destination anywhere on screen, follows a gently curved route with a varied easing, then rests for a random moment (see `use-companion-wander.ts`). The speed slider scales travel speed from 0.5× to 1.5×; the default is 0.7×. The roam pauses while the panel is open, the mascot is focused, or it is being dragged. Fading lattice fragments and star-like sparkles follow its path and pointer drags when "Drift and traces" is enabled.
- A one-time, dismissible prompt introduces the companion's Ask, study, and timer functions.
- **Thinking** (while a chat reply is pending): fast steady spin, streaming trails, quicker pulse, small node shimmer.
- Drag it anywhere (pointer), or focus it and use the arrow keys (Shift = bigger steps). Click or Enter opens the panel. Position is stored as a fraction of the available space in `localStorage` (`neutrino-position-v1`), so resizing or rotating a phone never strands it off-screen.
- The panel has three tabs: Ask, Study timer, Settings. It opens beside the mascot (above or below, whichever has room) and as a bottom sheet under 640px wide.
- **Ask has two modes, FAQ and AI chat.** FAQ is the default every time (the mode is component state, never persisted). The segmented control and a `role="status"` notice under it always say which mode is active (amber notice for AI, because text leaves the device); the panel subtitle repeats it. The FAQ (`components/study/neutrino-faq.tsx`, data and search in `lib/neutrino-faq.ts`, wording in `companion.faq.*` in both message files) is pre-written and sends nothing anywhere. When `aiEnabled` is false the control is not rendered at all and Ask shows only the FAQ.
- **Resizing (desktop, >= 640px):** the panel is attached to the mascot, so only the two *free* edges (the ones facing away from it) and the corner between them are draggable; `placePanel` reports them as `freeHorizontal` / `freeVertical`. The attached edges never move, which is why releasing a drag needs no snap-back: placing the panel again with the stored size gives the same frame (unit-tested). Handles sit just outside the panel so they never cover its scrollbar or buttons. Each edge is a focusable `role="separator"` with arrow-key support (Shift = bigger step); double-click or Settings > Reset panel size restores the default. Size is stored per device in `localStorage` (`neutrino-panel-size-v1`), clamped to a 300x320 minimum and to the viewport. The phone bottom sheet is deliberately not resizable.

## Settings (account page and the panel's Settings tab share one component)
| Field | Values | Stored | Signed out |
| --- | --- | --- | --- |
| `name` | 1 to 32 chars | `companion_settings.name` | not available |
| `enabled` | boolean | `companion_settings.enabled` | not available |
| `size` | small 56px, medium 76px, large 104px | `companion_settings.size` | `localStorage` (`neutrino-prefs-v1`) |
| `rotation` | `auto`, `3d`, `flat` | `companion_settings.rotation` | `localStorage` (`neutrino-prefs-v1`) |
| `driftSpeed` | 50–150%, 10% steps | `localStorage` (`neutrino-prefs-v1`) | `localStorage` (`neutrino-prefs-v1`) |
| `ambientMotion` | boolean | `localStorage` (`neutrino-prefs-v1`) | `localStorage` (`neutrino-prefs-v1`) |
| `style` | `pixel` (default), `smooth` (the original look) | `companion_settings.style` (migration `0011`) | `localStorage` (`neutrino-prefs-v1`) |
| `aiEnabled` | boolean | `companion_settings.ai_enabled` (migration `0005_neutrino_ai_toggle`) | `localStorage` (`neutrino-prefs-v1`) |

`aiEnabled` switches off only the AI chat. The chat route also refuses (`403 ai_disabled`) for an account whose row says it is off, before the daily budget is touched, so a stale tab or hand-made request cannot bypass it.

`PATCH /api/companion/settings` takes a partial body and rejects the whole request if any field is invalid. Migration `0004_neutrino_mascot_settings` adds the columns with defaults (existing rows become enabled / medium / auto) and CHECK constraints that must stay in sync with `lib/companion-settings.ts`.

All surfaces stay in sync through one window event (`neutrino-prefs-changed`) wired in `use-companion-prefs.ts`; there is no shared provider.

## Pixel style
Applies only to Neutrino and only when `style` is `pixel`; `smooth` adds none of it, so it renders as before (a test asserts that). The panel root carries `nt-pixel`; CSS lives at the end of `app/globals.css` under `.nt-pixel` and uses one base unit (`--px: 2px`) and existing colour tokens only. Corners are notched with edge-only box-shadows (not clip-path), so focus rings and text are never clipped.
- **Header:** the name and a `role="status"` readout (`mode: FAQ · sends nothing` / `mode: AI · text leaves your device`). The amber AI notice stays.
- **Tabs and mode buttons:** stepped frames, active one inverted. **Bubbles:** notched frames; the text stays in the body face.
- **Open:** a three-step unfold of about 180 ms (`steps(3)`); none under reduced motion.
- **Trace:** `CompanionTrail` draws square cells on a 2px grid that fade in three steps over the 1,500 ms lifetime.
- **Glyphs** (`neutrino-glyph.tsx`, drawn from SVG rectangles, `aria-hidden`), on the corner opposite the hide button: `?` while the AI chat is open and idle, three animated dots while a request is pending, `!` on an error or limit. Static under reduced motion. No new mood was added.
- **Font:** the pixel face for chrome and labels only (`.nt-font`); see `visual-identity.md`.
- Not built: a pixel mascot renderer, a "flash" mood, and the optional timer cell ring.

## Chat engine and history
- Replies are rendered as Markdown with LaTeX (`neutrino-markdown.tsx`, loaded lazily with `katex.css`) for both roles: no raw HTML, no images, https and known internal links only, no tables. `lib/companion-markdown.ts` holds the rules.
- Reply ceiling `COMPANION_MAX_OUTPUT_TOKENS` (1,500): a ceiling, not a target. A cut-off reply shows a notice and a Continue button.
- The system prompt is `lib/companion-prompt.ts` (versioned). Page context is resolved on the server from published content; the browser only names the page.
- Chats persist in `companion_chats` and `companion_chat_messages` (15 chats, 30 messages each, checked on the server before the daily counter). A chat is created only with its first successful reply. The thread shows a divider where Neutrino's 6-message view begins, and meters (cells in pixel, a bar in smooth) show usage.
- A personal Gemini key lives in `sessionStorage` only (`use-own-key.ts`), is sent with each request, is not counted in the 10-a-day limit and has its own ceiling of 200 a day.

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
- Mascot button: name, `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`, a screen-reader description of drag and arrow keys. The panel is a non-modal `role="dialog"`; Escape closes it and returns focus to the mascot. Targets are at least 44px. The one exception is the small hide button for mouse and keyboard users: it is 24px, sits on the corner of the mascot, and is only clickable while shown (hover or keyboard focus), because an invisible, enlarged target over the mascot used to swallow taps meant for the mascot itself. It is not shown at all on touch-only devices (`hover: none`); there, Settings > Hide until reload is the 44px way to hide the mascot.
- Dragging has a keyboard alternative (arrows) and a Reset position button, as required for any drag-only interaction.

## Planned moods

Idle, curious, and thinking moods are wired in (`MascotMood` in `components/study/manifold-mascot.tsx`): curious follows a page change or an open panel; thinking marks a pending AI response. Planned next:

- **Correct quiz answer.** A short, distinct reaction when the student answers a quiz question correctly.
- **A visualization playing.** A mood shown while an editorial's visualization is running.
- Others later (for example timer running, break, or session finished).

Keep the set of moods small and visually distinct, so that each one can be told apart at a glance and none becomes noise.

To add a mood, follow the recipe under "Deliberately not built yet": add a value to `MascotMood`, a `data-mood` rule in `app/globals.css`, and a branch in `stepMotion`.

### Design direction: the flash (proposed)

The project's central image is a neutrino that is nearly invisible until something happens, and then flashes (see [inspiration and philosophy](../project/inspiration-and-philosophy.md)). The mascot can carry that story: quiet by default, with a flash when something becomes clear. The correct-answer mood is the natural first flash. This is a direction to record, not something to build now.

Constraints for when it is built: the flash must be a single soft brightening, not a strobe, and must stay well inside WCAG 2.3.1; it must respect `prefers-reduced-motion` (a still frame or a static cue); and the "Nothing flashes" statement under "Accessibility and comfort" will need updating at that point.

## Deliberately not built yet
- More states. The structure supports it: add a value to `MascotMood`, a `data-mood` rule in `globals.css`, and a branch in `stepMotion`. See "Planned moods" below for which ones are intended.
- Persisting the dock position (and panel size) to the account (it is per device on purpose, because the viewport differs per device).
- Name and "show the companion" for signed-out visitors (they are account features).

## Files
`lib/companion-settings.ts` (types, validation) · `lib/companion-position.ts` (drag, panel placement and resize geometry) · `lib/neutrino-faq.ts` (FAQ structure, search) · `components/study/neutrino-faq.tsx` · `lib/manifold-geometry.ts` (3D maths, motion, frame monitor) · `components/study/manifold-mascot.tsx` · `components/study/neutrino-launcher.tsx` · `components/study/companion-preferences.tsx` · `components/study/neutrino-markdown.tsx` · `components/study/neutrino-chat-list.tsx` · `components/study/neutrino-glyph.tsx` · `components/study/companion-data.tsx` · `lib/companion-prompt.ts` · `lib/companion-chat-history.ts` · `components/study/use-companion-prefs.ts` · `app/api/companion/settings/route.ts` · mascot CSS at the end of `app/globals.css`.
