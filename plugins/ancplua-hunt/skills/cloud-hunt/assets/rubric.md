# qyl hunter rubric

1. /mnt/session/outputs/findings.json exists and parses. Every finding has id, kind, severity, title, cause and at least one file:line location, and a finding-<id>.json with the same content exists for it. A bug also has input, expected, actual, reproducer, run, test, test_patch, test_run and fix; a quality finding also has quoted and modern_form or helper_signature. If nothing was proven, findings is empty and unproven lists what was checked with the evidence for and against each hypothesis.
2. For every bug, proof-<id>.<ext>, proof-<id>-before.txt and test-<id>.patch exist. The before output shows the bug (EXPECTED differs from ACTUAL, exit code 1). On a fresh clone at the commit the task names, test-<id>.patch applies with `git apply --check` and the regression test fails.
3. /mnt/session/outputs/verify.sh exists and, on a fresh clone at the commit, prints BUG for every bug and exits 1.
4. Every quality finding quotes the lines it names and gives the modern form or the helper signature; none is counted as a bug.
5. No production code was changed and no test, gate, snapshot, threshold or expected result was weakened, skipped or deleted; no dependency was added.
6. report.md lists the bugs hardest first (silent wrong results, then crashes on ordinary input, then the rest), then the quality findings by kind, then what was ruled out, then the suite command and its totals.
