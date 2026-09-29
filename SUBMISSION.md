# gib-gate — Gibwork Hackathon Submission Pack (copy-paste)

Repo (public): https://github.com/urelkdubdqwr/gib-gate
Form: https://docs.google.com/forms/d/e/1FAIpQLSejpks7hItR6zBUXpdrwgUDrwvEcmnJj6nlFbUXKIyNkVVfag/viewform

════════════════════════════════════════════════════════════
⚠️  GERBANG MANUSIA — LU YANG HARUS (sebelum/ketika submit):
  1. Join Discord https://discord.gg/2577tTsRt  →  minta role "Hackathon"
  2. Hadir ≥2 sesi hackathon di Discord (brief mewajibkan)
  3. Submit via Google Form di atas
  (field `requiredDiscordRoleIds` = 1546941199859060768 itu hard gate —
   tool gue sendiri nge-flag ini: verdict NO-GO sampe role-nya dikasih)
════════════════════════════════════════════════════════════

## FIELD 1 — GitHub repository URL
https://github.com/urelkdubdqwr/gib-gate

## FIELD 2 — Short written summary (use case, value, toolset used)
gib-gate is a non-web terminal CLI + MCP server that answers one question every Gibwork developer asks too late: "Am I even allowed to submit this bounty, and is my submission complete before I hit Submit?"

Every existing Gibwork tool discovers/ranks/watches bounties. gib-gate is different — it surfaces the HIDDEN submission gates that the Gibwork UI buries in API fields (requiredDiscordRoleIds / allowOnlyDiscordGuildSubmissions, creditCostPerSubmission, maxSubmissions, minSubmissionAmount, Twitter/verification flags, deadline) BEFORE you write code, then audits your repo against the bounty's own "What to Submit" checklist so every submission is complete on the first try. It returns a GO / CONDITIONAL / NOT-READY / NO-GO verdict plus a concrete fix-list.

Value: prevents wasted hours on bounties you can't submit to, and prevents burned submission attempts (each attempt costs credits) on incomplete entries. Non-web by design: it runs in a terminal or as an MCP stdio server inside AI coding agents (Claude / Cursor / Codex).

Gibwork toolset used (core): @gibwork/sdk (GibworkClient.tasks.listAvailable / .get) as the authenticated data layer, @gibwork/mcp installed alongside, plus the public task API (gib.work/api/tasks/{id}) as the no-auth fallback. gib-gate also ships its own read-only MCP server (gib_submission_gate, gib_submission_audit, gib_list_bounties) so agents can call the gate/audit directly.

## FIELD 3 — Setup + usage instructions (install, env, commands, sample I/O)
Install (Node.js >= 18):
  git clone https://github.com/urelkdubdqwr/gib-gate.git
  cd gib-gate
  npm install
  npm link        # optional, puts gib-gate on PATH

Environment variables (optional):
  GIBWORK_KEYPAIR_PATH  — Solana keypair JSON for wallet-authenticated @gibwork/sdk calls. Omit to run read-only (no wallet/funds needed).

Commands:
  gib-gate gate  <taskId>               # hidden submission gates + competition + verdict
  gib-gate audit <taskId> --repo <path>  # gates + repo readiness vs "What to Submit"
  gib-gate list   [--limit N]            # open bounties via @gibwork/sdk
  gib-gate doctor                        # node / signer / SDK health

Sample input/output (real run against this hackathon bounty):
  $ gib-gate gate 1052f22d-3f87-4b1d-b0d7-71a60679e7fa
  🎯 Gibwork Developer Hackathon Bounty
     payout: 1000 USD (USDC)  ·  min payout: 50  ·  credits/attempt: 1
     competition: 5 pending / 0 approved / 5 total
  🚦 HIDDEN SUBMISSION GATES
    ⛔ [BLOCKER] Discord guild/role required: guild 1004566368475164683 + role(s) 1546941199859060768
    ⚠️ [WARN] Each attempt costs credits: 1 credit per submission
    ℹ️ [INFO] Deadline: 2026-10-30T04:00:00.000Z (30 days left)
  🚦 VERDICT: NO-GO — Discord guild/role required

Tests:  node --test   (4/4 pass)

MCP (agents): add { "mcpServers": { "gib-gate": { "command": "node", "args": ["/abs/path/gib-gate/src/mcp.js"] } } }, then call gib_submission_gate / gib_submission_audit / gib_list_bounties.

## FIELD 4 — Screen recording / demo video URL
https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/demo-gate.mp4
(13s screen recording of the gate workflow — command typed, hidden gates revealed, NO-GO verdict)

## FIELD 5 — Screenshots of the project running
https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/screenshot-gate.png   (gate: hidden submission gates)
https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/screenshot-audit.png  (audit: submission readiness 8/8)

## FIELD 6 — Exported deliverables / artifacts
Raw captured output (terminal exports):
  https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/gate.txt
  https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/audit.txt
  https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/list.txt
  https://github.com/urelkdubdqwr/gib-gate/blob/master/demo/doctor.txt

## Limitations (honest, include if the form asks)
- Read-only: gib-gate tells you WHETHER to submit; it never submits or moves funds.
- Repo audit checks objective file/README deliverables; human-judged demo quality is a manual item.
