#!/usr/bin/env node
// cloud-hunt: start parallel Claude Opus bug hunters on a public GitHub repository as a Claude
// Managed Agent, print one line per meaningful change for the Monitor tool, and download the
// report and patches.
//
// The Agent and the Environment come from this skill's assets/ templates. They are created (or
// adopted by name) on first use and updated when a template changes; their ids live in
// <home>/cloud/state.json. Per-run details (repository, commit, scope or issue, hunter count) go
// into the session's outcome, never into the agent. Spend is capped per session (--budget) and
// across all hunts by the ledger the local hunt shares (<home>/ledger.jsonl, cap
// $ANCPLUA_HUNT_CAP). <home> is $ANCPLUA_HUNT_HOME, default ~/.ancplua-hunt.
// Node 22+; the only dependency is the pinned `yaml` package.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(SKILL_DIR, "assets");
const WRAPPER = path.join(SKILL_DIR, "scripts", "cloud-hunt.sh");
const API = (process.env.ANCPLUA_HUNT_API_BASE || "https://api.anthropic.com").replace(/\/$/, "") + "/v1";
const GITHUB_API = (process.env.ANCPLUA_HUNT_GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const BETA = "managed-agents-2026-04-01";
const HUNT_HOME = path.resolve(process.env.ANCPLUA_HUNT_HOME || path.join(os.homedir(), ".ancplua-hunt"));
const LEDGER = path.join(HUNT_HOME, "ledger.jsonl");
const CLOUD_HOME = path.join(HUNT_HOME, "cloud");
const STATE = path.join(CLOUD_HOME, "state.json");
const DEFAULT_CAP = Number(process.env.ANCPLUA_HUNT_CAP) > 0 ? Number(process.env.ANCPLUA_HUNT_CAP) : 100;
const TERMINAL_OUTCOMES = new Set(["satisfied", "max_iterations_reached", "failed", "interrupted"]);
const consoleUrl = (id) => `https://platform.claude.com/workspaces/default/sessions/${id}`;

const HELP = `cloud-hunt: parallel Claude Opus bug hunters on a public GitHub repository, in a Managed Agents sandbox

  sh cloud-hunt.sh --repo <owner/name> [--commit <sha> | --pr <n> | --ref <branch>] [options]
  sh cloud-hunt.sh --watch <session id>   keep watching a running hunt and download its results
  sh cloud-hunt.sh --setup                create or update the Agent and Environment, start nothing

  --repo <owner/name>      the repository, or its GitHub URL; cloned in the sandbox with plain git
  --commit/--pr/--ref      what to hunt on (default: the head of the default branch)
  --also <owner/name[@ref]> a related public repository the cause or fix may sit in, at a branch, tag or
                           commit (default: its default branch); cloned beside the first; repeatable
  --issue <file>           hunt the root cause of this issue (or --issue-text "<text>")
  --scope "<text>"         what to sweep without an issue, e.g. "src/Parser" (default: the whole repository)
  --hunters <3-5>          parallel hunters (default 4)
  --effort <high|xhigh>    Opus 5.5 effort for the lead and the hunters (default xhigh)
  --budget <usd>           spend cap for this session (default 40)
  --extra-rubric <file>    criteria appended to the shipped rubric, e.g. a coverage target
  --iterations <n>         grader rounds before the hunt stops (default 2, max 20)
  --cap <usd>              total cap across all hunts in the ledger (default $ANCPLUA_HUNT_CAP or 100)
  --minutes <n>            how long to watch before handing back (default 120); the session keeps running
  --poll <seconds>         poll interval (default 30)
  --out <dir>              where results go (default ~/.ancplua-hunt/cloud/<session id>)
  --dry-run                print the session request, call nothing but GitHub
  --ledger                 print spend so far and exit
`;

function parseArgs(argv) {
  const a = { also: [], hunters: 4, effort: "xhigh", budget: 40, iterations: 2, cap: DEFAULT_CAP, minutes: 120, poll: 30 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${k} needs a value`);
      return argv[++i];
    };
    switch (k) {
      case "--repo": a.repo = next(); break;
      case "--also": a.also.push(next()); break;
      case "--commit": a.commit = next(); break;
      case "--pr": a.pr = next(); break;
      case "--ref": a.ref = next(); break;
      case "--issue": a.issue = next(); break;
      case "--issue-text": a.issueText = next(); break;
      case "--scope": a.scope = next(); break;
      case "--hunters": a.hunters = Number(next()); break;
      case "--effort": a.effort = next(); break;
      case "--budget": a.budget = Number(next()); break;
      case "--extra-rubric": a.extraRubric = next(); break;
      case "--iterations": a.iterations = Number(next()); break;
      case "--cap": a.cap = Number(next()); break;
      case "--minutes": a.minutes = Number(next()); break;
      case "--poll": a.poll = Number(next()); break;
      case "--out": a.out = next(); break;
      case "--watch": a.watch = next(); break;
      case "--setup": a.setup = true; break;
      case "--dry-run": a.dryRun = true; break;
      case "--ledger": a.ledgerOnly = true; break;
      case "-h": case "--help": a.help = true; break;
      default: throw new Error(`unknown argument: ${k}`);
    }
  }
  return a;
}

const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const cents = (m) => (m && m.amount != null ? Number(m.amount) / 100 : 0);
const oneLine = (s, max = 200) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expandHome = (p) => p.replace(/^~(?=\/|$)/, os.homedir());

let eventsPath = null;
function emit(line) {
  console.log(line);
  if (eventsPath) fs.appendFileSync(eventsPath, `${new Date().toISOString()} ${line}\n`);
}

function readLedger() {
  const bySession = new Map();
  let spent = 0;
  if (fs.existsSync(LEDGER)) {
    for (const line of fs.readFileSync(LEDGER, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        const c = Number(r.cost_usd) || 0;
        spent += c;
        if (r.session) bySession.set(r.session, (bySession.get(r.session) || 0) + c);
      } catch { /* skip a bad line */ }
    }
  }
  return { spent, bySession };
}

function recordCost(sessionId, totalCost, extra) {
  const already = readLedger().bySession.get(sessionId) || 0;
  const delta = Math.round((totalCost - already) * 100) / 100;
  if (delta <= 0) return;
  fs.mkdirSync(HUNT_HOME, { recursive: true });
  fs.appendFileSync(LEDGER, `${JSON.stringify({ ts: new Date().toISOString(), kind: "cloud", session: sessionId, cost_usd: delta, ...extra })}\n`);
}

async function api(key, method, p, body) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-beta": BETA, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${method} ${p} → HTTP ${res.status}: ${oneLine(text, 400)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}
const apiJson = async (key, method, p, body) => (await api(key, method, p, body)).json();
async function apiFind(key, p) {
  try {
    return await apiJson(key, "GET", p);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function github(p) {
  const res = await fetch(`${GITHUB_API}${p}`, { headers: { "user-agent": "ancplua-hunt", accept: "application/vnd.github+json" } });
  if (res.status === 404) throw new Error(`GitHub ${p} → 404: the repository or ref doesn't exist or isn't public; cloud hunts clone public repositories only`);
  if (!res.ok) throw new Error(`GitHub ${p} → HTTP ${res.status}`);
  return res.json();
}

function normalizeRepo(value) {
  const m = String(value).trim().match(/^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error(`--repo must be owner/name or a github.com URL: ${value}`);
  return m[1];
}

async function resolveCommit(repo, { commit, pr, ref }) {
  if (commit) {
    if (!/^[0-9a-f]{7,40}$/i.test(commit)) throw new Error(`--commit must be a hex SHA: ${commit}`);
    return { sha: commit.length === 40 ? commit.toLowerCase() : (await github(`/repos/${repo}/commits/${commit}`)).sha };
  }
  if (pr) {
    const p = await github(`/repos/${repo}/pulls/${pr}`);
    if (p.head?.repo?.full_name && p.head.repo.full_name !== repo) {
      throw new Error(`PR #${pr} comes from ${p.head.repo.full_name}; hunt on that repository with --repo and --commit instead`);
    }
    return { sha: p.head.sha, pr: Number(pr) };
  }
  const branch = ref || (await github(`/repos/${repo}`)).default_branch;
  return { sha: (await github(`/repos/${repo}/commits/${encodeURIComponent(branch)}`)).sha, ref: branch };
}

