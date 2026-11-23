import { beforeEach, describe, expect, it, vi } from "vitest";

// T2 acceptance: every route that grants editor power answers 403 (or hides
// content) for an account whose email is on ADMIN_EMAILS but NOT verified.
//
// Only the session is mocked. The real lib/admin-guard.ts runs, so these tests
// fail if any route goes back to checking the address alone.
const fixture = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; name: string; emailVerified: boolean },
}));

vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => fixture.user }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: () => { throw new Error("the database must not be touched before authorization"); } }),
}));

import { GET as editAccess } from "./account/edit-access/route";
import { POST as teamPhoto } from "./team-photo/route";
import { GET as quizList } from "./keystatic/quiz-questions/route";
import { PATCH as quizPatch } from "./keystatic/quiz-questions/[id]/route";
import { POST as sceneSave } from "./scene-builder/route";
import { POST as sceneNew } from "./scene-builder/new/route";
import { GET as oauthStart } from "./scene-builder/github-oauth/start/route";
import { GET as oauthCallback } from "./scene-builder/github-oauth/callback/route";
import { isEditorRequest } from "@/lib/editor-access";

const unverifiedEditor = { id: "u1", email: "editor@example.com", name: "Ed", emailVerified: false };
const verifiedEditor = { ...unverifiedEditor, emailVerified: true };
const post = () => new Request("http://localhost/x", { method: "POST", body: "{}" });
const get = () => new Request("http://localhost/x");

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ADMIN_EMAILS", "editor@example.com");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "Cherenkov <no-reply@mail.example.com>");
  vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "");
  vi.stubEnv("KEYSTATIC_GITHUB_CLIENT_ID", "");
  fixture.user = unverifiedEditor;
});

describe("editor routes deny an unverified admin-email account", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["POST /api/team-photo", () => teamPhoto(post())],
    ["GET /api/keystatic/quiz-questions", () => quizList()],
    ["PATCH /api/keystatic/quiz-questions/[id]", () => quizPatch(post(), { params: Promise.resolve({ id: "x" }) })],
    ["POST /api/scene-builder", () => sceneSave(post())],
    ["POST /api/scene-builder/new", () => sceneNew(post())],
    ["GET /api/scene-builder/github-oauth/start", () => oauthStart(get())],
    ["GET /api/scene-builder/github-oauth/callback", () => oauthCallback(get())],
  ];

  it.each(cases)("%s answers 403", async (_name, call) => {
    expect((await call()).status).toBe(403);
  });

  it("the Edit link is hidden and draft content stays hidden", async () => {
    expect(await (await editAccess()).json()).toEqual({ canEdit: false });
    expect(await isEditorRequest()).toBe(false);
  });
});

describe("a verified editor is let through", () => {
  beforeEach(() => {
    fixture.user = verifiedEditor;
  });

  it("passes the gate (the OAuth start route then stops on missing GitHub config)", async () => {
    expect((await oauthStart(get())).status).toBe(503);
  });

  it("sees the Edit link and drafts", async () => {
    expect(await (await editAccess()).json()).toEqual({ canEdit: true });
    expect(await isEditorRequest()).toBe(true);
  });
});

describe("the rollout switch", () => {
  it("ALLOW_UNVERIFIED_EDITORS=true keeps an unverified editor working while editors verify", async () => {
    vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "true");
    expect((await oauthStart(get())).status).toBe(503);
  });

  it("never lets a signed-out visitor or a non-editor through", async () => {
    vi.stubEnv("ALLOW_UNVERIFIED_EDITORS", "true");
    fixture.user = null;
    expect((await oauthStart(get())).status).toBe(401);
    fixture.user = { id: "s", email: "student@example.com", name: "S", emailVerified: true };
    expect((await oauthStart(get())).status).toBe(403);
  });
});
