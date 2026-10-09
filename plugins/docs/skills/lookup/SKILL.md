---
name: lookup
description: Looks up the current Claude Code documentation before answering. Use when a task depends on Claude Code file names, frontmatter fields, settings keys, CLI flags, hook events, or plugin and marketplace schemas.
---

Claude Code ships changes weekly, so answer from the current docs.

1. Fetch https://code.claude.com/docs/llms.txt, the index of every docs page.
2. Pick the pages that cover the question and fetch each one at the `.md` URL the index lists.
3. Answer from those pages. Name the page behind each fact, and say plainly when the docs don't cover something.
4. When the answer is a plugin manifest, a marketplace file, or a skill, agent, or command directory, check it with `claude plugin validate <path> --strict` before calling it done.
