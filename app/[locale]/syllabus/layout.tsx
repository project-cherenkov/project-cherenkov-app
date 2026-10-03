import type { ReactNode } from "react";

import { ArchiveSubnav } from "@/components/site/archive-subnav";

// Puts the Syllabus | Materials | Editorials bar above every page in this
// section. See components/site/archive-subnav.tsx.
export default function ArchiveSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ArchiveSubnav />
      {children}
    </>
  );
}
