# Design review and palette

Findings from a design review of the web app, the colour palette that came out
of it, and what is still open. Written for whoever touches the UI next (human
or agent). Token values live in `app/globals.css` and `tailwind.config.ts`; if
this file disagrees with them, the code wins.

Method: static review of the source, plus contrast ratios computed from the
token values. The pages were not rendered during the review, so layout
findings are inferred from classes. Section 6 lists what to check in a
browser. Date of review: 10 October 2026.

## 1. What the design pass changed

- **Palette** (`app/globals.css`, `app/[locale]/layout.tsx`): neutrals are now
  brand-tinted instead of pure white and flat gray. See section 2.
- **Hero band** (`app/globals.css`, `app/[locale]/page.tsx`): the home hero
  sits in a full-width `.hero-band` with a blue and a pink glow that fade into
  the page, in both themes. The recent-editorials section moved out of the
  hero wrapper and keeps the old `max-w-5xl` width.
- **Muted text** (19 files): light-mode `text-slate-500` became `text-
  slate-600`. On the tinted page background slate-500 is 4.41:1, below the
  4.5:1 AA minimum for normal text. Dark-mode `dark:text-slate-400` is
  unchanged.
- **Outline buttons** (`components/ui/button.tsx`): the border is `slate-500`
  (`slate-400` in dark), the same strength as form inputs. It was `border-
  border`, about 1.3:1 against the page, so the buttons barely read as
  buttons.
- **Take quiz** (`components/planner/plan-dashboard.tsx`): now a small primary
  button instead of an `text-xs` underlined link. It is the action that
  verifies mastery, and "Mark done" next to it was the more prominent control.
- **Archive filters** (`components/site/archive-filters.tsx`): the selects use
  `bg-background text-foreground` (they were hardcoded white, so they were
  white boxes in dark mode), and the Clear button has a visible hover in both
  themes.
- **Quiz feedback** (`components/quiz/quiz-dialog.tsx`): "correct" text is
  `emerald-700` in light mode (`emerald-600` was 3.77:1 on white).
- **Header hovers** (`components/site/header.tsx`): `hover:bg-accent` and
  `hover:text-accent-foreground` referred to colors that are not defined in
  `tailwind.config.ts`, so those hovers did nothing. They now use the same
  slate hover as the rest of the app.
- **Dialog close button** (`components/ui/dialog.tsx`): the hit area is 32px
  instead of the 16px icon (WCAG 2.5.8 asks for at least 24px).

## 2. The palette

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

## 3. Open findings

Not addressed by the design pass. Severity: high = fix before launch, medium =
worth doing soon, low = polish.

| ID | Severity | Finding | Where | Suggested fix |
|---|---|---|---|---|
| O1 | High | The nav ribbon image has text baked into it ("メドレー / MEDREY"), is near-black in both themes, and is stretched by `object-fill` (285×300 into 96×112, and 64×80 for the Menu button). Labels are overlaid on that text. Check the image's license if it came from a template or stock pack. | `components/site/header.tsx`, `public/navbar-banner-extended.png` | Replace with an inline SVG ribbon filled from brand tokens (`cherenkov-blue-800` light, `cherenkov-blue-400` dark). |
| O2 | Medium | Ribbons hang about 87px below the viewport top, but only `ArchiveSubnav` compensates (`min-[857px]:pt-11`). Hover moves a ribbon 36px, so the affordance depends on hover. Overlap on `/planner`, `/account` and `/login` is unverified. | `header.tsx`, `archive-subnav.tsx` | A shorter ribbon, or a header that reserves its own height. |
| O3 | Medium | Header width near the 857px breakpoint: the fixed-width children add up to roughly 850px against roughly 809px available (an estimate). | `header.tsx` | Test at 857–920px; raise the breakpoint or hide the GitHub icon sooner. |
| O4 | Medium | Home has four same-size CTAs, three of them outline buttons. The planner and sign-up are not offered. The hero also tells ("interactive visualization") but never shows one. | `app/[locale]/page.tsx` | One primary and one secondary CTA (e.g. archive, plan my study); Docs and About as text links; one live visualization beside the headline. |
| O5 | Medium | "Edit" (the Keystatic CMS) is in the main nav for every visitor. Log in and Sign up have the same weight as content links. | `header.tsx` `navItems`, `lib/account-roles.ts` | Show Edit only to editors, or move it to Account or the footer. Make Sign up a button. |
| O6 | Medium | No password reset flow, no show-password toggle, no pending label on the submit button. | `components/auth/*` | Add reset, a reveal toggle and "Signing in…" text. |
| O7 | Medium | Planner topics table shows a bare rating number and "Known · 82% (5)", which exposes `pHat` and `answerCount`. | `components/planner/plan-dashboard.tsx` | "82% on 5 questions", and the scale in the column header. |
| O8 | Medium | Section headings use `label-code` (12px mono caps), smaller than the card titles under them, and stay untranslated in Indonesian. | `label-code` in `app/globals.css`; home, archive | Keep it as an eyebrow, add a real heading beside it. |
| O9 | Low | Better Auth errors are shown verbatim (likely English on the `id` locale). The dialog's sr-only "Close" is hardcoded English. | `components/auth/login-form.tsx`, `components/ui/dialog.tsx` | Map error codes to translated strings; translate "Close". |
| O10 | Low | Language switcher uses flags (🇬🇧 for English). | `header.tsx` | Drop the flags; EN/ID with `lang` is enough. |
| O11 | Low | Quiz tabs are numbers only with no answered state; radio rows are about 20px tall. | `components/quiz/quiz-dialog.tsx` | Mark answered tabs; add vertical padding to choices. |
| O12 | Low | Card separation is faint in both themes (section 2). If cards look flat in the browser, raise the border lightness. | `app/globals.css` | Adjust `--border` (dark: about `204 50% 32%`). |
| O13 | Low | 55 `text-xs` uses plus `text-[10px]` and `text-[11px]` on ribbon labels, planner kind chips and tags. | various | Keep at 12px or larger. |

