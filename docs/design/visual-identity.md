# Cherenkov identity

> Moved from docs/brand-identity.md on 2026-11-08.

See also: [colour](colour.md) and [product identity](../project/product-identity.md).

## Core idea

Cherenkov is where a scientific idea becomes visible. The identity centers on a charged particle and the widening light wake it leaves behind: a visual cue for discovery, explanation, and motion through a subject.

## Name and wordmark

- The full public name is **Project Cherenkov**; **Cherenkov** is acceptable shorthand. See [product identity](../project/product-identity.md).
- In the interface, keep the wordmark lowercase as **cherenkov**, set in Space Grotesk. The existing body and editorial type remain Inter; monospace stays reserved for code-like labels and quantities.
- Pair the name with the compact mark in the site header. Keep the name readable; do not replace it with an image containing small lettering.

## Mark

The mark in components/site/brand-mark.tsx depicts a particle moving to the right with a light cone widening behind it. Its simple rays and particle dot are designed to hold together in a small header slot and at favicon sizes.

- Use the cyan mark on a deep blue field for the favicon and dark surfaces.
- Use the deeper Cherenkov blue on light surfaces; use the pastel cyan on dark surfaces.
- Leave clear space around the rays and particle. The compact mark has to stay legible at favicon size, so keep it simple and avoid fine detail that disappears when it is small.
- For diagrams, use the widening cone as a quiet annotation when it helps explain a phenomenon. Do not add it as decoration to every card or heading.

## Color and type

Keep the current palette: deep ink blue for reading surfaces, Cherenkov cyan for the mark and active emphasis, and pink as a restrained secondary highlight. Colour decisions, roles and contrast rules live in [colour](colour.md). Keep contrast and existing theme tokens authoritative; the mark must not be the only signal for a control state.

The site's type pairing already supports the identity. Use Space Grotesk for the short wordmark and headings, Inter for reading, and the existing monospace face only where the file-note or measurement voice carries meaning.

## Reference image

The supplied image is a mood reference for luminous cyan, deep blue, and forward motion. Its detailed atom/network artwork and futuristic all-caps lettering are not used as the production logo because they lose clarity at small sizes and do not match the site's current reading typography.
