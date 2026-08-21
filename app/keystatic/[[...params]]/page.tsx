import { makePage } from "@keystatic/next/ui/app";
import keystaticConfig from "../../../keystatic.config";

// Standard Keystatic admin shell (spec §11 CMS-004). Lives outside the
// [locale] segment on purpose: /keystatic must load directly, with no
// locale-prefix redirect — see middleware.ts's matcher, updated alongside
// this route so the intl middleware never rewrites /keystatic/*.
//
// Deviation from the spec's literal `<Keystatic config={...} />` example:
// @keystatic/next 5.x's "./ui/app" entry point exports `makePage(config)`
// (which itself renders `Keystatic` from "@keystatic/core/ui"), not a
// `Keystatic` component directly — confirmed against the installed package,
// not assumed from the spec's example.
export default makePage(keystaticConfig);
