import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/.cache/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/.wrangler/**",
      "**/.hermes/**",
      "**/.tmp/**",
      "**/next-env.d.ts",
      "**/dist/**",
      "**/coverage/**",
      "docs/design/hotel-ui/generate_final_templates.py",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      react: { version: "19.2" },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["packages/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "react", message: "contracts must not depend on React" },
          { name: "hono", message: "contracts must not depend on Hono" },
          { name: "@werehere/db", message: "contracts must not depend on DB" },
          { name: "@werehere/ui", message: "contracts must not depend on UI" },
        ],
        patterns: [
          {
            group: ["@werehere/db/**", "@werehere/ui/**", "**/db/**", "**/ui/**", "**/apps/api/**"],
            message: "contracts layer boundary violation",
          },
        ],
      }],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@werehere/contracts", message: "UI primitives must not own hotel contracts" },
          { name: "@werehere/db", message: "UI must not depend on DB" },
          { name: "hono", message: "UI must not depend on API internals" },
        ],
        patterns: [
          {
            group: ["@werehere/contracts/**", "@werehere/db/**", "**/contracts/**", "**/db/**", "**/apps/api/**", "**/api/**"],
            message: "UI layer boundary violation",
          },
        ],
      }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@werehere/db", message: "Web must use same-origin API instead of DB" },
        ],
        patterns: [
          {
            group: ["@werehere/db/**", "**/db/**", "**/apps/api/**", "**/api/src/**", "../../api/**"],
            message: "Web must not import DB or API internals",
          },
        ],
      }],
    },
  },
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@werehere/ui", message: "API must not depend on UI" },
          { name: "next", message: "API must not depend on Next.js" },
        ],
        patterns: [
          {
            group: ["@werehere/ui/**", "next/**", "**/packages/ui/**", "**/ui/**", "**/apps/web/**", "**/web/**"],
            message: "API layer boundary violation",
          },
        ],
      }],
    },
  },
);
