/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import messages from "@/messages/en.json";

let mockLocale = "en";

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  // A small translator over the real English catalogue, so the test fails if a
  // key the component uses is missing from messages/en.json.
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const value = `${namespace}.${key}`
      .split(".")
      .reduce<any>((node, part) => (node ? node[part] : undefined), messages);
    if (typeof value !== "string") throw new Error(`missing message ${namespace}.${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
  },
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));

// The real engine is a client-only dynamic import; a marker is enough here.
vi.mock("@/components/viz/viz-engine", () => ({
  VizEngine: () => <div data-testid="engine" />,
}));

import { HomeVisualizations } from "./home-visualizations";
import type { HomeVizCandidate } from "@/lib/home-viz-candidates";

function candidate(key: string, title: string, over: Partial<HomeVizCandidate> = {}): HomeVizCandidate {
  const [subject, slug] = key.split("/") as [HomeVizCandidate["subject"], string];
  return {
    key,
    subject,
    slug,
    title,
    titleLang: "en",
    description: `${title}: description.`,
    descriptionLang: "en",
    vizConfig: { discriminant: "none", value: {} } as any,
    ...over,
  };
}

const ALL = [
  candidate("physics/projectile-range-symmetry", "Projectile range symmetry"),
  candidate("astronomy/eccentric-transit-duration", "Eccentric transit duration"),
  candidate("informatics/binary-search-on-answer", "Binary search on the answer"),
  candidate("astronomy/why-a-sidereal-day-is-shorter", "Why a sidereal day is shorter"),
];

describe("HomeVisualizations (server render)", () => {
  beforeEach(() => {
    mockLocale = "en";
  });

  const html = () => renderToStaticMarkup(<HomeVisualizations candidates={ALL} />);

  it("lists the default three as tabs, the first selected and the only one in the tab order", () => {
    const out = html();
    expect(out.match(/role="tab"/g)).toHaveLength(3);
    expect(out).toContain("Projectile range symmetry");
    expect(out).toContain("Binary search on the answer");
    expect(out).not.toContain("Why a sidereal day is shorter</span>");
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it("connects every tab to the one panel it controls", () => {
    const out = html();
    const panelId = out.match(/role="tabpanel" id="([^"]+)"/)?.[1];
    expect(panelId).toBeTruthy();
    expect(out.match(new RegExp(`aria-controls="${panelId}"`, "g"))).toHaveLength(3);
    expect(out).toMatch(/role="tabpanel"[^>]*aria-labelledby="[^"]+-tab-physics-projectile-range-symmetry"/);
  });

  it("shows the active pick's description and a link to its editorial", () => {
    const out = html();
    expect(out).toContain("Projectile range symmetry: description.");
    expect(out).toContain('href="/archive/physics/projectile-range-symmetry"');
    expect(out).toContain("Open the editorial");
  });

  it("offers Change, and the heading for the list", () => {
    const out = html();
    expect(out).toContain(">Change<");
    expect(out).toContain("Your picks");
  });

  it("does not mount an engine until the device selection has been read", () => {
    const out = html();
    expect(out).not.toContain('data-testid="engine"');
    expect(out).toContain('aria-busy="true"');
  });

  it("offers no Change button when there is only one thing to show", () => {
    const out = renderToStaticMarkup(<HomeVisualizations candidates={[ALL[0]!]} />);
    expect(out).not.toContain(">Change<");
    expect(out.match(/role="tab"/g)).toHaveLength(1);
    // With one pick there is nothing to step through.
    expect(out).not.toContain("Next visualization");
  });

  it("renders nothing at all when there is nothing to show", () => {
    expect(renderToStaticMarkup(<HomeVisualizations candidates={[]} />)).toBe("");
  });

  it("marks English text as English on the Indonesian page", () => {
    mockLocale = "id";
    const out = html();
    expect(out).toContain('lang="en"');
  });

  it("leaves the language unmarked when the text is in the page's language", () => {
    expect(html()).not.toContain("lang=");
  });
});
