"use client";

import { createContext, useContext, type ComponentType, type SVGProps } from "react";
import { BookOpen, Bot, CircleHelp, ExternalLink, GripHorizontal, MessageCircleQuestion, Plus, Search, Settings2, Trash2, X, type LucideIcon } from "lucide-react";
import { BookOpen as PxBookOpen } from "pixelarticons/react/BookOpen.js";
import { Close as PxClose } from "pixelarticons/react/Close.js";
import { ExternalLink as PxExternalLink } from "pixelarticons/react/ExternalLink.js";
import { InfoBox as PxInfoBox } from "pixelarticons/react/InfoBox.js";
import { MessageText as PxMessageText } from "pixelarticons/react/MessageText.js";
import { Move as PxMove } from "pixelarticons/react/Move.js";
import { Plus as PxPlus } from "pixelarticons/react/Plus.js";
import { Robot as PxRobot } from "pixelarticons/react/Robot.js";
import { Search as PxSearch } from "pixelarticons/react/Search.js";
import { Sliders as PxSliders } from "pixelarticons/react/Sliders.js";
import { Trash as PxTrash } from "pixelarticons/react/Trash.js";
import type { CompanionStyle } from "@/lib/companion-settings";

// The icon names the panel uses, with the lucide icon (smooth style) and the
// pixelarticons icon (pixel style, MIT, a strict 24x24 grid) for each. The
// smooth style keeps lucide so it renders exactly as before.
const ICONS = {
  close: [X, PxClose],
  external: [ExternalLink, PxExternalLink],
  search: [Search, PxSearch],
  plus: [Plus, PxPlus],
  trash: [Trash2, PxTrash],
  book: [BookOpen, PxBookOpen],
  bot: [Bot, PxRobot],
  ask: [MessageCircleQuestion, PxMessageText],
  settings: [Settings2, PxSliders],
  help: [CircleHelp, PxInfoBox],
  grip: [GripHorizontal, PxMove],
} satisfies Record<string, [LucideIcon, ComponentType<SVGProps<SVGSVGElement>>]>;

export type NtIconName = keyof typeof ICONS;

const StyleContext = createContext<CompanionStyle>("smooth");
/** The panel provides its style once, so every icon below it follows it. */
export const NtStyleProvider = StyleContext.Provider;

/** Pixel icons are drawn on a 24px grid, so they render at 24px (never scaled to a fraction). */
export const PIXEL_ICON_PX = 24;

export function NtIcon({ name, className, style }: { name: NtIconName; className?: string; style?: CompanionStyle }) {
  const inherited = useContext(StyleContext);
  const [Smooth, Pixel] = ICONS[name];
  if ((style ?? inherited) === "pixel") {
    return <Pixel aria-hidden="true" width={PIXEL_ICON_PX} height={PIXEL_ICON_PX} data-nt-icon="pixel" className="nt-icon shrink-0" shapeRendering="crispEdges" />;
  }
  return <Smooth className={className} aria-hidden />;
}
