// Admin (Next.js) lint. `next lint` was removed in Next 16, so ESLint runs directly.
// TypeScript rules only for now; React/Next-specific plugins can be added here later.
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  prettier,
);
