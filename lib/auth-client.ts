"use client";

import { createAuthClient } from "better-auth/react";

// Client-side counterpart to lib/auth.ts — talks to
// app/api/auth/[...all]/route.ts. baseURL is left unset so it defaults to
// the current origin (Better Auth's own client default), which is correct
// in dev and on any deployed origin without needing a NEXT_PUBLIC_* env var.
//
// Not explicitly named in the spec's AUTH-002 file list, but necessary:
// components/auth/login-form.tsx and signup-form.tsx are Client Components
// and need a browser-side Better Auth client to call sign-in/sign-up —
// lib/auth.ts's server config isn't reachable from client code.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
