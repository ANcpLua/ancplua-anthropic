# ancplua-docs

Grounds answers about Claude and Claude Code in the current official documentation instead of memory. The plugin ships
one skill, `lookup`. It reads both documentation indexes, https://code.claude.com/docs/llms.txt for Claude Code
and https://claude.com/docs/llms.txt for claude.ai, Cowork and the plugin directory, fetches the pages that cover the
question, and answers from those pages with the page named behind each fact.

## Install

```bash
claude plugin marketplace add ANcpLua/ancplua-anthropic
claude plugin install ancplua-docs@ancplua-anthropic
```

## Components

| Component      | Invoke                                                                                    | What it does                                                           |
|:---------------|:------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------|
| Skill `lookup` | `/ancplua-docs:lookup <topic>`, or automatically when a task depends on a documented fact | Fetches both docs indexes, reads the relevant pages, answers from them |

## What the plugin runs, sends and fetches

The skill fetches documentation pages under code.claude.com and claude.com over HTTPS and, when it has produced a plugin
file, runs `claude plugin validate` on it. It sends nothing anywhere else and stores nothing on the machine.

Licensed under Apache-2.0; see the LICENSE file.
