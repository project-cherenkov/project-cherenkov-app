import { FlatCompat } from "@eslint/eslintrc";

// Next.js 15's eslint-config-next still ships as a legacy-style config,
// so it's loaded through FlatCompat for ESLint 9's flat config format —
// this is Next.js's own documented approach, not a workaround.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".velite/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
