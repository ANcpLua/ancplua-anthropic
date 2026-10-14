#!/usr/bin/env bun
// Every check this repository enforces, in one command, runnable from any directory:
//
//   bun scripts/verify.mjs                  validator, directory checklist, house rules
//   bun scripts/verify.mjs --base <ref>     also require a higher version for each plugin
//                                           changed since <ref>; CI passes this
//                                         unresolved refs use HEAD~1 and explain why
//
// The order follows the Authority section of CLAUDE.md, highest first:
//   1. `claude plugin validate --strict` on the marketplace, each plugin directory and .claude
//   2. the directory's pre-submission checklist rows on README, license, plugin name, file names,
//      links and submodules, SKILL.md spelling and .gitattributes
//   3. the ✓ house rules of CLAUDE.md; none repeats a validator check
//
// Gitignored files are invisible to every check: the validator runs on a temporary copy of the
// tracked and unignored files. Needs Bun 1.4+ and the Claude Code CLI on PATH. Exits 1 on any
// failure; a clean run ends with "verify: all checks passed".

import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const CHECKLIST = "https://claude.com/docs/plugins/pre-submission-checklist.md";
const MARKETPLACE_NAME = "ancplua-anthropic";
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ENTRY_KEYS = new Set(["name", "source", "category", "tags", "relevance", "dependencies"]);
const RESERVED_WHOLE_NAMES = new Set(["claude", "anthropic", "official", "plugin", "mcp", "test"]);
const SYSTEM_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", "__MACOSX"]);
const DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const cite = (message) => `${message} (${CHECKLIST})`;

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const gitList = (...args) => git("ls-files", "-z", ...args).split("\0").filter(Boolean);

// --- Files: gitignored paths are invisible; directory checks read tracked files ---------------

const ignoredPaths = new Set(
  gitList("--others", "--ignored", "--exclude-standard", "--directory").map((p) => p.replace(/\/$/, "")),
);

function isIgnored(path) {
  const parts = path.split(/[\\/]/);
  for (let i = 1; i <= parts.length; i++) if (ignoredPaths.has(parts.slice(0, i).join("/"))) return true;
  return false;
}

const present = (path) => existsSync(path) && !isIgnored(path);

