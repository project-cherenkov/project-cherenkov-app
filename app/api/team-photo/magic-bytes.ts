// CH-07 (architect audit round 1): content-based image validation via
// magic-byte signatures, extracted from route.ts so it can be exported for
// unit tests without conflicting with Next.js's strict set of allowed Route
// export names (only HTTP-verb handlers and a handful of config fields are
// permitted — any other export is a build error).
const MAGIC_BYTES: { type: string; signature: number[] }[] = [
  { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", signature: [0x47, 0x49, 0x46, 0x38] }, // "GIF8" (covers 87a and 89a)
  // WEBP: RIFF????WEBP -- bytes 8-11 ("WEBP") checked separately below since
  // bytes 4-7 are a variable file-size field, not part of the signature.
];

export function matchesImageMagicBytes(bytes: Uint8Array): boolean {
  for (const { signature } of MAGIC_BYTES) {
    if (bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte)) {
      return true;
    }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  ) {
    return true;
  }
  return false;
}
