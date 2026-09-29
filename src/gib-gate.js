// gib-gate core: fetch Gibwork bounty → surface hidden submission gates → audit a repo
// against the bounty's "What to Submit" checklist before you burn a submission attempt.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ---- signer (throwaway keypair; or a funded one via GIBWORK_KEYPAIR_PATH for submit/pay) ----
export function buildSigner() {
  const { Keypair } = require('@solana/web3.js');
  const nacl = require('tweetnacl');
  const fs = require('fs');
  let kp;
  const kpPath = process.env.GIBWORK_KEYPAIR_PATH;
  if (kpPath && fs.existsSync(kpPath)) {
    kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))));
  } else {
    kp = Keypair.generate(); // no funds — signs auth challenges only
  }
  return {
    pubkey: kp.publicKey.toBase58(),
    signer: {
      publicKey: { toBase58: () => kp.publicKey.toBase58(), toBuffer: () => kp.publicKey.toBuffer() },
      signMessage: async (msg) => nacl.sign.detached(new Uint8Array(msg), kp.secretKey),
      signTransaction: async (tx) => tx,
    },
  };
}

const DETAIL_URL = (id) => `https://gib.work/api/tasks/${id}`;

// ---- fetch one task: public API (no auth) is the reliable read surface the web app uses ----
export async function fetchTask(idOrSlug) {
  const res = await fetch(DETAIL_URL(idOrSlug), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`gibwork task fetch failed: HTTP ${res.status}`);
  return res.json();
}

// ---- fetch open bounties via the official @gibwork/sdk (genuine SDK call) ----
export async function listAvailableViaSdk(limit = 15) {
  const { GibworkClient } = await import('@gibwork/sdk');
  const { signer } = buildSigner();
  const c = new GibworkClient({ signer });
  return c.tasks.listAvailable({ limit });
}

// ---- HTML helpers ----
const stripTags = (h) => (h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{2,}/g, '\n').trim();
function sectionItems(html, headingRe) {
  // find heading, capture following <li>…</li> bullets until the next heading
  const txt = html || '';
  const start = txt.search(headingRe);
  if (start < 0) return [];
  const rest = txt.slice(start);
  const nextHead = rest.slice(1).search(/<(h[1-6]|strong|p>\s*<strong)[^>]*>\s*(Requirements|What to Submit|How to start|Overview|Bounty Description)/i);
  const seg = nextHead > 0 ? rest.slice(0, nextHead + 1) : rest;
  const lis = [...seg.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1]).trim()).filter(Boolean);
  return lis;
}

// ---- hidden submission gates ----
export function extractGates(t) {
  const gates = [];
  const days = t.deadline ? Math.round((new Date(t.deadline) - Date.now()) / 86400000) : null;
  if (t.allowOnlyDiscordGuildSubmissions || (t.requiredDiscordRoleIds && t.requiredDiscordRoleIds.length)) {
    gates.push({ id: 'discord_role', severity: 'BLOCKER', label: 'Discord guild/role required', detail: `guild ${t.requiredDiscordGuildId || t.requiredDiscordGuildName || '?'} + role(s) ${(t.requiredDiscordRoleIds || []).join(', ') || '?'} — must join + be granted the role before submitting` });
  }
  if (t.allowOnlyVerifiedSubmissions) gates.push({ id: 'verified_only', severity: 'BLOCKER', label: 'Verified account only', detail: 'only verified Gibwork accounts may submit' });
  if (t.allowOnlyVerifiedTwitterAccountSubmissions || t.minTwitterFollowers || t.minTweetLikes || t.minTweetViews) {
    gates.push({ id: 'twitter', severity: 'BLOCKER', label: 'Twitter/X requirements', detail: `verified=${!!t.allowOnlyVerifiedTwitterAccountSubmissions}, minFollowers=${t.minTwitterFollowers || 0}, minLikes=${t.minTweetLikes || 0}, minViews=${t.minTweetViews || 0}` });
  }
  if (t.creditCostPerSubmission) gates.push({ id: 'credit_cost', severity: 'WARN', label: 'Each attempt costs credits', detail: `${t.creditCostPerSubmission} credit per submission — incomplete entries burn credits` });
  if (t.maxSubmissions != null) gates.push({ id: 'max_submissions', severity: 'WARN', label: 'Submission cap', detail: `max ${t.maxSubmissions} submissions${t.taskSubmissionsPendingCount ? ` (${t.taskSubmissionsPendingCount} already pending)` : ''}` });
  if (days != null) gates.push({ id: 'deadline', severity: days < 3 ? 'BLOCKER' : 'INFO', label: 'Deadline', detail: `${t.deadline} (${days} days left)` });
  if (t.status && t.status !== 'CREATED') gates.push({ id: 'status', severity: 'WARN', label: 'Status', detail: t.status });
  if (t.isOpen === false) gates.push({ id: 'closed', severity: 'BLOCKER', label: 'Bounty closed', detail: 'isOpen=false' });
  return gates;
}

