# ancplua-hunt

Runs Claude Opus bug hunters in parallel and returns proven fixes for your session to judge. The `hunt` skill runs up to
five hunters on your machine on one issue, each in its own throwaway clone with a different angle: reproduce, trace,
skeptic, history and contract. The `cloud-hunt` skill runs three to five hunters in Anthropic's cloud sandbox as a Claude
Managed Agent, on a whole public repository, a scope or an issue, with related repositories cloned beside it when the cause
may sit there. Every finding comes with proof that doesn't ask to be trusted: a regression test and a standalone
reproducer that fail before the fix and pass after it, and the cloud hunt adds a `verify.sh` that shows `BUG` on your
code and `FIXED` with its patch. Fixes are the smallest clean change; deletions of unreachable code come in a separate
patch. Your session checks the proof, decides what holds, and ships it through the repository's normal review. The
hunters never push, publish or touch accounts.

## Install

```bash
claude plugin marketplace add ANcpLua/ancplua-anthropic
claude plugin install ancplua-hunt@ancplua-anthropic
```

## Components

| Component          | Invoke                                                                                        | What it does                                                                                          |
|:-------------------|:----------------------------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------------|
| Skill `hunt`       | `/ancplua-hunt:hunt`, or automatically when you ask for bug hunters on an issue                | Starts local hunters, streams one line per finding, writes a report and one patch each                 |
| Skill `cloud-hunt` | `/ancplua-hunt:cloud-hunt`, or automatically when you ask for cloud hunters or a repository sweep | Starts a Managed Agents hunt, streams each verified finding as it lands, downloads `findings.json`, `verify.sh`, the proofs, `fix.patch` and the report |

## Requirements

Claude Code with Bash, Bun 1.4 or later, and an Anthropic API key; the local `hunt` also needs git. The key comes
from `ANTHROPIC_API_KEY` or, on macOS, from the keychain item named in `~/.ancplua-hunt/config`:

```text
ANCPLUA_HUNT_KEYCHAIN_SERVICE=anthropic-api-key
ANCPLUA_HUNT_KEYCHAIN_ACCOUNT=<account name>
ANCPLUA_HUNT_CAP=100
```

Both skills call the Claude API with that key, never the `claude` CLI, so the spend comes out of the API account's
credits and not out of a Claude subscription. `cloud-hunt` works on public GitHub repositories only: the sandbox clones
them without a token.

## Cost

A local hunter is a separate Claude Opus session that stops at its budget, $10 by default. A cloud hunt is one Managed
Agents session for the lead and all its hunters together; it pauses at its budget, $40 by default. A hunt of either kind
is refused when the spend recorded in `~/.ancplua-hunt/ledger.jsonl` plus the new hunt's budgets would pass the cap, $100
by default. Local budgets use the Agent SDK's cost estimate and cloud budgets the session's list cost, and either can
overshoot slightly.

## What the plugin runs, sends and fetches

- **Runs:** `bun install --frozen-lockfile --ignore-scripts` for the packages pinned in `bun.lock`
  (`@anthropic-ai/claude-agent-sdk` and `yaml`), either when Claude Code installs the plugin or on the first hunt when
  the plugin loads in place. Then `bun` with the bundled scripts.
  - `hunt` runs `git clone --shared` for each hunter and one Claude Agent SDK session per hunter. Inside its clone, a
    hunter reads files, runs shell commands such as builds and tests, and edits files. Pushing, publishing, `gh`,
    `railway`, the macOS `security` command and subagents are blocked for hunters.
  - `cloud-hunt` reads the current checkout's `origin` URL with `git config` when you don't name a repository, creates
    or updates one Managed Agent and one Environment from the templates in `skills/cloud-hunt/assets/` on first use,
    then one session per hunt; `--stop` sends that session an interrupt. In the sandbox, the lead clones the repository,
    installs the toolchain it pins, and starts its hunters, each in its own git worktree. The sandbox reaches only
    package registries, GitHub and the installer hosts listed in `environment.yaml`.
- **Sends:** the issue text or scope, the repository content the hunters read and the output of their commands go to
  the Anthropic API with your key. `cloud-hunt` also sends the repository name, the commit and the rubric. The
  `security` command reads the key from the keychain on your machine and nothing prints it.
- **Fetches:** registry packages pinned by `bun.lock`. `hunt` fetches a pull request ref from the repository's own
  `origin` when you pass `--pr`, and its hunters may read public web pages. `cloud-hunt` asks the public GitHub API for
  the commit to hunt on, downloads each finding from the Files API while the hunt runs, and downloads the findings,
  proofs, verify script, patches and report when it ends.
- **Stores:** reports, patches, logs and the spend ledger in `~/.ancplua-hunt/`; cloud results in
  `~/.ancplua-hunt/cloud/<session id>/` and the Agent and Environment ids in `~/.ancplua-hunt/cloud/state.json`. Local
  clones go to the system temporary directory and are deleted after the hunt unless you pass `--keep`.

Licensed under Apache-2.0; see the LICENSE file.
