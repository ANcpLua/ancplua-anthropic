# ancplua-anthropic

The root of everything ancplua builds for Claude. The repository is a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace.md): every plugin lives in `plugins/`, and one command makes all of them installable.

## Install

```bash
claude plugin marketplace add ancplua/ancplua-anthropic
claude plugin install docs@ancplua-anthropic
```

Inside a session, the same commands work as `/plugin marketplace add …` and `/plugin install …`.

| Plugin | What it does |
| :-- | :-- |
| [`docs`](plugins/docs) | Grounds answers about Claude Code in the current official docs |

## Layout

```text
ancplua-anthropic/
├── .claude-plugin/
│   └── marketplace.json        the catalog: one entry per plugin
├── plugins/
│   └── <plugin>/               everything that ships; see the conventions
├── .claude/                    sessions in this repo only, never shipped
│   ├── settings.json           shared permissions
│   ├── rules/conventions.md    names and layout: the single source of truth
│   └── skills/
│       ├── new-plugin/         /new-plugin <name> scaffolds a plugin
│       └── verify/             runs scripts/verify.mjs; Claude runs it before commits
├── scripts/verify.mjs          every check, one command
├── .github/workflows/verify.yml
├── CLAUDE.md                   orientation for Claude
└── README.md                   orientation for people
```

## Develop

Requires Claude Code 2.1.286 or later (tested with 2.1.291) and Node 18 or later.

```bash
# Load one plugin straight from its directory for a session
claude --plugin-dir ./plugins/<plugin>

# Or register this checkout as the marketplace; plugins load in place,
# so edits apply after /reload-plugins with no version bump
claude plugin marketplace add ./
```

Start a new plugin from a Claude Code session in this repo with `/new-plugin <name>`.

## Verify

```bash
node scripts/verify.mjs                  # schema + conventions
node scripts/verify.mjs --base main      # also require version bumps for changed plugins
```

It runs `claude plugin validate --strict` on the marketplace, every plugin, and `.claude/skills`, then enforces the rules in [`.claude/rules/conventions.md`](.claude/rules/conventions.md). CI runs the same command with `--base` on every push to `main` and every pull request.

## Releasing a change

Raise `version` in the plugin's `.claude-plugin/plugin.json` with every change to that plugin. Users of the hosted marketplace stay on their cached copy until that string changes, and CI fails a changed plugin whose version didn't go up.
