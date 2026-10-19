# AGENTS.md: build the antipatterns plugin

This file is for the agent that builds a plugin from the antipatterns. Every skill in the plugin has a `SKILL.md` and
a `references/` folder.

## Task

1. Turn each antipattern in `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/antipatterns/` into a skill.
2. Use Fallout's git history, pull requests and issues to find good and bad outcomes for each antipattern.
3. Put each example you find into that skill's `references/` folder.

You have to infer everything yourself. Do the whole task single-handedly: no subagents, no workflows, no questions to
the user.

## Rules

- Do not link to remote URLs. Copy what you cite into files on this computer, so agents always have living
  references: review comments, diff hunks, commit messages, issue text and doc lines. Name each source in plain text by
  repository, PR or issue number, commit SHA and date.
- Change the references to fit what you write in each `SKILL.md`. A reference holds the example; the `SKILL.md` says
  what it shows and when to read it.
- Do not assume any file is correct as it is. That covers the antipattern files and their `evidence:` lists, and also
  the example plugins below. Check each claim against Fallout's history. Drop or replace an evidence PR that does not
  show the antipattern, and merge, split or add skills where the history says so.
- Never invent an example. If the history has no good or no bad outcome for an antipattern, say so in its `SKILL.md`.
- Use the dotnet/skills plugins below as the model for depth, `description` wording and how a `SKILL.md` points into
  `references/`. Read `msbuild-antipatterns` (one catalog skill with three references) and `convert-to-cpm` (a
  "read this reference when" table) first.
- In copied text, remove the `@` from every GitHub handle, so nothing pings anyone if the text reaches GitHub. Fallout
  forbids ever writing `@` before matkoch's handle.
- Write plain English: `/Users/alexandernachtmann/RiderProjects/Fallout/.agents/skills/plain-english/SKILL.md`.

## Sources

- Antipatterns: `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/antipatterns/`, copied from
  Fallout-build/Fallout.Workbench at 5ea71294 (`antipatterns/`). Workbench PR 1 drafted them from about 640 review
  comments on closed Fallout PRs. The `evidence:` line in each file lists its source PRs: start there. The local
  Workbench clone is `/Users/alexandernachtmann/RiderProjects/Fallout.Workbench`, with the template at
  `templates/antipattern.md`.
- Fallout history: `/Users/alexandernachtmann/RiderProjects/Fallout`. Run `git fetch upstream` first; `upstream` is
  Fallout-build/Fallout and `develop` is its trunk.
- Pull requests and issues, through `gh` (each copied to a file, never linked):
  - `gh pr view <n> -R Fallout-build/Fallout --comments`
  - `gh api --paginate repos/Fallout-build/Fallout/pulls/<n>/comments` (inline review comments with their `diff_hunk`)
  - `gh api --paginate repos/Fallout-build/Fallout/pulls/<n>/reviews`
  - `gh api --paginate repos/Fallout-build/Fallout/issues/<n>/comments`
- The rules each outcome is measured against: `CONTRIBUTING.md`, `AGENTS.md` and `.agents/skills/` in the Fallout clone.
- Recent PRs by ANcpLua with full review threads: 694, 700, 711 (closed: opened without an approved issue) and issue 723.
- Model plugins, copied from dotnet/skills (MIT, .NET Foundation; notice in `examples/dotnet-skills/LICENSE`):
  - `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/wip/examples/dotnet-skills/plugins/dotnet-msbuild/`
  - `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/wip/examples/dotnet-skills/plugins/dotnet-nuget/`
  - `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/wip/examples/dotnet-skills/plugins/dotnet-test/`
    (`writing-mstest-tests` and the agents only)

## Where the plugin goes

- Build it as a plugin of this marketplace: follow `/Users/alexandernachtmann/RiderProjects/ancplua-anthropic/CLAUDE.md`
  and the steps of `.claude/skills/new-plugin/SKILL.md`. Name it `fallout-antipatterns` unless `verify.mjs` rejects
  the name.
- `status` and `evidence` are not Agent Skills frontmatter fields. Check https://agentskills.io/specification with the
  `lookup` skill of `ancplua-docs`, then move them into `metadata` or the body.
- Antipatterns are MIT (Maintainers of Fallout), and so is Fallout. Keep both notices in the plugin, because its
  references quote both.
- Done when `bun scripts/verify.mjs` ends with `verify: all checks passed`.

## Report

End with the plugin path, one line per skill with its reference count, and every antipattern claim or evidence PR you
dropped or changed, with the reason.