// --also <owner/name[@ref]>: the ref after the last @ may hold slashes (feature/x); a bare SSH URL
// such as git@github.com:owner/name.git has no ref.
async function resolveAlso(spec, primary) {
  const at = spec.lastIndexOf("@");
  let repo = null;
  let ref;
  if (at > 0) {
    try {
      repo = normalizeRepo(spec.slice(0, at));
      ref = spec.slice(at + 1) || undefined;
    } catch { /* the @ belongs to the URL */ }
  }
  repo ??= normalizeRepo(spec);
  if (repo.toLowerCase() === primary.toLowerCase()) throw new Error(`--also ${spec} is the repository being hunted`);
  const commit = ref && /^[0-9a-f]{7,40}$/i.test(ref) ? ref : undefined;
  const target = await resolveCommit(repo, { commit, ref: commit ? undefined : ref });
  return { repo, name: repo.split("/")[1], sha: target.sha };
}

function loadTemplates() {
  const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
  const agentText = fs.readFileSync(path.join(ASSETS, "agent.md"), "utf8");
  const m = agentText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error("assets/agent.md needs YAML frontmatter");
  const envText = fs.readFileSync(path.join(ASSETS, "environment.yaml"), "utf8");
  return {
    agent: { ...YAML.parse(m[1]), system: m[2].trim() },
    environment: YAML.parse(envText),
    agentHash: hash(agentText),
    envHash: hash(envText),
  };
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return {};
  }
}
function writeState(state) {
  fs.mkdirSync(CLOUD_HOME, { recursive: true });
  fs.writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
}

