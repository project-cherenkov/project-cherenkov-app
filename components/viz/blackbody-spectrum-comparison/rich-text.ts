// A tiny markup for exponents: "10^13" and "W m^-3 sr^-1" are plain ASCII in
// the message catalogues and in number formatting, and each surface turns the
// caret form into real superscripts the way it can:
//   canvas: smaller, raised text (toRuns + drawRich in draw.ts),
//   HTML:   <sup> (the component),
//   spoken: Unicode superscript digits (toUnicodeSuperscripts).
// Unicode superscripts are NOT used for drawing: U+2070 (⁰) and U+207B (⁻) are
// missing from many fonts, which shows as an empty box, and monospace fonts
// are the worst for it.

export interface TextRun {
  text: string;
  superscript: boolean;
}

const EXPONENT = /\^(-?\d+)/g;
const MINUS = "\u2212"; // a real minus sign, wider than a hyphen

export function toRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of text.matchAll(EXPONENT)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ text: text.slice(last, index), superscript: false });
    runs.push({ text: match[1]!.replace("-", MINUS), superscript: true });
    last = index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), superscript: false });
  return runs;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

// For text that is read aloud rather than drawn.
export function toUnicodeSuperscripts(text: string): string {
  return text.replace(EXPONENT, (_, digits: string) =>
    digits
      .split("")
      .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
      .join(""),
  );
}
