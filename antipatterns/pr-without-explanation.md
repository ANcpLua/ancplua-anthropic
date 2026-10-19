---
name: pr-without-explanation
status: draft
evidence: Fallout #425, #450, #478, #580
---

# PR without an explanation

## What it looks like
A description that links an issue but does not say what the change does or why. No tests, with no reason given. Unrelated edits with no comment.

## Why it is a problem
Reviewers have to guess the intent, so the first round of review is spent asking questions.

## Instead
State the problem, the change and how you checked it. Add tests, or say why not. Explain each unrelated edit or move it to another PR. See the `plain-english` skill.

## Example

```markdown
<!-- Bad -->
Fixes #412

<!-- Good -->
## Problem
`fallout-migrate` renames `NukeVersion` but keeps the old value when the tag
has a space before `>`. The project then builds against Nuke.

## Change
The regex now allows whitespace before the closing `>`.

## Checked
- New test: `A_version_tag_with_trailing_space_is_bumped`
- Ran the migration on the canary repo. The version changed to 10.4.0.
```
