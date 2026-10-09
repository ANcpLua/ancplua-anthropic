# ancplua-anthropic

The root of ancplua's work for Claude: a Claude Code plugin marketplace named `ancplua-anthropic`, plus the tooling that keeps it valid.

- `plugins/<plugin>/` holds everything that ships, one plugin per directory, each listed in `.claude-plugin/marketplace.json`.
- `.claude/` configures sessions in this repository only; nothing in it ships.
- `.claude/rules/conventions.md` is the single source of truth for names and layout. It loads when you touch plugin, marketplace, or skill files; change rules there.
- Start a plugin with `/new-plugin <name>`.
- Before every commit, `node scripts/verify.mjs` passes (the `verify` skill runs it).
- Claude Code changes weekly. Before stating a file name, frontmatter field, settings key, or CLI flag, confirm it in https://code.claude.com/docs/llms.txt.
