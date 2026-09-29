import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractGates, extractChecklist, auditRepo, verdict } from '../src/gib-gate.js';

const fakeTask = {
  title: 'T', content: '<h2>Requirements</h2><ul><li>Use the SDK</li></ul><h2>What to Submit</h2><ul><li>A repo</li><li>A demo video</li></ul>',
  allowOnlyDiscordGuildSubmissions: true, requiredDiscordGuildId: '1', requiredDiscordRoleIds: ['2'],
  creditCostPerSubmission: 1, maxSubmissions: 3, deadline: new Date(Date.now() + 10 * 864e5).toISOString(),
  taskSubmissionsPendingCount: 4, isOpen: true, status: 'CREATED',
};

test('extractGates surfaces discord role as BLOCKER', () => {
  const g = extractGates(fakeTask);
  assert.ok(g.find((x) => x.id === 'discord_role' && x.severity === 'BLOCKER'));
  assert.ok(g.find((x) => x.id === 'credit_cost'));
  assert.ok(g.find((x) => x.id === 'max_submissions'));
});

test('extractChecklist pulls What to Submit bullets', () => {
  const c = extractChecklist(fakeTask);
  assert.deepEqual(c.submit, ['A repo', 'A demo video']);
  assert.deepEqual(c.requirements, ['Use the SDK']);
});

test('auditRepo scores a bare dir low, verdict is NO-GO due to discord gate', () => {
  const a = auditRepo('/nonexistent', extractChecklist(fakeTask));
  assert.ok(a.score < 50);
  const v = verdict(extractGates(fakeTask), a);
  assert.equal(v.level, 'NO-GO');
});

test('verdict is GO when no blockers and repo ready', () => {
  const ready = { checks: [{ item: 'x', pass: true }], score: 100, passed: 1, totalAuto: 1 };
  assert.equal(verdict([], ready).level, 'GO');
});
