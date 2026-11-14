# Colour

> Extracted from section 2 of `docs/reviews/design-review-2026-10.md` (originally written 10 October 2026) on 2026-11-08. This file is now the source of truth for colour decisions. Token values live in `app/globals.css` and `tailwind.config.ts`; if this file disagrees with them, the code wins.

See also: [visual identity](visual-identity.md) (mark, wordmark, type) and [product identity](../project/product-identity.md) (name, promise, credo). Colour and identity are one topic seen from two sides, so these files cite each other.

## Why these colours

Blue and white are literal to the phenomenon the project is named after: Cherenkov radiation is the pale blue-white glow a charged particle gives off when it outruns light inside a transparent medium such as water. Pink is the secondary trait: approachable and a little playful, so the project reads as inviting rather than intimidating, which softens the rigour without diluting it.

The palette is also a deliberate homage. The reasoning is recorded in [inspiration and philosophy](../project/inspiration-and-philosophy.md); read it before changing the hues. The hex values and token names below are fixed.

## Roles (working convention)

This is a convention for new work, not a rule the existing code was written to. Where current code differs, see the audit table at the end of this file.

| Colour | Role | Typical use | Motto word |
|---|---|---|---|
| Blue (`cherenkov-blue-*`) | The phenomenon: the idea, its structure, light | Diagram structure, the fixed parts of a scene, brand mark, links and active states | Cognitio |
| Pink (`cherenkov-pink-*`) | The learner: what the reader controls or chose, encouragement, the companion's warmth | Reader-controlled values in a visualization, highlights, the companion | Humanitas |
| Pale blue-white flash | The moment of insight | A brief emphasis when something becomes clear (for example a correct answer) | Exploratio |

## Proportion

The existing rule stays: about 70% blue, about 30% pink. Balance is not equality; the imbalance is justified by the roles above, because the phenomenon is the subject and the learner is the one it is shown to.

## Tokens and rules

The brand hues are unchanged (`#5BCEFA` blue, `#F5A9B8` pink). The problem was
proportion, not hue: about 95% of most pages was white or flat gray plus slate
text, and the pastels, at about 1.8:1 against white, cannot be used for text,
links or borders. The fix is to tint the neutrals, give color some large
areas, and use the deeper brand steps for anything that carries meaning.

The dark theme is deliberately blue: the ink navy is the water, the blue glow
is the radiation. The light theme uses a barely-pink white so that the band,
which ends in pink, fades into the page without a muddy gray-lilac middle.
Keep that tint faint. If the page becomes visibly pink it competes with the
blue, and the pink tags lose their contrast.

| Token | Light | Dark |
|---|---|---|
| `--background` | `349 33% 97%` (`#FAF5F6`, `cherenkov-pink-50`) | `205 66% 13%` (`#0B2436`, `cherenkov-ink`) |
| `--foreground` | `205 66% 13%` (`#0B2436`) | `165 100% 97%` (`#EFFFFB`, `cherenkov-cream`) |
| `--card` | `0 0% 100%` (white, lifts off the page) | `206 66% 17%` (`#0F3049`, lighter than the page) |
| `--border` | `349 61% 88%` (`#F3CED5`, `cherenkov-pink-200`) | `204 53% 26%` (`#1F4A66`) |
| `--ring` | unchanged (`#0A88B8`-range) | unchanged (`#8AD7FF`-range) |
| `.hero-band` | blue glow `#5BCEFA` at 28% top-left, pink glow `#F5A9B8` at 30% top-right | same glows at 30% and 18% |
| Browser theme color | `#FAF5F6` | `#0B2436` |

Rules for using the palette:

1. Blue is dominant (about 70%), pink is a small highlight (about 30%).
2. Pastels (`cherenkov-blue`, `cherenkov-pink`, the `-pastel` and `-alt`
   colors) are fills and glows, never text. For text, links, outlines and
   active states use `cherenkov-blue-800` or `-900` in light and `cherenkov-
   blue-300` or `-400` in dark.
3. Keep the reading area calm: no gradients or tints behind article, proof or
   table text. Bold color belongs in the hero, navigation, cards and empty
   states.
4. Small text placed on the hero band must be checked against the glow peaks
   (the table below). The home eyebrow uses `text-cherenkov-blue-800
   dark:text-cherenkov-blue-300` for this reason; the generic `label-code`
   color is too weak on the dark glow.
5. Prefer `slate-600` for secondary text in light mode. `slate-500` passes on
   white cards (4.76:1) but not on the tinted page (4.41:1).

## Contrast

Computed contrast ratios (glow "peak" means the wash at full strength, the
worst case for text over it):

