import type { ReactNode } from "react";

import { PlannerSubnav } from "@/components/planner/planner-subnav";

// Shared chrome for the signed-in study tools. Auth is enforced by
// middleware.ts (it matches /planner/**), not here.
export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlannerSubnav />
      {children}
    </>
  );
}
