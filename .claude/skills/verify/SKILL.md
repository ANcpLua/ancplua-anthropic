---
name: verify
description: Validates the whole marketplace against the Claude Code schema and this repo's conventions. Use after changing anything under plugins/, .claude-plugin/, or .claude/, and before every commit.
allowed-tools:
  - Bash(node scripts/verify.mjs *)
---

Run `node scripts/verify.mjs` from the repository root.

It runs `claude plugin validate --strict` on the marketplace, every plugin, and `.claude/skills`, then checks every ✓ rule in `.claude/rules/conventions.md`.

When it reports problems, fix each cause at its source and run it again. Done when one run ends with `verify: all checks passed`.