export function competition(t) {
  return { approved: t.taskSubmissionsApprovedCount || 0, pending: t.taskSubmissionsPendingCount || 0, rejected: t.taskSubmissionsRejectedCount || 0, total: (t.taskSubmissionsApprovedCount || 0) + (t.taskSubmissionsPendingCount || 0) + (t.taskSubmissionsRejectedCount || 0) };
}

// ---- bounty "What to Submit" checklist ----
export function extractChecklist(t) {
  const content = t.content || '';
  const submit = sectionItems(content, /What to Submit/i);
  const reqs = sectionItems(content, /Requirements/i);
  return { submit, requirements: reqs };
}

// ---- audit a local repo against the checklist (verifiable, objective checks) ----
export function auditRepo(repoPath, checklist) {
  const fs = require('fs');
  const path = require('path');
  const checks = [];
  const has = (p) => fs.existsSync(path.join(repoPath, p));
  const readme = has('README.md') ? fs.readFileSync(path.join(repoPath, 'README.md'), 'utf8') : '';
  const readmeLc = readme.toLowerCase();
  const allFiles = (() => { try { return fs.readdirSync(repoPath, { withFileTypes: true }); } catch { return []; } })();
  const names = allFiles.map((e) => e.name);

  checks.push({ item: 'Public GitHub repo with source + README', pass: has('README.md') && names.some((n) => n === 'src' || n === 'lib' || n === 'package.json' || n.endsWith('.js') || n.endsWith('.py') || n.endsWith('.ts')), fix: 'Add README.md + source code' });
  checks.push({ item: 'Written summary (use case, value, toolset used)', pass: /use case|what it does|overview|about/i.test(readmeLc) && /gibwork|sdk|cli|mcp/i.test(readmeLc), fix: 'Describe the use case + which Gibwork toolset (SDK/CLI/MCP) it uses' });
  checks.push({ item: 'Setup + install instructions', pass: /install|setup|getting started|quick start/i.test(readmeLc), fix: 'Add an Install/Setup section' });
  checks.push({ item: 'Environment variables documented', pass: /\.env|environment variable|env var|GIBWORK_/i.test(readmeLc) || has('.env.example') || has('.env.sample'), fix: 'Document env vars or ship .env.example' });
  checks.push({ item: 'Commands to run / sample I/O', pass: /usage|example|```|npm run|node |npx /i.test(readmeLc), fix: 'Add usage commands + sample input/output' });
  checks.push({ item: 'License', pass: has('LICENSE') || has('LICENSE.md') || has('LICENSE.txt'), fix: 'Add a LICENSE file' });
  const hasDemo = names.some((n) => /^demo/i.test(n) || /\.(mp4|mov|webm)$/i.test(n)) || /demo|video|record/i.test(readmeLc);
  checks.push({ item: 'Demo video / recording referenced', pass: hasDemo, fix: 'Record a short demo + link it in README' });
  const hasShot = names.some((n) => /screenshot|\.png|\.jpg|\.gif/i.test(n)) || /screenshot/i.test(readmeLc);
  checks.push({ item: 'Screenshots (terminal/logs/agent output)', pass: hasShot, fix: 'Add screenshots of the tool running' });

  // include any explicit "What to Submit" bullets not covered above as manual items
  for (const s of checklist.submit || []) checks.push({ item: s, pass: null, fix: 'Manual check — confirm this deliverable is in the repo/submission' });

  const auto = checks.filter((c) => c.pass !== null);
  const passed = auto.filter((c) => c.pass).length;
  return { checks, score: auto.length ? Math.round((passed / auto.length) * 100) : 0, passed, totalAuto: auto.length, blockers: (checklist.submit || []).length };
}

export function verdict(gates, audit) {
  const blockers = gates.filter((g) => g.severity === 'BLOCKER');
  const missing = audit.checks.filter((c) => c.pass === false);
  if (blockers.some((g) => g.id === 'closed' || g.id === 'discord_role')) return { level: 'NO-GO', reason: blockers.map((b) => b.label).join('; ') };
  if (missing.length > 3) return { level: 'NOT-READY', reason: `${missing.length} deliverables missing (${audit.score}% ready)` };
  if (blockers.length) return { level: 'CONDITIONAL', reason: blockers.map((b) => b.label).join('; ') };
  return { level: 'GO', reason: `submission-ready (${audit.score}%)` };
}
