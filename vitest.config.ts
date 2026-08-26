import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// TEST-001: minimal Vitest setup (decision #10 — no test runner existed in
// this repo before Phase 2). Node environment (the default) is enough for
// almost every Phase 2 test: mastery-rule, plan-generation, and quiz-scoring
// tests are pure functions, and the auth-redirect/render-path tests exercise
// server code (middleware, Server Components rendered via
// react-dom/server) rather than anything that needs a browser DOM.
//
// @vitejs/plugin-react is included because PLANNER-003's render-path test
// imports real .tsx Server Component files, which need JSX transformed the
// same way Next's own toolchain does.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*" path alias — Vite doesn't read
      // tsconfig paths on its own.
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Acceptance criterion (TEST-001): `pnpm test` must succeed even before
    // any feature task has added a test file yet.
    passWithNoTests: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/.velite/**"],
  },
});
