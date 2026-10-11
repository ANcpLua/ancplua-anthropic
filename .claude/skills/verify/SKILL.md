---
name: verify
description: Validates the whole marketplace with claude plugin validate --strict, the directory's pre-submission checklist and this repo's house rules. Use after changing anything under plugins/, .claude-plugin/, or .claude/, and before every commit.
allowed-tools:
  - Bash(bun scripts/verify.mjs *)
---

Run `bun scripts/verify.mjs` (any working directory).

It runs `claude plugin validate --strict` on the marketplace, every plugin and `.claude`, then the rows of the
directory's pre-submission checklist on README, license, plugin name, file names, links and submodules, `SKILL.md`
spelling and `.gitattributes`, then every ✓ house rule in `CLAUDE.md`.

When it reports problems, fix each cause at its source and run it again. A validator message after a Claude Code update
means the platform moved: fix the content, never weaken the check. Done when one run ends with
`verify: all checks passed`.
