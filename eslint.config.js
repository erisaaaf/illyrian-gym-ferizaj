// Root ESLint config covering apps/api and packages/* (plain Node/TS code).
// apps/admin (Next.js) and apps/mobile (Expo) get their own framework-aware
// lint setup (next lint / eslint-config-expo) when those apps grow past the
// Phase-1 foundation - tracked in docs/architecture.md, not skipped silently.
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/generated/**",
      "**/coverage/**",
      "apps/admin/**",
      "apps/mobile/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  prettier,
);
