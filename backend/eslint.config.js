import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Dozens of files already carry "eslint-disable-next-line no-console" comments ahead of
      // deliberate console.log/error calls — that convention only makes sense if this rule is
      // actually on, so turning it on (rather than stripping the now-"unused" disables) matches
      // the codebase's clear original intent.
      "no-console": "warn",
      // This codebase uses `any` deliberately in test fakes/mocks (fakePrisma helpers etc.) —
      // npm run typecheck (tsc --noEmit) already covers real type safety in application code.
      "@typescript-eslint/no-explicit-any": "off",
      // `catch (_) {}` / `(_req, res) => ...` is an established convention here for
      // intentionally-unused parameters — matches the leading-underscore convention rather
      // than fighting it.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Seed/CLI scripts: console output IS the deliverable here (progress logs, generated
    // secrets, demo credentials), unlike src/ where a stray console.log is more likely an
    // accidental debug leftover — no-console stays on there.
    files: ["prisma/seed/**", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
);
