# ancplua-hunt cloud rubric

1. /mnt/session/outputs/findings.json exists and parses. Every finding in it has id, severity, title, cause, at least one file:line location, input, expected, actual, reproducer, run, test, test_run, fix and verified_by_lead: true, and a finding-<id>.json with the same content exists for it. If nothing was proven, findings is empty, and unproven lists what was checked with the evidence for and against each hypothesis.
2. For every finding, proof-<id>.<ext>, proof-<id>-before.txt and proof-<id>-after.txt exist. The before output shows the bug (EXPECTED differs from ACTUAL, exit code 1) and the after output shows it gone (exit code 0).
3. /mnt/session/outputs/verify.sh exists. On a fresh clone of the repository at the commit the task names it prints BUG for every finding and exits 1; with fix.patch applied it prints FIXED for every finding and exits 0.
4. When findings is not empty, fix.patch exists and `git apply --check` succeeds on a fresh clone at that commit; the same holds for each fix-<name>.patch against its related repository and for cleanup.patch when present.
5. Every change in fix.patch is a bug fix whose regression test is in the patch and fails without the fix. Deletions of unreachable code are only in cleanup.patch, each with its reason in report.md. Nothing else changes.
6. With fix.patch applied, the repository's full test suite and its gates pass, and report.md quotes the commands and their totals.
7. No test, gate, snapshot, threshold or expected result is weakened, skipped or deleted, except tests of code deleted as unreachable, no coverage exclusion is added, and no fix hides a symptom instead of removing its cause.
8. The patches keep the rules of the repository's AGENTS.md and CLAUDE.md, and new tests follow the way the repository already writes its tests.
9. report.md lists the findings hardest first (silent wrong results, then crashes on ordinary input, then the rest) and has one section per hunter saying what the lead accepted and why it rejected the rest. A hunter that stopped early because the root cause was already found counts as complete.
