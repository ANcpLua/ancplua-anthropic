---
name: lookup
description: Looks up the current Claude and Claude Code documentation before answering. Use when a task depends on Claude Code file names, frontmatter fields, settings keys, CLI flags, hook events, plugin or marketplace schemas, or on how claude.ai, Cowork and the plugin directory treat a plugin.
---

Claude Code ships changes weekly, so answer from the current docs, never from memory.

1. Fetch both indexes. https://code.claude.com/docs/llms.txt lists every Claude Code page: CLI, settings, hooks, skills,
   plugins, marketplaces. https://claude.com/docs/llms.txt lists every claude.ai page: chat, Cowork, platform support,
   the plugin directory and its submission checks.
2. From either index, pick the pages that cover the question and fetch each one at the `.md` URL the index lists.
3. Answer from those pages. Name the page behind each fact, and say plainly when the docs don't cover something.
4. When the answer is a plugin manifest, a marketplace file, or a skill, agent or command directory, check it with
   `claude plugin validate <path> --strict` before calling it done.
