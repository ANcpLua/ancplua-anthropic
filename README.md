# ancplua-anthropic

The root of everything ANcpLua builds for Claude. The repository is a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace.md): every plugin lives in `plugins/`, one command makes all of them installable, and each is meant for [Anthropic's directory](https://claude.com/docs/directory/publish.md).

## Install

```bash
claude plugin marketplace add ANcpLua/ancplua-anthropic
claude plugin install ancplua-docs@ancplua-anthropic
```

Inside a session, the same commands work as `/plugin marketplace add …` and `/plugin install …`.

| Plugin | What it does |
| :-- | :-- |
| [`ancplua-docs`](plugins/ancplua-docs) | Grounds answers about Claude and Claude Code in the current official docs |

## Layout

```text
ancplua-anthropic/
├── .claude-plugin/
│   └── marketplace.json        the catalog: one entry per plugin
├── plugins/
│   └── <plugin>/               everything that ships
├── .claude/                    sessions in this repo only, never shipped
│   ├── settings.json           shared permissions and the Stop hook
│   ├── hooks/stop-verify.mjs   Stop hook: runs verify.mjs, blocks once per distinct failure
│   └── skills/
│       ├── new-plugin/         /new-plugin <name> scaffolds a plugin
│       └── verify/             runs scripts/verify.mjs; Claude runs it before commits
├── scripts/verify.mjs          every check, one command
├── .github/workflows/verify.yml
├── CLAUDE.md                   the kernel: purpose, authority, house rules, change protocol
└── README.md                   orientation for people
```

## Develop

Requires Claude Code 2.1.286 or later and Node 18 or later. The floor comes from [Extend Claude with skills](https://code.claude.com/docs/en/skills.md), which makes the `verify` skill part of Claude's commit routine:

> When a session starts with a skill named `verify` or `simplify` in place, Claude Code's commit instructions tell Claude to run it right before each commit, except for changes to docs or tests. This requires Claude Code v2.1.286 or later.

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
node scripts/verify.mjs                  # from any directory
node scripts/verify.mjs --base main      # also require version bumps for changed plugins
```

In the order of authority set in [`CLAUDE.md`](CLAUDE.md): `claude plugin validate --strict` on the marketplace, every plugin and `.claude`; then the locally checkable blocking rows of the directory's [pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist.md), README and license among them; then the ✓ house rules. CI runs the same command with `--base` on every push to `main` and every pull request.

The project Stop hook in `.claude/settings.json` runs the same script when Claude stops. On a failure it blocks the stop once per distinct failure per session with the full report, so Claude fixes it before handing back.

## Releasing a change

Raise `version` in the plugin's `.claude-plugin/plugin.json` with every change to that plugin. Users of the hosted marketplace stay on their cached copy until that string changes, and CI fails a changed plugin whose version didn't go up.