// Creates the Agent and the Environment from the templates on first use (adopting same-named
// ones when state.json is missing), updates them when a template changed, and recreates one
// that was archived or deleted. Returns their ids.
async function ensureResources(key, t) {
  const state = readState();
  const live = (r) => r && !r.archived_at;

  let env = state.environment?.id && live(await apiFind(key, `/environments/${state.environment.id}`)) ? state.environment : null;
  if (!env) {
    const found = ((await apiJson(key, "GET", "/environments?limit=100")).data || []).find((e) => e.name === t.environment.name && live(e));
    const saved = found
      ? await apiJson(key, "POST", `/environments/${found.id}`, t.environment)
      : await apiJson(key, "POST", "/environments", t.environment);
    env = { id: saved.id, hash: t.envHash };
    emit(`SETUP environment ${env.id} ${found ? "adopted and updated" : "created"} (${t.environment.name})`);
  } else if (env.hash !== t.envHash) {
    await apiJson(key, "POST", `/environments/${env.id}`, t.environment);
    env = { id: env.id, hash: t.envHash };
    emit(`SETUP environment ${env.id} updated from the template`);
  }
  writeState({ ...state, environment: env });

  let agent = state.agent?.id && live(await apiFind(key, `/agents/${state.agent.id}`)) ? state.agent : null;
  if (!agent || agent.hash !== t.agentHash) {
    const found = agent ?? ((await apiJson(key, "GET", "/agents?limit=100")).data || []).find((x) => x.name === t.agent.name && live(x));
    const saved = found
      ? await apiJson(key, "POST", `/agents/${found.id}`, t.agent)
      : await apiJson(key, "POST", "/agents", t.agent);
    agent = { id: saved.id, version: saved.version, hash: t.agentHash };
    emit(`SETUP agent ${agent.id} ${found ? "updated to" : "created at"} version ${agent.version} (${t.agent.name})`);
  }
  writeState({ ...readState(), environment: env, agent });
  return { agent, environment: env };
}

