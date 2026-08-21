import { makeRouteHandler } from "@keystatic/next/route-handler";
import keystaticConfig from "../../../../keystatic.config";

// Standard Keystatic API route handler (spec §11 CMS-003). Kept as a thin
// pass-through — all schema/storage decisions live in keystatic.config.ts.
export const { POST, GET } = makeRouteHandler({
  config: keystaticConfig,
});
