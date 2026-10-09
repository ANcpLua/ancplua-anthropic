---
name: new-plugin
description: Scaffolds a new plugin in the ancplua-anthropic marketplace.
disable-model-invocation: true
argument-hint: <plugin-name>
---

Plugin name requested: `$ARGUMENTS`

1. Read `.claude/rules/conventions.md`. Check the name against its pattern and against the directories in `plugins/`. If the name is missing, invalid, or taken, propose a valid one and wait for confirmation.
2. Get the plugin's purpose as one sentence from the conversation, or ask for it. This sentence is the `description`.
3. Write `plugins/<name>/.claude-plugin/plugin.json`:
   ```json
   {
     "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
     "name": "<name>",
     "version": "0.1.0",
     "description": "<sentence>",
     "author": { "name": "ancplua" }
   }
   ```
4. Add `{ "name": "<name>", "source": "./plugins/<name>" }` to `plugins` in `.claude-plugin/marketplace.json`, keeping entries sorted by name.
5. Add the components the user described, each in its default location from the conventions' plugin layout. With none described, add one skill at `skills/<skill>/SKILL.md` that does the plugin's core job.
6. Write `plugins/<name>/README.md`: the description, the line `claude plugin install <name>@ancplua-anthropic`, and a table of components with how each is invoked.
7. Run `node scripts/verify.mjs`. Done when it passes.
