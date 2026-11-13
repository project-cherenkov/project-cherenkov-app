import type { MetadataRoute } from "next";

// Web app manifest: gives "Add to home screen" a name, colours and PNG icons
// (the only other icon is app/icon.svg, which not every consumer reads).
// Colours are the brand ink and the light page colour, from app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Cherenkov",
    short_name: "Cherenkov",
    description:
      "Interactive olympiad editorials for physics, astronomy and informatics, with an OSN syllabus and study planner.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF5F6",
    theme_color: "#0B2436",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
