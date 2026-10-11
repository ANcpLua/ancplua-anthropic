# ancplua-anthropic

## Purpose

This repository (GitHub: ANcpLua/ancplua-anthropic) is the `ancplua-anthropic` plugin marketplace: the single root for
everything ANcpLua builds for Claude. Everything here ships as a plugin under `plugins/<name>/`, listed in
`.claude-plugin/marketplace.json` and meant for Anthropic's directory. `.claude/` configures sessions in this repository
only and is never part of a plugin.

https://claude.com/docs/plugins/platform-support.md alone defines which surfaces exist and what each loads. This file
never lists surfaces.

## Authority, highest first

1. `claude plugin validate --strict` from the installed Claude Code, and the directory's **Validate**
   at https://claude.ai/directory/manage.
2. The docs, reached through https://code.claude.com/docs/llms.txt and https://claude.com/docs/llms.txt.
3. The house rules below.

When two disagree, the higher wins and this repository is edited to match it. Before stating a file name, frontmatter
field, settings key or CLI flag, confirm it in the docs; the `lookup` skill of `ancplua-docs` does exactly that.

## House rules

Only our own choices; a platform rule is never restated here, the validator and the docs hold those. ✓ marks a rule that
`scripts/verify.mjs` enforces.

Names

- Every plugin name starts with `ancplua-`, our project name; the directory's naming rows are
  in https://claude.com/docs/plugins/pre-submission-checklist.md. ✓
- A plugin's directory, its `plugin.json` `name` and its marketplace entry `name` are the same string. ✓
- The marketplace is named `ancplua-anthropic`, the repository name. ✓
- Skill names follow the `name` field of https://agentskills.io/specification, and agent names use the same pattern. ✓

Marketplace

- An entry is exactly `{ "name": "<name>", "source": "./plugins/<name>" }`, plus optional `category`, `tags`,
  `relevance` and `dependencies`. Display fields live only in
  `plugin.json`; https://code.claude.com/docs/en/plugins/marketplace-reference.md#entry-and-plugin-json says how an
  entry combines with it. ✓
- Entries are sorted by name. Every `plugins/` directory has an entry and every entry has a directory. ✓

Plugins

- `.claude-plugin/` holds only `plugin.json`. ✓
- `version` is semver. Every change under a plugin raises it ✓ (`--base`, which CI passes).
- Every plugin ships a `LICENSE` file and sets `license` in `plugin.json`. ✓
- Instructions and slash commands ship as skills: no `commands/` directory and no `AGENTS.md` at a plugin root. ✓
- `skills/` holds only `<skill>/` directories, and every skill sets frontmatter `name` as the Agent Skills specification
  requires. Agents are flat `agents/<name>.md` files whose frontmatter `name` equals the file name. ✓
- Skills use only the frontmatter fields of https://agentskills.io/specification; a Claude Code-only field is added only
  when the skill needs that feature.

Repository

- `.claude/skills/` and `.claude/agents/` follow the same skill and agent rules. ✓
- `bun scripts/verify.mjs` passes before every commit; the `verify` skill and the project Stop hook run it.
  `/new-plugin <name>` scaffolds a plugin.

## Change protocol

- A house rule changes only by editing this file, plus `scripts/verify.mjs` when the rule is ✓, in one commit whose
  message states the reason.
- History lives in git, never in this file.
- A new validator failure after a Claude Code update means the platform moved: fix the content, never weaken the check.
