// ============================
// scripts/smoke-test.js
// Confirms the local API is healthy after `npm start`. Runs a tiny set of
// requests that should all succeed in <1 second on a fresh machine.
//
// Usage (in a second terminal, while server is running):
//   node scripts/smoke-test.js
//
// Cross-platform — uses Node's built-in fetch (Node 18+).
// ============================

const BASE = process.env.PM_BASE_URL || 'http://localhost:3000';

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check('GET /healthz', async () => {
  const r = await fetch(`${BASE}/healthz`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error('payload missing { ok: true }');
});

check('GET /readyz (db responsive)', async () => {
  const r = await fetch(`${BASE}/readyz`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (j.db !== 'up') throw new Error(`db is ${j.db}`);
});

check('GET /api/painters (list, no auth)', async () => {
  const r = await fetch(`${BASE}/api/painters`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j.painters)) throw new Error('painters[] missing');
  if (j.painters.length === 0) throw new Error('painters[] empty — did seed run?');
});

check('POST /api/auth/login (demo admin)', async () => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0244000000', password: 'password123' })
  });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!j.token) throw new Error('no token returned');
  if (j.user?.role !== 'admin') throw new Error(`expected admin role, got ${j.user?.role}`);
});

(async () => {
  console.log(`Smoke test → ${BASE}\n`);
  let pass = 0, fail = 0;
  for (const { name, fn } of checks) {
    process.stdout.write(`  ${name} … `);
    try {
      await fn();
      console.log('OK');
      pass++;
    } catch (e) {
      console.log('FAIL');
      console.log(`    ${e.message}`);
      fail++;
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
