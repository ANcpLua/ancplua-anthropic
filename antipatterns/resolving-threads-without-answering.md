---
name: resolving-threads-without-answering
status: draft
evidence: Fallout #478
---

# Resolving review threads without answering

## What it looks like
Marking a reviewer's comment as resolved without a fix or a reply. Re-requesting review while earlier findings are still open.

## Why it is a problem
The reviewer has to reopen the thread and re-check everything, which erodes trust.

## Instead
Reply to each thread with a fix, a reason for disagreeing, or a follow-up issue. Let the reviewer resolve it, or resolve it only after you have fixed it.

## Example

```text
# Bad
Reviewer: This picks the first PropertyGroup even if it has a Condition.
          FalloutVersion would be undefined in other configurations.
Author:   [marks the conversation as resolved, no reply, no change]

# Good
Reviewer: (same comment)
Author:   Good catch. Fixed in 3f2a1b9: it now skips conditioned groups.
          Added a test for it.
          (The reviewer resolves the thread after checking.)

# Also good
Author:   Agreed, but it needs a wider change. Filed #455 and linked it here.
```
