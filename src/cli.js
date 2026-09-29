#!/usr/bin/env node
// gib-gate CLI — Gibwork Submission Gate & Readiness Auditor
import { fetchTask, listAvailableViaSdk, extractGates, extractChecklist, auditRepo, competition, verdict, buildSigner } from './gib-gate.js';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(n);

function fmtGates(gates) {
  const icon = { BLOCKER: '⛔', WARN: '⚠️', INFO: 'ℹ️' };
  return gates.map((g) => `  ${icon[g.severity]} [${g.severity}] ${g.label}: ${g.detail}`).join('\n');
}

async function gate(id) {
  const t = await fetchTask(id);
  const gates = extractGates(t);
  const comp = competition(t);
  const v = verdict(gates, { checks: [], score: 100 });
  console.log(`\n🎯 ${t.title}`);
  console.log(`   payout: ${t.health?.metrics?.bountyUsd ?? '?'} USD (${t.asset?.symbol || '?'})  ·  min payout: ${t.minSubmissionAmount ?? '?'}  ·  credits/attempt: ${t.creditCostPerSubmission ?? 0}`);
  console.log(`   competition: ${comp.pending} pending / ${comp.approved} approved / ${comp.total} total`);
  console.log(`\n🚦 HIDDEN SUBMISSION GATES`);
  console.log(fmtGates(gates));
  console.log(`\n🚦 VERDICT: ${v.level} — ${v.reason}\n`);
  return t;
}

async function audit(id) {
  const repo = flag('--repo') || flag('-r') || '.';
  const t = await fetchTask(id);
  const gates = extractGates(t);
  const checklist = extractChecklist(t);
  const a = auditRepo(repo, checklist);
  const v = verdict(gates, a);
  console.log(`\n🎯 ${t.title}`);
  console.log(`\n🚦 HIDDEN SUBMISSION GATES`);
  console.log(fmtGates(gates));
  console.log(`\n📋 BOUNTY "WHAT TO SUBMIT" CHECKLIST (${checklist.submit.length} items)`);
  for (const s of checklist.submit) console.log(`  • ${s}`);
  console.log(`\n📁 REPO READINESS — ${a.passed}/${a.totalAuto} automated checks passed (${a.score}%)  [repo: ${repo}]`);
  for (const c of a.checks) {
    const mark = c.pass === null ? '🔎' : c.pass ? '✅' : '❌';
    console.log(`  ${mark} ${c.item}${c.pass === false ? `\n      ↳ fix: ${c.fix}` : ''}`);
  }
  console.log(`\n🚦 VERDICT: ${v.level} — ${v.reason}`);
  const missing = a.checks.filter((c) => c.pass === false);
  if (missing.length) { console.log(`\n🔧 BEFORE YOU SUBMIT — fix these:`); for (const m of missing) console.log(`  • ${m.item} — ${m.fix}`); }
  console.log('');
  return { t, gates, checklist, a, v };
}

async function list() {
  const limit = parseInt(flag('--limit') || '15', 10);
  const r = await listAvailableViaSdk(limit);
  const rows = r.results || r;
  console.log(`\n📌 Open Gibwork bounties (via @gibwork/sdk tasks.listAvailable — ${rows.length}):\n`);
  for (const t of rows) {
    const usd = t.health?.metrics?.bountyUsd ?? t.remainingAmount ?? '?';
    console.log(`  • ${t.title} — ${usd} USD  [${(t.tags || []).join(',')}]  ${t.id}`);
  }
  console.log('');
}

function pack(id) {
  // printed after audit in the same run for copy-paste
}

async function main() {
  if (cmd === 'gate') return gate(args[1]);
  if (cmd === 'audit') return audit(args[1]);
  if (cmd === 'list') return list();
  if (cmd === 'doctor') {
    const { pubkey } = buildSigner();
    console.log(`node ${process.version} · signer ${pubkey} · SDK/MCP installed`);
    try { const r = await listAvailableViaSdk(1); console.log(`@gibwork/sdk listAvailable: OK (${(r.results || r).length} row)`); }
    catch (e) { console.log(`@gibwork/sdk listAvailable: ERR ${e.message}`); }
    return;
  }
  console.log(`gib-gate — Gibwork Submission Gate & Readiness Auditor
Usage:
  gib-gate gate  <taskId>              show hidden submission gates + competition + verdict
  gib-gate audit <taskId> --repo <path> gates + repo readiness vs "What to Submit" checklist
  gib-gate list  [--limit N]           open bounties via @gibwork/sdk
  gib-gate doctor                      health check (node, signer, SDK)`);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
