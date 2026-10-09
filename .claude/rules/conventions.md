---
paths:
  - "plugins/**"
  - ".claude-plugin/**"
  - ".claude/skills/**"
  - ".claude/agents/**"
---

# Conventions

The single source of truth for names and layout in this repository. Change a rule here, then in `scripts/verify.mjs` if it is marked ✓.

`node scripts/verify.mjs` enforces every ✓ rule and runs `claude plugin validate --strict` on the marketplace, each plugin, and `.claude/skills`. **[P]** marks a platform rule (breaking it breaks loading); **[H]** marks a house rule (our choice, for consistency).

## Names

Every identifier is lowercase kebab-case: `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters. ✓ [H]
This is the strictest intersection of Claude Code, Claude Desktop, and the Agent Skills spec, so a name valid here is valid on every surface.

| Thing | Where the name lives | Must equal |
| :-- | :-- | :-- |
| Marketplace | `.claude-plugin/marketplace.json` → `name` | `ancplua-anthropic`, the repository name ✓ [H] |
| Plugin | directory `plugins/<plugin>/` | `plugin.json` → `name` and the marketplace entry `name` ✓ [P] |
| Skill | directory `skills/<skill>/` | `SKILL.md` frontmatter `name` ✓ [P] |
| Agent | file `agents/<agent>.md` | frontmatter `name` ✓ [H] |

- Name a plugin for its purpose, without an owner prefix. The marketplace already namespaces it (`<plugin>@ancplua-anthropic`) and its name already prefixes every component (`/<plugin>:<skill>`, `<plugin>:<agent>`). [H]
- Reserved: a skill named `synced` or starting with `anthropic-skills` never loads. ✓ [P]
- Reserved plugin names: none may start with `claude-`, `anthropic-`, `anthropics-`, or `cc-plugin-`, be `claude`, `anthropic`, `anthropics`, `claude-code`, or `claude-mods`, or put `official` beside `claude` or `anthropic`. `claude plugin validate` rejects them. [P]

## Marketplace

- An entry is exactly `{ "name": "<plugin>", "source": "./plugins/<plugin>" }`, plus optional `category`, `tags`, `relevance`, `dependencies`. ✓ [H]
- Display fields (`description`, `version`, `author`, `displayName`, `keywords`, `homepage`, `repository`, `license`) live only in `plugin.json`. An entry value would silently override it. ✓ [H]
- Entries are sorted by `name`. Every `plugins/` directory has an entry and every entry has a directory. ✓ [H]

## Plugin layout

```text
plugins/<plugin>/
├── .claude-plugin/plugin.json   only this file in .claude-plugin/
├── skills/<skill>/SKILL.md      supporting files sit beside SKILL.md
├── agents/<agent>.md            flat, no subfolders
├── hooks/hooks.json             top-level "hooks" key
├── scripts/                     executables that hooks call
├── .mcp.json
└── README.md                    for humans: install line and component table
```

- `plugin.json` sets `name`, `version`, `description`, `author`. `--strict` fails without the last three. ✓ [P]
- `version` is semver. Raise it with every change under the plugin: users stay on the cached copy until the string changes. ✓ in CI via `--base` [P]
- Every manifest path starts with `./` and stays inside the plugin. [P]
- Instructions ship as skills. A `CLAUDE.md` at a plugin root never loads [P]; keep `AGENTS.md` out of plugins too. ✓ [H]
- Slash commands ship as skills; `commands/` stays unused. ✓ [H]
- Hook commands quote the root: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/<file>.sh"`. Persistent state goes in `${CLAUDE_PLUGIN_DATA}`; the root is replaced on every update. [P]
- MCP tools from a plugin are named `mcp__plugin_<plugin>_<server>__<tool>`. Use that full form in hook matchers and permission rules. [P]
- Plugin agents ignore `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`. Declare hooks and servers at plugin level. [P]
- A top-level `bin/` blocks install on claude.ai and Cowork. Ship executables under `scripts/` unless the plugin is Claude Code-only. [P]

## Skills

- Frontmatter always has `name` and `description`. ✓ [H] The description leads with what the skill does, then `Use when …` with the triggers; it is cut at 1,536 characters. [P]
- Use the Agent Skills fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) so the skill also uploads to claude.ai. Add Claude Code-only fields (`disable-model-invocation`, `argument-hint`, `context`, `paths`, …) only when the skill needs that feature. [H]
- `SKILL.md` stays under 500 lines; detail goes in sibling files linked one level deep. [H, from the docs' guidance]
- Reference bundled files with `${CLAUDE_SKILL_DIR}`, plugin-wide files with `${CLAUDE_PLUGIN_ROOT}`. [P]

## Sources

Platform rules come from https://code.claude.com/docs (plugins/manifest-reference, plugins/marketplace-reference, plugins/components, skills, memory) and https://agentskills.io/specification. Recheck them there when Claude Code updates.