function entries(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => !isIgnored(join(dir, e.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const subdirs = (dir) => entries(dir).filter((e) => e.isDirectory()).map((e) => e.name);

const jsonCache = new Map();
function readJson(path) {
  if (!jsonCache.has(path)) {
    try {
      jsonCache.set(path, JSON.parse(readFileSync(path, "utf8")));
    } catch (error) {
      fail(path, `cannot read JSON (${error.message})`);
      jsonCache.set(path, undefined);
    }
  }
  return jsonCache.get(path);
}

function frontmatter(file) {
  const match = readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return undefined;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

// --- 1. The validator: warnings are failures ----------------------------------------------------

// The validator reads the disk and knows nothing of .gitignore, so it runs on a temporary copy of
// the tracked and unignored files.
function visibleCopy() {
  const copy = mkdtempSync(join(tmpdir(), "ancplua-verify-"));
  for (const path of gitList("--cached", "--others", "--exclude-standard")) {
    if (!existsSync(path)) continue; // deleted in the working tree
    const target = join(copy, path);
    mkdirSync(dirname(target), { recursive: true });
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(path), target);
    else if (stat.isFile()) copyFileSync(path, target);
    else mkdirSync(target, { recursive: true }); // a submodule
  }
  return copy;
}

function runValidator(targets) {
  const shell = process.platform === "win32";
  const probe = spawnSync("claude", ["--version"], { encoding: "utf8", shell });
  if (probe.error || probe.status !== 0) {
    fail("claude", "CLI not found on PATH; install Claude Code (curl -fsSL https://claude.ai/install.sh | bash)");
    return;
  }
  console.log(`verify: ${probe.stdout.trim()}`);
  const copy = visibleCopy();
  // Messages name the paths in this checkout, not in the copy; the real path first, as on macOS
  // it contains the tmpdir() path.
  const here = (text) => [realpathSync(copy), copy].reduce((t, p) => t.replaceAll(p, ROOT), text);
  try {
    for (const target of targets) {
      const run = spawnSync("claude", ["plugin", "validate", target, "--strict"], { cwd: copy, encoding: "utf8", shell });
      const output = here(`${run.stdout ?? ""}${run.stderr ?? ""}`.trim());
      console.log(output);
      if (run.status === 0) continue;
      const findings = output.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("❯"));
      const detail = findings.length ? `\n      ${findings.join("\n      ")}` : ` (${output.split("\n").pop()})`;
      fail(target, `claude plugin validate --strict failed${detail}`);
    }
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

// --- 2. The directory's pre-submission checklist: the rows a local run can check ----------------

function checkGitAttributes() {
  for (const path of gitList().filter((p) => p.split("/").pop() === ".gitattributes")) {
    const active = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (active.some((l) => /(^|\s)(export-ignore|export-subst|filter(=|\s|$))/.test(l))) {
      fail(path, cite("keep export-ignore, export-subst and content filters out of .gitattributes; validation stops on them"));
    }
  }
}

function checkChecklist(name) {
  const root = `plugins/${name}`;

  const readme = `${root}/README.md`;
  if (!present(readme)) {
    fail(readme, cite("README missing: the directory shows it as the listing's description"));
  } else {
    const prose = readFileSync(readme, "utf8").replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
    const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (words < 40) fail(readme, cite(`README too short: ${words} words outside code blocks, the directory needs 40`));
  }

  const manifest = present(`${root}/.claude-plugin/plugin.json`) ? readJson(`${root}/.claude-plugin/plugin.json`) : undefined;
  if (!present(`${root}/LICENSE`) && !manifest?.license) {
    fail(root, cite("License missing: add a LICENSE file or set license in plugin.json"));
  }

  if (/[^\x20-\x7e]/.test(name)) fail(root, cite("Non-ASCII identifier: use lowercase letters, digits and hyphens"));
  if (RESERVED_WHOLE_NAMES.has(name.toLowerCase())) {
    fail(root, cite(`"${name}" is a reserved word; build the name around your own project name`));
  }

  const depth = root.split("/").length;
  const byLowerCase = new Map();
  const reported = new Set();
  const report = (where, message) => {
    if (reported.has(`${where}\n${message}`)) return;
    reported.add(`${where}\n${message}`);
    fail(where, cite(message));
  };
  for (const line of git("ls-files", "-s", "-z", "--", root).split("\0").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const mode = meta.split(" ")[0];
    if (mode === "120000") report(path, "symbolic link: commit regular files for everything the plugin loads");
    if (mode === "160000") report(path, "Git submodule: commit regular files and folders");
    const parts = path.split("/");
    for (let i = depth + 1; i <= parts.length; i++) {
      const segment = parts[i - 1];
      const partial = parts.slice(0, i).join("/");
      if (SYSTEM_FILES.has(segment)) report(partial, "macOS or Windows system file: remove it from the plugin folder");
      if (segment.includes(":") || /[. ]$/.test(segment) || DEVICE_NAME.test(segment)) {
        report(partial, "name must be valid on Windows and macOS: no colon, no trailing dot or space, no Windows device name");
      }
      const key = partial.toLowerCase();
      if (byLowerCase.has(key) && byLowerCase.get(key) !== partial) {
        report(partial, `differs only by capitalization from ${byLowerCase.get(key)}`);
      }
      byLowerCase.set(key, partial);
    }
  }
}

// --- 3. House rules: the ✓ lines of CLAUDE.md --------------------------------------------------

function checkName(where, name) {
  if (!NAME.test(name) || name.length > NAME_MAX) {
    fail(where, `name "${name}" must be lowercase kebab-case (${NAME.source}), at most ${NAME_MAX} characters`);
  }
}

function checkSkills(dir) {
  for (const entry of entries(dir)) {
    const where = join(dir, entry.name);
    if (!entry.isDirectory()) {
      fail(where, "skills/ holds only <skill>/ directories");
      continue;
    }
    checkName(where, entry.name);
    const file = join(where, "SKILL.md");
    // By name, not existsSync: a case-insensitive disk would accept skill.md
    if (!entries(where).some((e) => e.name === "SKILL.md")) {
      fail(where, cite("missing SKILL.md, spelled exactly so"));
      continue;
    }
    const fields = frontmatter(file);
    if (!fields) {
      fail(file, "missing YAML frontmatter on line 1");
      continue;
    }
    if (fields.name !== entry.name) fail(file, `frontmatter name "${fields.name}" must equal the directory name "${entry.name}"`);
  }
}

function checkAgents(dir) {
  for (const entry of entries(dir)) {
    const where = join(dir, entry.name);
    if (entry.isDirectory() || !entry.name.endsWith(".md")) {
      fail(where, "agents/ holds only flat <agent>.md files");
      continue;
    }
    const stem = entry.name.slice(0, -3);
    checkName(where, stem);
    const fields = frontmatter(where);
    if (fields?.name !== stem) fail(where, `frontmatter name "${fields?.name}" must equal the file name "${stem}"`);
  }
}

function checkMarketplace() {
  const path = ".claude-plugin/marketplace.json";
  const marketplace = readJson(path);
  if (!marketplace) return;

  if (marketplace.name !== MARKETPLACE_NAME) fail(`${path} name`, `must be "${MARKETPLACE_NAME}", the repository name`);

  const list = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const names = list.map((entry) => entry.name);
  if (names.join("\n") !== [...names].sort().join("\n")) fail(`${path} plugins`, "entries must be sorted by name");

  for (const entry of list) {
    const where = `${path} plugins[${entry.name}]`;
    if (entry.source !== `./plugins/${entry.name}`) fail(where, `source must be "./plugins/${entry.name}"`);
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) fail(where, `"${key}" belongs in plugins/${entry.name}/.claude-plugin/plugin.json, not in the entry`);
    }
  }

  const onDisk = subdirs("plugins");
  for (const dir of onDisk) if (!names.includes(dir)) fail(`plugins/${dir}`, "directory has no marketplace entry");
  for (const name of names) if (!onDisk.includes(name)) fail(`${path} plugins[${name}]`, "entry has no plugins/ directory");
}

function checkPlugin(name) {
  const root = `plugins/${name}`;

  const manifestDir = `${root}/.claude-plugin`;
  const extra = entries(manifestDir).map((e) => e.name).filter((n) => n !== "plugin.json");
  if (extra.length) fail(manifestDir, `only plugin.json belongs here, found: ${extra.join(", ")}`);

  const manifestPath = `${manifestDir}/plugin.json`;
  const manifest = present(manifestPath) ? readJson(manifestPath) : undefined;
  if (manifest) {
    if (manifest.name !== name) fail(manifestPath, `name "${manifest.name}" must equal the directory name "${name}"`);
    if (manifest.version !== undefined && !SEMVER.test(manifest.version)) {
      fail(manifestPath, `version "${manifest.version}" must be semver (x.y.z)`);
    }
    if (!manifest.license) fail(manifestPath, "set license (an SPDX id) beside the LICENSE file");
  }
  if (!present(`${root}/LICENSE`)) fail(`${root}/LICENSE`, "every plugin ships a LICENSE file beside plugin.json's license");

  if (present(`${root}/AGENTS.md`)) fail(`${root}/AGENTS.md`, "instructions ship as skills: move them into skills/<name>/SKILL.md");
  if (present(`${root}/commands`)) fail(`${root}/commands`, "slash commands ship as skills: write skills/<name>/SKILL.md");

  checkSkills(`${root}/skills`);
  checkAgents(`${root}/agents`);
}

// --- Versions: a plugin changed since --base needs a higher version ------------------------------

function compareSemver(a, b) {
  const [x, y] = [SEMVER.exec(a ?? ""), SEMVER.exec(b ?? "")];
  if (!x || !y) return NaN;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  return 0;
}

function checkVersionBumps(base, plugins) {
  try {
    git("rev-parse", "--verify", `${base}^{commit}`);
  } catch {
    const requested = base;
    base = "HEAD~1";
    try {
      git("rev-parse", "--verify", `${base}^{commit}`);
    } catch {
      fail("--base", `"${requested}" is not a commit here and HEAD~1 is unavailable; fetch history first`);
      return;
    }
    console.log(`verify: --base "${requested}" does not resolve to a commit; using HEAD~1`);
  }
  for (const name of plugins) {
    if (!git("diff", "--name-only", base, "--", `plugins/${name}`).trim()) continue;
    let before;
    try {
      before = JSON.parse(git("show", `${base}:plugins/${name}/.claude-plugin/plugin.json`)).version;
    } catch {
      continue; // plugin is new since base
    }
    const now = readJson(`plugins/${name}/.claude-plugin/plugin.json`)?.version;
    if (!(compareSemver(now, before) > 0)) {
      fail(`plugins/${name}`, `changed since ${base.slice(0, 12)} but version ${now} is not above ${before}`);
    }
  }
}

// --- Run ----------------------------------------------------------------------------------------

const plugins = subdirs("plugins");

runValidator([".", ...plugins.map((p) => `./plugins/${p}`), ...(present(".claude") ? ["./.claude"] : [])]);

checkGitAttributes();
plugins.forEach(checkChecklist);

checkMarketplace();
plugins.forEach(checkPlugin);
checkSkills(".claude/skills");
checkAgents(".claude/agents");

const baseIndex = process.argv.indexOf("--base");
if (baseIndex !== -1) {
  const base = process.argv[baseIndex + 1];
  if (base) checkVersionBumps(base, plugins);
  else fail("--base", "requires a ref");
}

if (errors.length) {
  console.error(`\nverify: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  ✘ ${error}`);
  process.exit(1);
}
console.log("\nverify: all checks passed");
