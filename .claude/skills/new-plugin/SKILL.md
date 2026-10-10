---
name: new-plugin
description: Scaffolds a new plugin in the ancplua-anthropic marketplace.
disable-model-invocation: true
argument-hint: <plugin-name>
---

Plugin name requested: `$ARGUMENTS`

1. Read the house rules in `CLAUDE.md`. The name starts with `ancplua-`, is lowercase kebab-case, and is not yet a directory in `plugins/`. If the name is missing, invalid, or taken, propose a valid one and wait for confirmation.
2. Get the plugin's purpose as one sentence from the conversation, or ask for it. This sentence is the `description`.
3. Write `plugins/<name>/.claude-plugin/plugin.json`:
   ```json
   {
     "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
     "name": "<name>",
     "version": "0.1.0",
     "description": "<sentence>",
     "author": { "name": "ancplua" },
     "license": "Apache-2.0"
   }
   ```
4. Copy `plugins/ancplua-docs/LICENSE` to `plugins/<name>/LICENSE`.
5. Add `{ "name": "<name>", "source": "./plugins/<name>" }` to `plugins` in `.claude-plugin/marketplace.json`, keeping entries sorted by name.
6. Add the components the user described, each in the default location the docs give for it (https://code.claude.com/docs/en/plugins/components.md). With none described, add one skill at `skills/<skill>/SKILL.md` that does the plugin's core job, with frontmatter `name` equal to the directory.
7. Write `plugins/<name>/README.md`: at least 40 words of prose that describe what the plugin does, runs, sends and fetches, the line `claude plugin install <name>@ancplua-anthropic`, and a table of components with how each is invoked.
8. Run `node scripts/verify.mjs`. Done when it ends with `verify: all checks passed`.
