import type { SVGProps } from "react";

/** A particle moving right, leaving a widening Cherenkov-light wake behind it. */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8 9.5 33 22M8 38.5 33 26"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="m11 17 15 7-15 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".58"
      />
      <circle cx="37" cy="24" r="5" fill="currentColor" />
    </svg>
  );
}
