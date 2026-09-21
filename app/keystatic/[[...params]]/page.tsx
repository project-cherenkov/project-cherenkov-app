import KeystaticApp from "@/app/keystatic/keystatic";

// BUGFIX, found while wiring up a "New visualization" entry point for the
// scene builder (not itself part of that request): <KeystaticApp/> used
// to be rendered from app/keystatic/layout.tsx, which — being a layout,
// not a page — sits above every route nested under /keystatic, including
// this project's own custom pages (/keystatic/scene-builder,
// /keystatic/team-photo, and now /keystatic/scene-builder/new). That
// layout's function signature never accepted or rendered a `children`
// prop, so none of those pages' own JSX was ever part of the tree Next
// actually rendered — visiting them showed nothing but whatever
// <KeystaticApp/> itself renders for a path it doesn't recognize, no
// matter what the page's own component returned. (Confirmed empirically,
// not just by reading the code: a curl of /keystatic/scene-builder's
// initial HTML in dev mode showed an essentially empty <body> — one
// hidden placeholder div plus scripts — with "Scene builder" and friends
// only present inside Next's dev-only Segment Explorer debug payload,
// never as real rendered markup.)
//
// The fix: render <KeystaticApp/> only here, in the catch-all page that
// exists specifically to own whatever path Keystatic itself is
// responsible for (its dashboard, and every collection/singleton path).
// A literal segment like "scene-builder" always wins this match over the
// optional catch-all "[[...params]]" at the same level, so this file
// never runs for our custom pages — they render their own content, using
// the ordinary (now-default, no override) layout from app/layout.tsx.
// app/keystatic/layout.tsx has been deleted rather than left as a no-op
// passthrough; it existed only to host the line moved here.
export default function Page() {
  return <KeystaticApp />;
}
