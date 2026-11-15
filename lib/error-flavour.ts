// The extra line on the 404 and error screens (components/site/error-state.tsx).
// Edit this file to change it; nothing else needs to move.
//
// One entry per language, and per screen:
//   notFound  shown for an address that matches no page
//   error     shown when a page crashes while rendering
//
// Write as many lines as you like, at least one per list. One is picked at
// random after the page loads, and the "Show another fragment" button swaps it
// for a different one. {path} becomes the address the visitor asked for (for
// example /id/syllabus/nothing). The error screen has no address, so avoid
// {path} in its lines.
//
// Keep the lines short (one or two sentences) and keep the facts out of them:
// the heading and body (messages/*.json, "notFound" and "error") say what
// went wrong and what to do. This is only for the voice. A line must not
// promise anything about the visitor's data, such as "nothing was lost".
//
// Both languages need the same screens. lib/error-flavour.test.ts checks it.

export type FlavourLocale = "id" | "en";
export type FlavourScreen = "notFound" | "error";

export const ERROR_FLAVOUR: Record<FlavourLocale, Record<FlavourScreen, readonly string[]>> = {
  en: {
    notFound: [
      "{path} outran the light in this medium. All that is left is the glow.",
      "Neutrino checked every shelf. {path} is not on any of them.",
      "Some light arrives long after its source has gone. {path} is only the afterimage.",
      "A particle passed through {path} and left no track in the detector.",
      "The syllabus has no topic at {path}. Yet.",
      "Not every path leads to a topic. This one leads here.",
    ],
    error: [
      "The signal tore mid-render. A reload usually seals it.",
      "A cosmic ray flipped something it should not have. (Probably.) Try again.",
      "The neutrino lost the thread for a moment. Give it another try.",
    ],
  },
  id: {
    notFound: [
      "{path} melaju lebih cepat dari cahaya di medium ini. Yang tersisa hanya pendarnya.",
      "Neutrino sudah memeriksa semua rak. {path} tidak ada di satu pun.",
      "Sebagian cahaya baru tiba setelah sumbernya lenyap. {path} hanyalah bayangannya.",
      "Sebuah partikel melintasi {path} dan tidak meninggalkan jejak di detektor.",
      "Silabus tidak punya topik di {path}. Belum.",
      "Tidak semua jalur menuju sebuah topik. Yang ini menuju ke sini.",
    ],
    error: [
      "Sinyal terputus saat halaman dirender. Muat ulang biasanya memulihkannya.",
      "Sinar kosmik membalik sesuatu yang seharusnya tidak berubah. (Mungkin.) Coba lagi.",
      "Neutrino kehilangan jejak sejenak. Coba sekali lagi.",
    ],
  },
};

// Indonesian is the default locale (i18n/routing.ts), so it is the fallback.
export function flavourFor(locale: string, screen: FlavourScreen): readonly string[] {
  const byScreen = (ERROR_FLAVOUR as Record<string, Record<FlavourScreen, readonly string[]>>)[locale];
  return (byScreen ?? ERROR_FLAVOUR.id)[screen];
}

// Fills {path} into a line. With no address the token and the space before it
// are dropped, so a line never reads "lived at  did not".
export function fillFlavour(line: string, path: string): string {
  if (path) return line.replaceAll("{path}", path);
  return line.replaceAll(/\s?\{path\}/g, "");
}

// A random index that differs from `current` whenever there is a choice.
export function pickFragment(count: number, current = -1, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  let next = Math.floor(random() * count);
  if (next === current) next = (next + 1) % count;
  return next;
}