Token and component debt, which is the root of several findings above:

- Form controls are styled three ways: auth inputs (`border-slate-500 bg-
  background`), the scene builder (`border-border bg-transparent`) and the
  planner (`field` constant). Extract `<Input>` and `<Select>` into
  `components/ui`, like `Button`.
- About 120 `text-slate-*` utilities remain, many of them in manual light/dark pairs. A `--muted-
  foreground` token tinted toward the palette would make the next palette
  change a one-line edit.
- `--primary`, `--secondary` and their `-alt` variables are defined and mapped
  but unused. `accent` is referenced nowhere now and is not defined. `blue-
  alt` duplicates `blue-pastel`, and `cream` duplicates `offwhite`.
- Control borders use neutral slate. Brand-colored control borders (blue-800 /
  blue-400) would be a nice follow-up once the form primitives exist.

## 4. What works well

Keep these when changing the UI:

- Accessibility craft: skip link, focus ring colors tuned per theme (explained
  in comments), `scroll-padding-top` for the sticky header, global `prefers-
  reduced-motion`, `lang` following the locale, "opens in new tab"
  announcements, zoom not disabled, correct `autocomplete`, 44px inputs.
- Archive filters are native selects with state in the URL, so views are
  shareable and keyboard-friendly.
- `EditorialCard` has a clear order (subject chip, title, hook, tags, author)
  and a `headingLevel` prop that keeps the outline valid.
- The planner is honest about infeasible plans (banner with the hours gap) and
  puts the stale-plan action beside its message.
- The login form uses `role="alert"` errors and distinguishes failure modes.
- Brand colors live in `tailwind.config.ts`, with few hardcoded hexes.
- The code-label voice (`readme.md`, `footer.md`) gives the site a distinct
  personality. Use it less as the only heading style, not remove it.

## 5. Guidelines for future UI changes

1. Use semantic tokens (`bg-background`, `text-foreground`, `bg-card`,
   `border-border`) or `cherenkov-*` colors. Do not hardcode `bg-white` or hex
   values in components.
2. Never use the pastel brand colors for text. Check any new text-on-color
   pair at 4.5:1 (3:1 for 24px and larger, and for UI boundaries).
3. Test every change in both themes, and test small text over the hero band at
   the glow peaks.
4. Touch targets at least 24px, and 44px for primary controls.
5. Anything that carries meaning must not rely on color alone (the quiz does
   this correctly: color plus words).

## 6. To verify in a browser

1. The hero band in both themes: that the glows fade without a visible edge,
   and that small text stays readable across the whole width (light and dark).
2. Ribbon label stacking over the baked-in artwork (O1), at 1x and 2x pixel
   density.
3. Header overflow between 857px and about 920px, logged in and logged out
   (O3).
4. Ribbon overlap with page content on `/planner`, `/account`, `/login` and
   `/about` (O2).
5. Card separation in both themes (O12), and the muted `slate-600` text
   hierarchy against `label-code`.
6. Quiz dialog on a 360px-wide screen with long math choices.
7. Auth error messages on the Indonesian locale (O9).
8. The mobile browser theme color in both themes after the `themeColor`
   change.
