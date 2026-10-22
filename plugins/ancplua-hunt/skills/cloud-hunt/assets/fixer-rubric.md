# qyl fixer rubric

1. /mnt/session/outputs/changes.json exists and parses; every implemented entry has id, title, files and a note; every skipped entry has a reason with evidence.
2. fix.patch exists and `git apply --check` succeeds on a fresh clone of the repository at the commit the task names; it contains every implemented finding and nothing unrelated.
3. verify.sh exists; on a fresh clone with fix.patch applied it prints OK for every implemented finding and exits 0.
4. With fix.patch applied, the repository's own gate (the command AGENTS.md or CI names) passes, and report.md quotes the command and its totals.
5. No test, gate, snapshot, threshold or expected result was weakened, skipped or deleted; no suppression was added; no shim, adapter, flag or compatibility layer was introduced; generated code changed only through its generator.
6. New or changed tests follow the owner's rules: name Subject_State_Expected, no comments, one behavior per test, assertions by exact semantics, DataRow discriminators as constants, no try/catch/finally, FakeTimeProvider for time.
7. report.md lists the implemented findings in the task's order, then the skipped ones with evidence, then the gate totals.