| Pair | Ratio | Result |
|---|---|---|
| Light: body `#0B2436` on page / on blue peak / on pink peak | 14.7 / 12.7 / 12.5:1 | Pass |
| Light: hero eyebrow `#0C698D` on page / blue peak / pink peak | 5.7 / 4.9 / 4.8:1 | Pass |
| Light: hero eyebrow where the two glows would overlap | 4.3:1 | Fails for 12px text, but the glow centers are far apart (20% and 90% of the width) |
| Light: hero paragraph (foreground at 80%) on blue peak | 7.2:1 | Pass |
| Light: secondary text `slate-600` on page | 7.0:1 | Pass |
| Light: button text `slate-900` on `#5BCEFA` | 9.9:1 | Pass |
| Light: outline border `slate-500` on page / on blue peak | 4.4 / 3.8:1 | Pass (3:1 for UI boundaries) |
| Light: focus ring `#0A88B8` on page | 3.7:1 | Pass (3:1) |
| Light: white card vs page / pink-200 border vs page | 1.08 / 1.33:1 | Decorative only; card separation is faint (see O12) |
| Dark: body on navy / on blue glow peak | 15.4 / 7.6:1 | Pass |
| Dark: hero eyebrow `#97DCF6` on navy / on glow peak | 10.5 / 5.2:1 | Pass |
| Dark: hero paragraph (foreground at 80%) on glow peak | 5.5:1 | Pass |
| Dark: secondary text `slate-400` on navy / on card | 6.2 / 5.3:1 | Pass |
| Dark: outline border `slate-400` on navy / on glow peak | 6.2 / 3.1:1 | Pass, with little margin |
| Dark: focus ring `#8AD7FF` on navy | 10.0:1 | Pass |
| Dark: card vs page / border vs page / border vs card | 1.17 / 1.69 / 1.45:1 | Decorative; better than the old 1.09 / 1.29, still subtle |

## Adding shades

New shades or hues are allowed, but each needs a one-line justification in this file, tied to one of the roles above. Functional colours (error, success, warning) are not brand colours and do not need a role. The pastels are not for text under any circumstances.

## Colour role audit (2026-11-08)

A static search of `components/viz/**`, `components/study/**`, `components/planner/**`, `components/quiz/**`, `components/site/**`, `app/**` and `app/globals.css` for the pink tokens (`cherenkov-pink*`, `pinkAlt`, `--viz-secondary`, `--highlight`, `--mf-accent`). Nothing was rendered, and no code was changed: the one clear mismatch (trajectory sandbox) is more than a tiny edit, so it is listed as a follow-up. The roles above are a working convention, so "mismatch" means "differs from the convention", not "wrong".

| Where | Pink is used for | Matches the "learner" role? | Suggested follow-up |
| --- | --- | --- | --- |
| `trajectory-sandbox`: launch path and legend | The learner's own launch is blue (dashed) and labelled "launch (yours)". The complementary-angle ghost is pink (dotted). | No. The roles are reversed: the learner's choice is blue and the derived complement is pink. | Swap the hues in the canvas and the legend together (learner pink, complement blue). Keep the dashed and dotted line styles so colour is not the only cue. Update tests that name the colours. |
| `trajectory-sandbox`: target band and centre tick | Challenge target, pink fill at 45% alpha plus a `pinkAlt` tick. | Unclear. The editorial sets the target, but it is what the learner aims at. | Decide whether challenge elements count as the phenomenon (blue) or the learner's goal (pink) before changing anything. |
| `trajectory-sandbox`, `orbital-sandbox`, `composed-scene` slider marker: moving marker | `pinkAlt` fill with a blue-alt stroke. | Partly. A marker the reader moves (slider-bound) fits; a marker that just plays back the phenomenon does not. | Keep for slider-bound markers. For playback-only markers, consider blue when the roles are applied. |
| `orbital-sandbox`: star | The star is drawn in `pinkAlt`; the planet and orbit are blue. | No. The star is part of the phenomenon. | Consider blue-alt or blue for the star; keep pink for the scrub cursor on the light curve. |
| `orbital-sandbox`: light-curve scrub cursor | `pinkAlt` vertical line at the reader's playback position. | Yes. It is the position the reader chose. | None. |
| `blackbody-spectrum-comparison`: Rayleigh-Jeans curve | `--viz-secondary` (deeper pink in light, pastel pink in dark) for the classical curve; Planck is blue (`--brand`). | No. The classical curve is not learner-controlled. Pink here means "second series". | Either document `--viz-secondary` as "second series" in this file, or reassign it. Low priority. Contrast is already noted in `app/globals.css`. |
| `composed-scene`: element templates | Most templates default to blue, blue-alt or grid. The quadratic-curve template defaults to pink. `COLOR_OPTIONS` offers blue, blue-alt, pink, pink-alt and grid. | Mostly yes. The exception is the quadratic curve, which usually draws the phenomenon. | Consider a blue default for the quadratic curve, and pink for slider-bound elements. Existing content may rely on the current default, so check it first. |
| `site/editorial-card.tsx`, `archive/[subject]/[slug]/page.tsx`: tag pills | `bg-cherenkov-pink/40` fill (and `/25` in dark) with foreground text. | Neutral. Tags are filing labels; pink is a soft accent. | None. It follows the rule that pastels are fills and never carry text. |
| `viz/viz-engine.tsx` and `docs/[slug]/page.tsx`: notices | Dashed pink border and `bg-cherenkov-pink/20` fill for a gentle notice. | Roughly, as warmth. | None. |
| `study/manifold-mascot.tsx` (`--mf-accent`) | The ring and comet trails of the Neutrino mascot. | Yes. This is the companion's warmth. | None. |
| `app/globals.css`: `::selection` | `cherenkov-pink` background with ink text. | Yes. It is what the reader selected. | None. |
| `app/globals.css`: hero band | Pink glow, top right, fading to the page. | Neutral (decorative, within the proportion rule). | None. |
| `--highlight` token / `highlight` colour | Defined in `app/globals.css` and `tailwind.config.ts`. | Not applicable. No use found in the searched folders. | Check whether it is still needed before relying on it. |
| `components/planner/**`, `components/quiz/**` | No pink token use found. | Not applicable. | If pink is added there, follow the roles above. |

