# ancplua-anthropic

The root of everything ANcpLua builds for Claude. The repository is
a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugins/create-marketplace.md): plugins built here live
in `plugins/`, plugins already published from their own repository are listed from there, one command makes all of them
installable, and each is meant for [Anthropic's directory](https://claude.com/docs/directory/publish.md).

## Install

```bash
claude plugin marketplace add ANcpLua/ancplua-anthropic
claude plugin install ancplua-docs@ancplua-anthropic
```

Inside a session, `/plugin marketplace add ANcpLua/ancplua-anthropic` adds the marketplace the same way, and
`/plugin install ancplua-docs@ancplua-anthropic` opens the plugin's details in the `/plugin` panel, where you install
it.

| Plugin                                 | What it does                                                                            |
|:---------------------------------------|:----------------------------------------------------------------------------------------|
| [`ancplua-docs`](plugins/ancplua-docs) | Grounds answers about Claude and Claude Code in the current official docs               |
| [`ancplua-hunt`](plugins/ancplua-hunt) | Runs parallel Opus bug hunters, locally on one issue or in Anthropic's cloud on a whole repository, and returns proven fixes |
| [`ancplua-lean-proof`](https://github.com/ANcpLua/ancplua-lean-proof) | Proves C#/.NET state machines correct with Lean 4 and turns every counterexample into a reproduced, fixed bug |
| [`mcp-builder-v2`](https://github.com/ANcpLua/mcp-builder-v2/tree/main/plugins/mcp-builder-v2) | Builds, migrates and checks MCP servers on SDK v2 and spec 2026-07-28, in TypeScript and Python |

## Layout

```text
ancplua-anthropic/
├── .claude-plugin/
│   └── marketplace.json        the catalog: one entry per plugin, here or in its own repository
├── plugins/
│   └── <plugin>/               every plugin built here
├── .claude/                    sessions in this repo only, never shipped
│   ├── settings.json           shared permissions and the Stop hook
│   ├── hooks/stop-verify.sh    resolves Bun for the Stop hook
│   ├── hooks/stop-verify.mjs   runs verify.mjs, blocks once per distinct failure
│   └── skills/
│       ├── new-plugin/         /new-plugin <name> scaffolds a plugin
│       └── verify/             runs scripts/verify.mjs; Claude runs it before commits
├── scripts/verify.mjs          every check, one command
├── .github/workflows/verify.yml
├── CLAUDE.md                   the kernel: purpose, authority, house rules, change protocol
└── README.md                   orientation for people
```

## Develop

Requires Claude Code 2.1.286 or later and Bun 1.4 or later. The floor comes
from [Extend Claude with skills](https://code.claude.com/docs/en/skills.md), which makes the `verify` skill part of
Claude's commit routine:

> When a session starts with a skill named `verify` or `simplify` in place, Claude Code's commit instructions tell
> Claude to run it right before each commit, except for changes to docs or tests. This requires Claude Code v2.1.286 or
> later.

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
bun scripts/verify.mjs                  # from any directory
bun scripts/verify.mjs --base main      # also require version bumps for changed plugins
bun scripts/verify.mjs --remote         # last, install every listed plugin into a throwaway config
```

In the order of authority set in [`CLAUDE.md`](CLAUDE.md): `claude plugin validate --strict` on the marketplace, every
plugin and `.claude`; then the rows of the
directory's [pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist.md) on README, license,
plugin name, file names, links and submodules, `SKILL.md` spelling and `.gitattributes`; then the ✓ house rules.
Gitignored files count for none of these checks. `--remote` runs last: it adds this checkout as the marketplace in a
throwaway `CLAUDE_CONFIG_DIR`, installs every listed plugin, including those in other repositories, and fails unless
each install exits 0 and `claude plugin details` shows the entry's name, a semver version and at least one skill or
agent. A source that points at an existing folder without the plugin installs cleanly, so the details are what catch
it. `--remote` fails when the claude CLI or the network is missing. CI runs the same command with `--base` and
`--remote` on every push to `main`, every pull request and every Monday, so a Claude Code update that moves the
platform shows up without a push. A scheduled run has no event to take a base from and uses `HEAD~1`. If `--base` does not resolve to a commit, verification reports the reason and uses
`HEAD~1`; it fails when that parent is unavailable. A missing `--base` value is an error. The workflow also
accepts an optional `base` through `workflow_dispatch` so the fallback can be exercised on CI.

The project Stop hook in `.claude/settings.json` runs the same script when Claude stops. On a failure it blocks the stop
once per distinct failure per session with the full report, so Claude fixes it before handing back. Its POSIX launcher
resolves Bun from PATH, then `$BUN_INSTALL/bin/bun`, then `$HOME/.bun/bin/bun`, and passes stdin to
`stop-verify.mjs`. When Bun is missing, it blocks once per session with the installation command, using the same
`ancplua-anthropic-stop-hook` directory in the OS temp directory for session memory.

## Releasing a change

Raise `version` in the plugin's `.claude-plugin/plugin.json` with every change to that plugin. Users of the hosted
marketplace stay on their cached copy until that string changes, and CI fails a changed plugin whose version didn't go
up.
