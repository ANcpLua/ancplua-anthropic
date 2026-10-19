---
name: mixed-or-oversized-pr
status: draft
evidence: Fallout #393, #535, #610
---

# Mixed or oversized PR

## What it looks like
A PR that bundles a feature with a repo-wide reformat or visibility change, or carries rework commits and an unrelated commit side by side.

## Why it is a problem
Reviewers cannot see the real change. A reformat can hide two lines of logic in hundreds of changed lines.

## Instead
Keep one concern per PR. Put reformatting and cleanup in a separate PR. Squash rework into the commit it fixes, or split the PR. See the `restructure-pr-commits` skill.

## Example

```text
# Bad: one PR, three concerns
a1b2c3d Add --retries option to the publish target
d4e5f6a Reformat all files with the IDE cleanup
7a8b9c0 Fix typo in README
9d8e7f6 Address review comments
5c4b3a2 Address review comments again

# Good: separate PRs, each with focused commits
PR 1: Add --retries option to the publish target
  a1b2c3d Add the Retries parameter and wire it into Publish
  d4e5f6a Test retry behaviour
PR 2: Reformat the publish target (no behaviour change)
PR 3: Fix typo in README
```