function describe({ repo, target, also, hunters, issue, scope }) {
  const where = `https://github.com/${repo} at commit ${target.sha}${target.pr ? ` (the head of pull request #${target.pr})` : ""}`;
  const job = issue
    ? `Find, prove and fix the root cause of the issue below, and any other bug you prove on the way, in ${where}${scope ? `; scope: ${scope}` : ""}.`
    : `Hunt the hardest bugs in ${scope || "the whole repository"} of ${where}.`;
  const related = also.length
    ? ` The cause or the fix may also sit in these related repositories; clone each beside it: ${also.map((r) => `https://github.com/${r.repo} at commit ${r.sha} into /workspace/also/${r.name}`).join("; ")}.`
    : "";
  const patches = also.map((r) => `, /mnt/session/outputs/fix-${r.name}.patch when ${r.repo} changed`).join("");
  return `${job}${related} Work with ${hunters} parallel hunters as your instructions describe. Deliver /mnt/session/outputs/report.md, /mnt/session/outputs/fix.patch when anything was proven${patches}, and each hunter's report and patches.${issue ? `\n\n<issue>\n${issue.trim()}\n</issue>` : ""}`;
}

function rubric(extraFile) {
  const base = fs.readFileSync(path.join(ASSETS, "rubric.md"), "utf8").trim();
  if (!extraFile) return `${base}\n`;
  const extra = fs.readFileSync(expandHome(extraFile), "utf8").trim();
  if (!extra) throw new Error("--extra-rubric is empty");
  return `${base}\n\n## Task-specific criteria\n\n${extra}\n`;
}

async function watch(key, sessionId, a) {
  const started = Date.now();
  const deadline = started + a.minutes * 60_000;
  let lastStatus = null;
  let lastOutcome = null;
  const hunters = new Map();
  let firstPoll = true;
  let idleStreak = 0;
  let lastHeartbeat = Date.now();

  while (true) {
    const session = await apiJson(key, "GET", `/sessions/${sessionId}`);
    const cost = cents(session.usage?.list_cost);
    const cap = session.budget?.max_list_cost ? cents(session.budget.max_list_cost) : null;
    const oc = session.outcome_evaluations?.[session.outcome_evaluations.length - 1];

    if (session.status !== lastStatus) {
      emit(`STATUS ${session.status} (${usd(cost)}${cap ? ` of ${usd(cap)}` : ""})`);
      lastStatus = session.status;
    }
    const ocKey = oc ? `${oc.iteration}:${oc.result}` : null;
    if (oc && ocKey !== lastOutcome && oc.result !== "pending") {
      const why = oc.explanation ? ` :: ${oneLine(oc.explanation, 300)}` : "";
      emit(`OUTCOME round ${Number(oc.iteration) + 1} ${oc.result}${why}`);
      lastOutcome = ocKey;
    }

    try {
      for (const t of (await apiJson(key, "GET", `/sessions/${sessionId}/threads`)).data || []) {
        if (!t.parent_thread_id) continue;
        let h = hunters.get(t.id);
        if (!h) {
          h = { n: hunters.size + 1, status: t.status };
          hunters.set(t.id, h);
          // Threads already present when watching starts (--watch) are summed up below, not "started".
          if (!firstPoll) emit(`THREAD hunter ${h.n} started`);
        } else if (h.status !== t.status && (t.status === "idle" || t.status === "terminated")) {
          emit(`THREAD hunter ${h.n} ${t.status} (${usd(cents(t.usage?.list_cost))})`);
        }
        h.status = t.status;
      }
      if (firstPoll && hunters.size) {
        const running = [...hunters.values()].filter((h) => h.status === "running").length;
        emit(`THREAD ${hunters.size} hunters so far: ${running} running, ${hunters.size - running} idle`);
      }
      firstPoll = false;
    } catch {
      // Thread detail is progress only; the session poll decides when the hunt is over.
    }

    let reason = null;
    if (session.status === "terminated") reason = "terminated";
    else if (session.status === "idle") {
      idleStreak++;
      if (oc && TERMINAL_OUTCOMES.has(oc.result)) reason = `outcome ${oc.result}`;
      else if (session.stop_reason?.type === "budget_reached") reason = `paused at its ${usd(cap)} budget; raise it in the console to continue`;
      else if (session.stop_reason?.type === "requires_action") reason = "waiting for a tool confirmation in the console";
      else if (idleStreak >= 6) reason = "idle without a finished outcome";
    } else idleStreak = 0;
    if (reason) return { session, done: true, reason };

    if (Date.now() > deadline) {
      emit(`TIMEOUT stopped watching after ${a.minutes} min; the session keeps running. Resume with: sh ${WRAPPER} --watch ${sessionId}`);
      return { session, done: false };
    }
    if (Date.now() - lastHeartbeat > 10 * 60_000) {
      emit(`WORKING ${Math.round((Date.now() - started) / 60000)} min, ${usd(cost)}`);
      lastHeartbeat = Date.now();
    }
    await sleep(a.poll * 1000);
  }
}

async function download(key, sessionId, out) {
  let files = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    files = (await apiJson(key, "GET", `/files?scope_id=${encodeURIComponent(sessionId)}`)).data || [];
    if (files.some((f) => /(^|\/)report\.md$/.test(f.filename || ""))) break;
    await sleep(10_000);
  }
  const saved = [];
  for (const f of files) {
    const name = path.basename(f.filename || f.id);
    const res = await api(key, "GET", `/files/${f.id}/content`);
    fs.writeFileSync(path.join(out, name), Buffer.from(await res.arrayBuffer()));
    saved.push(name);
  }
  return saved;
}

