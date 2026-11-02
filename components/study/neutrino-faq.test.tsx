// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import { FAQ_ITEMS } from "@/lib/neutrino-faq";

// The FAQ is driven through real DOM events against the real English
// messages, so a broken answer, link label or search shows up here.
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: (namespace: string) => actual.createTranslator({ locale: "en", messages: en, namespace }),
  };
});
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={(event) => { event.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));

import { NeutrinoFaq } from "./neutrino-faq";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const t = createTranslator({ locale: "en", messages: en, namespace: "companion" });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn() as never;
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(props: Partial<React.ComponentProps<typeof NeutrinoFaq>> = {}) {
  act(() => root.render(<NeutrinoFaq name="Neutrino" {...props} />));
}
const buttons = () => [...container.querySelectorAll("button")];
const byText = (text: string) => buttons().find((button) => button.textContent?.trim() === text);
function type(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const question = (id: string) => t(`faq.items.${id}.q` as never) as string;

describe("NeutrinoFaq", () => {
  it("opens on the full, grouped list of questions", () => {
    render();
    expect(container.textContent).toContain("pre-written answers");
    expect(container.querySelectorAll("h3").length).toBe(7);
    expect(container.textContent).toContain(`${FAQ_ITEMS.length} questions`);
    expect(byText(question("what-is"))).toBeTruthy();
  });

  it("shows the answer with its links, and the follow-up questions, when one is picked", () => {
    render();
    act(() => byText(question("timer-save"))!.click());
    expect(container.textContent).toContain("Finish and save");
    expect(container.querySelector('a[href="/timer"]')).toBeTruthy();
    expect(container.textContent).toContain("You could also ask");
    // The list is tucked away until asked for.
    expect(container.querySelector('input[type="search"]')).toBeNull();
    act(() => byText("All questions")!.click());
    expect(container.querySelector('input[type="search"]')).toBeTruthy();
  });

  it("interpolates the shared chat limit into the answer", () => {
    render();
    act(() => byText(question("ai-limits"))!.click());
    expect(container.textContent).toContain("Up to 10 requests per account per day");
  });

  it("filters by search text and by topic", () => {
    render();
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    type(input, "Picture-in-Picture");
    expect(buttons().filter((b) => b.textContent === question("neutrino-float")).length).toBe(1);
    expect(container.querySelectorAll("h3").length).toBe(0);
    type(input, "");
    const select = container.querySelector("select")!;
    act(() => {
      select.value = "timer";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("5 questions");
  });

  it("says when nothing matches, and offers AI chat only when it is available", () => {
    const switchToAi = vi.fn();
    render({ onSwitchToAi: switchToAi });
    type(container.querySelector<HTMLInputElement>('input[type="search"]')!, "zzzqqq");
    expect(container.textContent).toContain("No question matches “zzzqqq”");
    act(() => byText("Switch to AI chat")!.click());
    expect(switchToAi).toHaveBeenCalledTimes(1);

    render();
    expect(byText("Switch to AI chat")).toBeUndefined();
  });

  it("closes the in-page panel when an answer link is followed, and can start over", () => {
    const onNavigate = vi.fn();
    render({ onNavigate });
    act(() => byText(question("planner-what"))!.click());
    act(() => container.querySelector<HTMLAnchorElement>('a[href="/planner"]')!.click());
    expect(onNavigate).toHaveBeenCalledTimes(1);
    act(() => byText("Start over")!.click());
    expect(container.querySelector('input[type="search"]')).toBeTruthy();
    expect(container.textContent).not.toContain("You could also ask");
  });
});
