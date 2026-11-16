"use client";

import { useState } from "react";

// A team photo that never shows a broken-image icon. Photos live on an
// external blob host; if one fails to load (network, an edited or deleted
// file), the avatar falls back to the member's initials in the brand colour.
// The photo's alt text is the member's name, so the fallback keeps that name
// as its own accessible label.
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

export function MemberPhoto({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`flex items-center justify-center rounded-full bg-cherenkov-blue/20 font-heading text-lg font-semibold text-brand ${className ?? ""}`}
      >
        <span aria-hidden="true">{initialsOf(name)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary Blob host, not worth a remotePatterns entry for three photos
    <img src={src} alt={name} onError={() => setFailed(true)} className={`object-cover ${className ?? ""}`} />
  );
}
