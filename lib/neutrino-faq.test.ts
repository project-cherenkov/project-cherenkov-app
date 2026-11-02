import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import id from "../messages/id.json";
import { FAQ_BY_ID, FAQ_GROUPS, FAQ_ITEMS, FAQ_LINKS, FAQ_VALUES, searchFaq } from "./neutrino-faq";

type Catalogue = typeof en;
const catalogues: Array<[string, Catalogue]> = [["en", en], ["id", id as Catalogue]];

describe("FAQ structure", () => {
  it("has unique, kebab-case ids", () => {
    const ids = FAQ_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const value of ids) expect(value).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("uses only known groups, and every group has questions", () => {
    for (const item of FAQ_ITEMS) expect(FAQ_GROUPS).toContain(item.group);
    for (const group of FAQ_GROUPS) expect(FAQ_ITEMS.some((item) => item.group === group), group).toBe(true);
  });

  it("offers follow-ups that exist, are not the question itself, and number at most three", () => {
    for (const item of FAQ_ITEMS) {
      expect(item.related.length, item.id).toBeLessThanOrEqual(3);
      for (const other of item.related) {
        expect(FAQ_BY_ID.has(other), `${item.id} -> ${other}`).toBe(true);
        expect(other).not.toBe(item.id);
      }
    }
  });

  it("links only to known pages", () => {
    for (const item of FAQ_ITEMS) for (const key of item.links ?? []) expect(FAQ_LINKS[key], `${item.id}: ${key}`).toMatch(/^\//);
  });
});

describe.each(catalogues)("FAQ text (%s)", (_locale, catalogue) => {
  const faq = catalogue.companion.faq;
  const items = faq.items as Record<string, { q: string; a: string }>;

  it("has a question and an answer for every FAQ entry, and none left over", () => {
    expect(Object.keys(items).sort()).toEqual(FAQ_ITEMS.map((item) => item.id).sort());
    for (const item of FAQ_ITEMS) {
      expect(items[item.id]!.q.trim().length, `${item.id}.q`).toBeGreaterThan(0);
      expect(items[item.id]!.a.trim().length, `${item.id}.a`).toBeGreaterThan(20);
    }
  });

  it("has a label for every group and every link used", () => {
    const groups = faq.groups as Record<string, string>;
    const links = faq.links as Record<string, string>;
    for (const group of FAQ_GROUPS) expect(groups[group], group).toBeTruthy();
    for (const key of Object.keys(FAQ_LINKS)) expect(links[key], key).toBeTruthy();
  });

  it("only uses placeholders the FAQ supplies", () => {
    const allowed = new Set(["limit", "chars", "history"]);
    for (const [key, { q, a }] of Object.entries(items)) {
      for (const match of `${q} ${a}`.matchAll(/\{(\w+)\}/g)) expect(allowed.has(match[1] ?? ""), `${key}: {${match[1]}}`).toBe(true);
    }
  });

  it("formats through the real message engine with no placeholder left over", () => {
    const t = createTranslator({ locale: _locale, messages: catalogue, namespace: "companion" });
    for (const item of FAQ_ITEMS) {
      for (const part of ["q", "a"] as const) {
        const text = t(`faq.items.${item.id}.${part}` as never, FAQ_VALUES as never) as string;
        expect(text, `${item.id}.${part}`).not.toMatch(/[{}]/);
      }
    }
    expect(t("faq.count" as never, { count: 1 } as never)).toMatch(/1/);
    expect(t("faq.count" as never, { count: 46 } as never)).toMatch(/46/);
    expect(t("faq.hello" as never, { name: "Neutrino" } as never)).toContain("Neutrino");
  });

  it("avoids straight apostrophes, which ICU would read as quoting", () => {
    for (const [key, { q, a }] of Object.entries(items)) expect(`${q}${a}`, key).not.toContain("'");
  });
});

describe("searchFaq", () => {
  const entries = [
    { id: "a", question: "How do I reset my password?", answer: "Use the account page." },
    { id: "b", question: "Where is the timer?", answer: "Open Neutrino and choose Timer. Your password is not needed." },
    { id: "c", question: "Visualisasi tidak termuat", answer: "Coba muat ulang halaman." },
  ];

  it("returns everything, in order, for an empty query", () => {
    expect(searchFaq(entries, "   ").map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("requires every word to match, in the question or the answer", () => {
    expect(searchFaq(entries, "password timer").map((e) => e.id)).toEqual(["b"]);
    expect(searchFaq(entries, "nothing like this")).toEqual([]);
  });

  it("ranks question matches above answer-only matches", () => {
    expect(searchFaq(entries, "password").map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("ignores case, accents and punctuation", () => {
    expect(searchFaq(entries, "VISUALISASI,").map((e) => e.id)).toEqual(["c"]);
    expect(searchFaq([{ id: "x", question: "Café hours", answer: "" }], "cafe").length).toBe(1);
  });
});
