import { describe, expect, it } from "vitest";
import {
  PASSWORD_PROVIDER_ID,
  handleAccountCreated,
  shouldPurgePasswordOnLink,
  type LinkingStore,
} from "./auth-linking";

// In-memory stand-in for the user / account / session tables.
function fakeStore(initial: { verified: boolean; providers: string[]; sessions: number }) {
  const state = { ...initial, providers: [...initial.providers] };
  const store: LinkingStore = {
    isEmailVerified: async () => state.verified,
    removePasswordLoginAndSessions: async () => {
      state.providers = state.providers.filter((p) => p !== PASSWORD_PROVIDER_ID);
      state.sessions = 0;
    },
  };
  return { state, store };
}

describe("shouldPurgePasswordOnLink", () => {
  it("purges only when a non-password method attaches to an unverified user", () => {
    expect(shouldPurgePasswordOnLink({ providerId: "google", userEmailVerified: false })).toBe(true);
    expect(shouldPurgePasswordOnLink({ providerId: "google", userEmailVerified: true })).toBe(false);
    expect(shouldPurgePasswordOnLink({ providerId: PASSWORD_PROVIDER_ID, userEmailVerified: false })).toBe(false);
  });
});

describe("pre-registration takeover (victim@x.com)", () => {
  it("the attacker registered by password, then the real owner signs in with Google: the attacker's password and sessions are gone", async () => {
    // Attacker's signup: unverified user, a credential account, a live session.
    const { state, store } = fakeStore({ verified: false, providers: [PASSWORD_PROVIDER_ID], sessions: 1 });

    // Better Auth links Google to the same row; our hook runs before it marks the address verified.
    state.providers.push("google");
    const purged = await handleAccountCreated({ providerId: "google", userId: "u1" }, store);

    expect(purged).toBe(true);
    expect(state.providers).toEqual(["google"]);
    expect(state.providers).not.toContain(PASSWORD_PROVIDER_ID);
    expect(state.sessions).toBe(0);
  });

  it("leaves a verified user's password and sessions alone when Google is linked", async () => {
    const { state, store } = fakeStore({ verified: true, providers: [PASSWORD_PROVIDER_ID], sessions: 2 });
    state.providers.push("google");
    expect(await handleAccountCreated({ providerId: "google", userId: "u1" }, store)).toBe(false);
    expect(state.providers).toEqual([PASSWORD_PROVIDER_ID, "google"]);
    expect(state.sessions).toBe(2);
  });

  it("does nothing when the new account is the password credential itself (normal signup)", async () => {
    const { state, store } = fakeStore({ verified: false, providers: [], sessions: 0 });
    state.providers.push(PASSWORD_PROVIDER_ID);
    expect(await handleAccountCreated({ providerId: PASSWORD_PROVIDER_ID, userId: "u1" }, store)).toBe(false);
    expect(state.providers).toEqual([PASSWORD_PROVIDER_ID]);
  });
});
