#!/usr/bin/env node
// Every check this repository enforces, in one command. Run from the repo root:
//
//   node scripts/verify.mjs                 schema + conventions
//   node scripts/verify.mjs --base <ref>    also require a version bump for each
//                                           plugin changed since <ref>
//
// The rules live in .claude/rules/conventions.md. Requires Node 18+ and the
// Claude Code CLI on PATH. Exits 1 on any failure.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ENTRY_KEYS = new Set(["name", "source", "category", "tags", "relevance", "dependencies"]);

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(path, `cannot read JSON (${error.message})`);
    return undefined;
  }
}

function entries(path) {
  return existsSync(path)
    ? readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    : [];
}

const subdirs = (path) => entries(path).filter((e) => e.isDirectory()).map((e) => e.name);

function checkName(where, name) {
  if (typeof name !== "string" || !NAME.test(name) || name.length > NAME_MAX) {
    fail(where, `name "${name}" must be lowercase kebab-case (${NAME.source}), max ${NAME_MAX} chars`);
  }
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

// --- Schema: the real validator, warnings are failures -----------------------

function runClaudeValidate(targets) {
  const probe = spawnSync("claude", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
  if (probe.error || probe.status !== 0) {
    fail("claude", "CLI not found on PATH; install Claude Code (npm install -g @anthropic-ai/claude-code)");
    return;
  }
  console.log(`verify: ${probe.stdout.trim()}`);
  for (const target of targets) {
    const run = spawnSync("claude", ["plugin", "validate", target, "--strict"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (run.status !== 0) fail(target, "claude plugin validate --strict failed (output above)");
  }
}

// --- Conventions --------------------------------------------------------------

function checkSkills(dir) {
  for (const entry of entries(dir)) {
    const where = join(dir, entry.name);
    if (!entry.isDirectory()) {
      fail(where, "skills/ holds only <skill>/ directories");
      continue;
    }
    checkName(where, entry.name);
    if (entry.name.toLowerCase() === "synced" || entry.name.toLowerCase().startsWith("anthropic-skills")) {
      fail(where, "reserved skill name");
    }
    const file = join(where, "SKILL.md");
    if (!existsSync(file)) {
      fail(where, "missing SKILL.md (exact case)");
      continue;
    }
    const fields = frontmatter(file);
    if (!fields) {
      fail(file, "missing YAML frontmatter on line 1");
      continue;
    }
    if (fields.name !== entry.name) fail(file, `frontmatter name "${fields.name}" must equal directory "${entry.name}"`);
    if (!fields.description) fail(file, "frontmatter needs a description");
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
    if (fields?.name !== stem) fail(where, `frontmatter name "${fields?.name}" must equal file name "${stem}"`);
    if (!fields?.description) fail(where, "frontmatter needs a description");
  }
}

function checkMarketplace() {
  const path = ".claude-plugin/marketplace.json";
  const marketplace = readJson(path);
  if (!marketplace) return;

  checkName(`${path} name`, marketplace.name);
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (repo && marketplace.name !== repo) fail(`${path} name`, `"${marketplace.name}" must equal the repository name "${repo}"`);

  const list = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const names = list.map((entry) => entry.name);
  if (names.join("\n") !== [...names].sort().join("\n")) fail(`${path} plugins`, "entries must be sorted by name");

  for (const entry of list) {
    const where = `${path} plugins[${entry.name}]`;
    checkName(where, entry.name);
    if (entry.source !== `./plugins/${entry.name}`) fail(where, `source must be "./plugins/${entry.name}"`);
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.has(key)) fail(where, `"${key}" belongs in plugins/${entry.name}/.claude-plugin/plugin.json, not the entry`);
    }
  }

  const onDisk = subdirs("plugins");
  for (const dir of onDisk) if (!names.includes(dir)) fail(`plugins/${dir}`, "directory has no marketplace entry");
  for (const name of names) if (!onDisk.includes(name)) fail(`${path} plugins[${name}]`, "entry has no plugins/ directory");
}

function checkPlugin(name) {
  const root = join("plugins", name);
  checkName(root, name);

  const manifestDir = join(root, ".claude-plugin");
  const manifestPath = join(manifestDir, "plugin.json");
  if (!existsSync(manifestPath)) {
    fail(root, "missing .claude-plugin/plugin.json");
  } else {
    const extra = entries(manifestDir).map((e) => e.name).filter((n) => n !== "plugin.json");
    if (extra.length) fail(manifestDir, `only plugin.json belongs here, found: ${extra.join(", ")}`);
    const manifest = readJson(manifestPath);
    if (manifest) {
      if (manifest.name !== name) fail(manifestPath, `name "${manifest.name}" must equal directory "${name}"`);
      if (!SEMVER.test(manifest.version ?? "")) fail(manifestPath, `version "${manifest.version}" must be semver (x.y.z)`);
      if (!manifest.description) fail(manifestPath, "missing description");
      if (!manifest.author?.name) fail(manifestPath, "missing author.name");
    }
  }

  for (const file of ["CLAUDE.md", "AGENTS.md"]) {
    if (existsSync(join(root, file))) fail(join(root, file), "never loads from a plugin; move the instructions into a skill");
  }
  if (existsSync(join(root, "commands"))) fail(join(root, "commands"), "write slash commands as skills/<name>/SKILL.md");

  checkSkills(join(root, "skills"));
  checkAgents(join(root, "agents"));
}

// --- Versions: a changed plugin needs a higher version --------------------------

function compareSemver(a, b) {
  const [x, y] = [SEMVER.exec(a ?? ""), SEMVER.exec(b ?? "")];
  if (!x || !y) return NaN;
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i]);
  return 0;
}

function checkVersionBumps(base, plugins) {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    git("rev-parse", "--verify", `${base}^{commit}`);
  } catch {
    console.log(`verify: base "${base}" is not a commit here; skipping the version check`);
    return;
  }
  for (const name of plugins) {
    if (!git("diff", "--name-only", base, "--", `plugins/${name}`)) continue;
    let before;
    try {
      before = JSON.parse(git("show", `${base}:plugins/${name}/.claude-plugin/plugin.json`)).version;
    } catch {
      continue; // plugin is new since base
    }
    const now = readJson(join("plugins", name, ".claude-plugin", "plugin.json"))?.version;
    if (!(compareSemver(now, before) > 0)) {
      fail(`plugins/${name}`, `changed since ${base.slice(0, 12)} but version ${now} is not above ${before}`);
    }
  }
}

// --- Run ------------------------------------------------------------------------

if (!existsSync(".claude-plugin/marketplace.json")) {
  console.error("verify: run from the repository root");
  process.exit(1);
}

const plugins = subdirs("plugins");
runClaudeValidate([".", ...plugins.map((p) => `./plugins/${p}`), ...(existsSync(".claude/skills") ? ["./.claude/skills"] : [])]);
checkMarketplace();
plugins.forEach(checkPlugin);
checkSkills(".claude/skills");
checkAgents(".claude/agents");

const baseIndex = process.argv.indexOf("--base");
if (baseIndex !== -1) {
  const base = process.argv[baseIndex + 1];
  if (base && !/^0+$/.test(base)) checkVersionBumps(base, plugins);
  else console.log("verify: no usable --base; skipping the version check");
}

if (errors.length) {
  console.error(`\nverify: ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  ✘ ${error}`);
  process.exit(1);
}
console.log("\nverify: all checks passed");