## Home credo and nav ribbons (added 2026-11-14)

Both were redone for the home hero and header. Figures were computed with the WCAG 2.x relative-luminance formula against the page and against the hero glow at full strength ("peak": light blue `#CDEAF7`, light pink `#F8DEE3`, dark blue `#235771`, dark pink `#3B273D`). They have not been checked in a browser.

**Credo (`components/site/credo.tsx`).** The motto, one word per role, replaces the old counts line.

| Word | Light | Dark | Lowest ratio (page / blue peak / pink peak) |
|---|---|---|---|
| Cognitio | blue-800 `#0C698D` | blue-300 `#97DCF6` | light 5.7 / 4.9 / 4.8; dark 10.5 / 5.2 / 9.0 |
| Humanitas | pink-700 `#AA1835` | pink-200 `#F3CED5` | light 6.7 / 5.8 / 5.7; dark 11.1 / 5.5 / 9.5 |
| Exploratio (resting) | ink `#0B2436` | pink-50 `#FAF5F6` | light 14.7 / 12.7 / 12.5; dark 14.7 / 7.3 / 12.6 |

Dark Humanitas uses pink-200, not pink-300: pink-300 is 3.8:1 on the dark blue glow peak, which fails for 14px text. Exploratio's resting colour is the contrary of the page, which is the page's own foreground, and then it plays one 4.6 s pass through blue and pink. Every stop, and every blend between stops, stays at or above 4.8:1 in light and 5.1:1 in dark at the glow peaks.

**Nav ribbons (`app/globals.css`, "Nav ribbons").** Colours are CSS variables set per theme and per state.

| State | Light | Dark |
|---|---|---|
| Rest | fill `#DCEFF8`, blue-800 hairline 1.5px (5.7:1 on the page), ink label (13.4:1) | fill blue-900 (1.7:1 on the page), blue-500 hairline 1.5px (7.3:1 on the page, 3.6:1 on the strongest blue glow), cream label (9.1:1) |
| Hover or focus | pink-500 rim 2px (3.9:1 on the page, 3.3:1 on the glow peaks), drop 8px | pink-300 rim 2px (7.8:1 on the page, 4.6:1 on the fill) |
| Current page, or Menu open | fill `#F9DCE3`, pink-500 rim 4px, drop 12px, ink label (12.4:1) | blue-900 fill, pink-300 rim 4px, drop 12px |

Justifications for the changes (the roles table above is a working convention, and these are deliberate departures):

- `#DCEFF8` (new, between blue-100 and blue-200) is the light ribbon fill: a light blue so the ribbon belongs to the phenomenon, pale enough that the ink label has 13:1. Its edge against the page is only 1.1:1, so the blue hairline carries the shape.
- `#F9DCE3` (new, between pink-100 and pink-200) is the current-page tint: the learner's place in the site. Pale pink cannot define a shape on this pale pink page, so the saturated pink-500 rim does that work.
- Pink on the current page reverses the "blue for active states" convention above. It is justified by the learner role ("where you are") and by proportion: one pink ribbon instead of four all-pink-trimmed ones lowers total pink and helps the 70/30 balance.
- Pink-300 on the dark ribbon is the lightest pink that keeps 4.5:1 against the blue-900 fill; pink-400 is about 3.0:1.
