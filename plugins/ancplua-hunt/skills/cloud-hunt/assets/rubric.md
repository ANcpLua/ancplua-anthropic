# ancplua-hunt cloud rubric

1. /mnt/session/outputs/report.md exists. Each confirmed bug in it gives file:line, the input, the expected and the actual result, the test that fails before the fix and passes after it, and the fix, ordered hardest first: silent wrong results, then crashes on ordinary input, then the rest. If no bug was proven, report.md says so plainly and lists what was checked.
2. When report.md claims a fix or a deletion, /mnt/session/outputs/fix.patch exists and `git apply --check` succeeds on a fresh clone of the repository at the commit the task names; the same holds for each fix-<name>.patch against its related repository.
3. Every change in fix.patch and the fix-<name>.patch files is either a bug fix whose test is in the patch and fails without the fix, or the deletion of code no input can reach, with the reason in report.md. Nothing else changes.
4. With the patches applied, the repository's full test suite and its gates pass, and report.md quotes the commands it ran and their totals.
5. No test, gate, snapshot, threshold or expected result is weakened, skipped or deleted, except tests of code deleted as unreachable, and no coverage exclusion is added.
6. The patches keep the rules of the repository's AGENTS.md and CLAUDE.md, and new tests are written the way the repository already writes its tests.
7. Each hunter's report and patches are present, and report.md says what the lead accepted from each hunter and why it rejected the rest.
