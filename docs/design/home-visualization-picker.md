# Home visualization picker ("Your picks")

The home hero shows one to three visualizations the visitor chose, one at a time. This records how it works and what was measured. Added 2026-11-14.

## Behaviour

- A pick is a published editorial that has a visualization, identified by `<subject>/<slug>`. Picks are not grouped or filtered by subject: all three may be astronomy.
- Signed out, the choice is kept in the browser (`home-viz-picks-v1`). Signed in, it is kept there first and then in the account (`home_viz_picks`, one row per account). On sign-in the account wins when it has a choice; otherwise the choice made on this device is uploaded. "Use the defaults" clears both.
- New visitors see `DEFAULT_HOME_VIZ_KEYS` in `lib/home-viz-picks.ts`: projectile, eccentric orbit, binary search. An explicit list, not "the newest three", because the newest editorials are not spread across the three subjects. A key that is no longer published is skipped; if none survive, the defaults apply, then the first available.
- The list is built on the server from `getAllEditorials()` (`lib/home-viz-candidates.ts`) and passed to the client as props. The home page reads no session, so it stays static; the account copy is fetched from `/api/home/viz-picks` after load.
- Descriptions are the editorials' authored `vizDescription`. Translations carry only title, hook and body, so on `/id` the description and an engine's step notes are English and are marked `lang="en"`.

## Layout and accessibility

`HomeVisualizations` renders two grid items: the tabs (left column, under the credo) and the stage (right column). DOM order is the reading order: tabs, then the panel they control. The tabs follow the WAI-ARIA tabs pattern with manual activation: arrow keys, Home and End move focus; Enter or Space selects. Manual, because selecting swaps the visible engine. Below `lg` the tabs are one horizontally scrolling row.

All picks are mounted in one grid cell and the inactive ones are `invisible`, `inert` and `aria-hidden`, so the stage is as tall as the tallest pick and does not change height when the visitor switches. This is required, not an optimisation: measured in headless Chromium (stage height, px):

| Engine | 1280 | 768 | 390 |
|---|---|---|---|
| projectile (trajectory-sandbox) | 596 | 596 | 656 |
| binary search (graph-array-stepper) | 596 | 596 | 656 |
| eccentric orbit (orbital-sandbox) | 599 | 599 | 685 |
| blackbody (blackbody-spectrum-comparison) | 827 | 890 | 916 |
| sidereal day (relative-period-sandbox) | 1190 | 1379 | 1149 |

The `min-h` floor on the stage matches the three defaults. A visitor whose picks are taller sees one jump when the engines replace their skeletons. Re-measure when an engine is added or an engine's layout changes.

## Not done

- No cross-tab sync (a second tab sees the change on reload).
- A shared device carries one person's local choice into the next person's account at sign-in, if that account has no choice yet. Low stakes; noted because the merge rule is deliberate.