async function finish(key, sessionId, a, out, meta) {
  const { session, done, reason } = await watch(key, sessionId, a);
  const cost = cents(session.usage?.list_cost);
  recordCost(sessionId, cost, meta);
  fs.writeFileSync(path.join(out, "session.json"), `${JSON.stringify(session, null, 2)}\n`);
  if (!done) return;
  const saved = await download(key, sessionId, out);
  const oc = session.outcome_evaluations?.[session.outcome_evaluations.length - 1];
  const report = saved.includes("report.md") ? path.join(out, "report.md") : null;
  const fixes = saved.filter((n) => /^fix(-.+)?\.patch$/.test(n)).sort().map((n) => path.join(out, n));
  emit(`DONE ${sessionId}: ${reason}${oc ? `, grader ${oc.result}` : ""}; ${usd(cost)}; ledger ${usd(readLedger().spent)}/${usd(a.cap)}; ${saved.length} files in ${out}${report ? `; read ${report}` : "; no report.md, check the console"}${fixes.length ? `; patch ${fixes.join(", ")}` : ""}`);
}

function outDir(a, sessionId) {
  const out = path.resolve(a.out ? expandHome(a.out) : path.join(CLOUD_HOME, sessionId));
  fs.mkdirSync(out, { recursive: true });
  eventsPath = path.join(out, "events.log");
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { process.stdout.write(HELP); return; }
  const ledger = readLedger();
  if (a.ledgerOnly) { console.log(`LEDGER ${usd(ledger.spent)} spent (${LEDGER})`); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!a.dryRun && !key) throw new Error("ANTHROPIC_API_KEY is not set (run through cloud-hunt.sh, which reads it from the keychain)");
  if (!(a.minutes > 0) || !(a.poll >= 1) || !(a.cap > 0)) throw new Error("--minutes, --poll and --cap must be positive");

  if (a.watch) {
    const out = outDir(a, a.watch);
    emit(`CLOUD watching ${a.watch}: ${consoleUrl(a.watch)}`);
    return finish(key, a.watch, a, out, {});
  }

  const templates = loadTemplates();
  if (a.setup) {
    const ids = await ensureResources(key, templates);
    emit(`SETUP done: agent ${ids.agent.id} version ${ids.agent.version}, environment ${ids.environment.id} (${STATE})`);
    return;
  }

  if (!a.repo) throw new Error("--repo <owner/name> is required");
  if (!Number.isInteger(a.hunters) || a.hunters < 3 || a.hunters > 5) throw new Error("--hunters must be 3, 4 or 5");
  if (!["high", "xhigh"].includes(a.effort)) throw new Error("--effort must be high or xhigh");
  if (!Number.isInteger(a.iterations) || a.iterations < 1 || a.iterations > 20) throw new Error("--iterations must be 1-20");
  if (!(a.budget > 0)) throw new Error("--budget must be positive");
  if (!a.dryRun && ledger.spent + a.budget > a.cap) {
    console.log(`REFUSED: ${usd(ledger.spent)} already spent, this hunt could add ${usd(a.budget)}, cap is ${usd(a.cap)}. Lower --budget or raise --cap.`);
    process.exitCode = 3;
    return;
  }

  const repo = normalizeRepo(a.repo);
  const issue = a.issueText ?? (a.issue ? fs.readFileSync(expandHome(a.issue), "utf8") : null);
  if (issue !== null && !issue.trim()) throw new Error("the issue is empty");
  const target = await resolveCommit(repo, { commit: a.commit, pr: a.pr, ref: a.ref });
  const also = [];
  for (const spec of a.also) {
    const r = await resolveAlso(spec, repo);
    if (also.some((x) => x.name.toLowerCase() === r.name.toLowerCase())) throw new Error(`two --also repositories are named ${r.name}`);
    also.push(r);
  }
  const alsoText = also.map((r) => ` + ${r.repo}@${r.sha.slice(0, 12)}`).join("");
  const state = readState();

  const overrideEffort = a.effort !== templates.agent.model?.effort;
  const agentRef = (id, version) => overrideEffort
    ? { type: "agent_with_overrides", id, version, model: { id: templates.agent.model.id, effort: a.effort } }
    : { type: "agent", id, version };
  const subject = issue ? issue.split("\n").find((l) => l.trim()) : a.scope || "whole repository";
  const request = {
    agent: agentRef(state.agent?.id || "<agent id from setup>", state.agent?.version || 1),
    environment_id: state.environment?.id || "<environment id from setup>",
    title: oneLine(`hunt ${repo}@${target.sha.slice(0, 7)}${also.length ? ` +${also.length}` : ""}: ${subject}`, 120),
    budget: { type: "limit", max_list_cost: { amount: String(Math.round(a.budget * 100)), currency: "USD" } },
    initial_events: [{
      type: "user.define_outcome",
      description: describe({ repo, target, also, hunters: a.hunters, issue, scope: a.scope }),
      rubric: { type: "text", content: rubric(a.extraRubric) },
      max_iterations: a.iterations,
    }],
  };

  if (a.dryRun) {
    const pending = [
      state.environment?.hash === templates.envHash ? null : "environment",
      state.agent?.hash === templates.agentHash ? null : "agent",
    ].filter(Boolean);
    console.log(JSON.stringify(request, null, 2));
    console.log(`DRY RUN: ${repo}@${target.sha.slice(0, 12)}${target.pr ? ` (PR #${target.pr})` : ""}${alsoText}, ${a.hunters} hunters, effort ${a.effort}, budget ${usd(a.budget)}, ledger ${usd(ledger.spent)}/${usd(a.cap)}${pending.length ? `; a real run first creates or updates the ${pending.join(" and ")}` : ""}. Nothing was sent to Anthropic.`);
    return;
  }

  const ids = await ensureResources(key, templates);
  request.agent = agentRef(ids.agent.id, ids.agent.version);
  request.environment_id = ids.environment.id;

  const created = await apiJson(key, "POST", "/sessions", request);
  const out = outDir(a, created.id);
  if (issue) fs.writeFileSync(path.join(out, "issue.md"), issue);
  fs.writeFileSync(path.join(out, "request.json"), `${JSON.stringify(request, null, 2)}\n`);
  emit(`CLOUD ${created.id} started: ${repo}@${target.sha.slice(0, 12)}${target.pr ? ` (PR #${target.pr})` : ""}${alsoText}, ${a.hunters} hunters, effort ${a.effort}, budget ${usd(a.budget)}, out ${out}`);
  emit(`CLOUD console: ${consoleUrl(created.id)}`);
  return finish(key, created.id, a, out, { repo, sha: target.sha, ...(also.length ? { also: also.map((r) => `${r.repo}@${r.sha}`) } : {}) });
}

main().catch((e) => {
  emit(`ERROR ${oneLine(e.message, 500)}`);
  process.exitCode = 1;
});
