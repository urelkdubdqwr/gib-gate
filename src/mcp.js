#!/usr/bin/env node
// gib-gate MCP server (stdio) — exposes the gate/audit tools to any MCP client (Claude, Cursor, Codex…)
import { fetchTask, listAvailableViaSdk, extractGates, extractChecklist, auditRepo, competition, verdict, buildSigner } from './gib-gate.js';

const TOOLS = [
  { name: 'gib_submission_gate', description: 'Surface hidden submission gates (Discord role, verified-only, Twitter, credit cost, maxSubmissions, deadline) + competition for a Gibwork bounty before you start work.', inputSchema: { type: 'object', properties: { task_id: { type: 'string', description: 'Gibwork task UUID' } }, required: ['task_id'] } },
  { name: 'gib_submission_audit', description: 'Audit a local repo against the bounty "What to Submit" checklist + gates. Returns pass/fail readiness matrix and a GO / CONDITIONAL / NOT-READY / NO-GO verdict.', inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, repo_path: { type: 'string', description: 'Path to the local repo (default .)' } }, required: ['task_id'] } },
  { name: 'gib_list_bounties', description: 'List open Gibwork bounties via the official @gibwork/sdk (tasks.listAvailable).', inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 15 } } } },
];

async function callTool(name, args) {
  if (name === 'gib_submission_gate') {
    const t = await fetchTask(args.task_id); const gates = extractGates(t); const v = verdict(gates, { checks: [], score: 100 });
    return { title: t.title, payoutUsd: t.health?.metrics?.bountyUsd, competition: competition(t), gates, verdict: v };
  }
  if (name === 'gib_submission_audit') {
    const t = await fetchTask(args.task_id); const gates = extractGates(t); const checklist = extractChecklist(t);
    const a = auditRepo(args.repo_path || '.', checklist); const v = verdict(gates, a);
    return { title: t.title, gates, checklist, readiness: a, verdict: v };
  }
  if (name === 'gib_list_bounties') {
    const r = await listAvailableViaSdk(args.limit || 15); return r.results || r;
  }
  throw new Error(`unknown tool ${name}`);
}

let buf = '';
process.stdin.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'gib-gate', version: '1.0.0' } } });
  }
  if (method === 'notifications/initialized') return;
  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }
  if (method === 'tools/call') {
    callTool(params.name, params.arguments || {})
      .then((r) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] } }))
      .catch((e) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `ERROR: ${e.message}` }], isError: true } }));
    return;
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method ${method} not found` } });
}
