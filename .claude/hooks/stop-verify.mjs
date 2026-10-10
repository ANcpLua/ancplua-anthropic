#!/usr/bin/env node
// Project Stop hook, wired in .claude/settings.json. It runs scripts/verify.mjs in the git root
// of the session's cwd, so a worktree checks itself, and only when that root is this marketplace:
// another repository's script is never run. On a failure it exits 2 with the whole
// report on stderr, validator messages included, once per distinct failure per session_id; that
// memory lives in the OS temp directory. It reads no stop_hook_active on purpose: /goal is itself
// a Stop hook and sets that flag on every continuation, and this hook cannot loop because the
// second sight of the same failure exits 0.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // no usable input: nothing to key on, verify anyway
}
const cwd = typeof input.cwd === "string" && existsSync(input.cwd) ? input.cwd : process.cwd();

const top = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
if (top.status !== 0) process.exit(0); // not a git checkout: nothing to verify
const root = top.stdout.trim();
let marketplace;
try {
  marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8"));
} catch {
  // no marketplace: another repository
}
if (marketplace?.name !== "ancplua-anthropic") process.exit(0); // another repository: not ours to verify
const script = join(root, "scripts", "verify.mjs");
if (!existsSync(script)) process.exit(0); // a checkout without the script: nothing to verify

const run = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
if (run.status === 0) process.exit(0);

const report = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim() || `verify.mjs did not run: ${run.error?.message ?? `exit ${run.status}`}`;
const problems = report.split("\n").filter((line) => line.trimStart().startsWith("✘"));
const key = createHash("sha256").update(problems.length ? problems.join("\n") : report).digest("hex").slice(0, 16);

const session = String(input.session_id ?? "no-session").replace(/[^A-Za-z0-9._-]/g, "_");
const stateDir = join(tmpdir(), "ancplua-anthropic-stop-hook");
const stateFile = join(stateDir, `${session}.json`);
let seen = [];
try {
  seen = JSON.parse(readFileSync(stateFile, "utf8")).seen ?? [];
} catch {
  // first failure in this session
}
if (seen.includes(key)) process.exit(0); // this exact failure was already reported in this session

try {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ seen: [...seen, key] }));
} catch {
  // without state the next stop reports again, the safer failure
}
process.stderr.write(
  `verify.mjs failed in ${root}. Fix every problem below, then run node scripts/verify.mjs until it ends in "verify: all checks passed".\n\n${report}\n`,
);
process.exit(2);
