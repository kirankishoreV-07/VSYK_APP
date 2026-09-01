// ============================================================
// Phase 3 — payment application logic (offline, deterministic)
// ============================================================
// Run: npx ts-node src/payments/__tests__/payments.test.ts
// ============================================================

import assert from 'node:assert';
import { applyPayment } from '../payments';

let passed = 0, failed = 0;
function t(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e: any) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

console.log('💳 Phase 3 — applyPayment logic\n');

// Amounts in paise. Due = ₹1000 = 100000 paise.
const DUE = 100000;

t('full payment in one shot → fully paid, remaining 0', () => {
  const r = applyPayment(DUE, 0, 100000);
  assert.strictEqual(r.appliedAmount, 100000);
  assert.strictEqual(r.newPaidAmount, 100000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.fullyPaid, true);
  assert.strictEqual(r.isPartial, false);
});

t('single partial → not fully paid, correct remaining', () => {
  const r = applyPayment(DUE, 0, 40000);
  assert.strictEqual(r.appliedAmount, 40000);
  assert.strictEqual(r.remaining, 60000);
  assert.strictEqual(r.fullyPaid, false);
  assert.strictEqual(r.isPartial, true);
});

t('second partial that completes → fully paid', () => {
  const r = applyPayment(DUE, 40000, 60000);
  assert.strictEqual(r.newPaidAmount, 100000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.fullyPaid, true);
  assert.strictEqual(r.isPartial, false);
});

t('₹1 remaining is still partial (not fully paid)', () => {
  const r = applyPayment(DUE, 99900, 0); // nothing applied, ₹1 short
  assert.strictEqual(r.remaining, 100);
  assert.strictEqual(r.fullyPaid, false);
});

t('paying exactly the ₹1 remainder → fully paid', () => {
  const r = applyPayment(DUE, 99900, 100);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.fullyPaid, true);
});

t('overpayment is capped; remaining never negative; overpaid reported', () => {
  const r = applyPayment(DUE, 80000, 50000); // owed 20000, paid 50000
  assert.strictEqual(r.appliedAmount, 20000);
  assert.strictEqual(r.newPaidAmount, 100000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.fullyPaid, true);
  assert.strictEqual(r.overpaid, 30000);
});

t('payment against an already fully-paid schedule applies nothing', () => {
  const r = applyPayment(DUE, 100000, 50000);
  assert.strictEqual(r.appliedAmount, 0);
  assert.strictEqual(r.newPaidAmount, 100000);
  assert.strictEqual(r.remaining, 0);
  assert.strictEqual(r.isPartial, false);
  assert.strictEqual(r.overpaid, 50000);
});

t('zero incoming (duplicate/no-op) changes nothing', () => {
  const r = applyPayment(DUE, 40000, 0);
  assert.strictEqual(r.appliedAmount, 0);
  assert.strictEqual(r.newPaidAmount, 40000);
  assert.strictEqual(r.remaining, 60000);
  assert.strictEqual(r.isPartial, false); // nothing applied ⇒ not a new partial event
});

t('negative/garbage inputs are clamped safely', () => {
  const r = applyPayment(DUE, -5, -100);
  assert.strictEqual(r.newPaidAmount, 0);
  assert.strictEqual(r.remaining, DUE);
});

t('three partials sum exactly to due', () => {
  let paid = 0;
  for (const p of [30000, 30000, 40000]) paid = applyPayment(DUE, paid, p).newPaidAmount;
  assert.strictEqual(paid, 100000);
  assert.strictEqual(applyPayment(DUE, paid, 0).fullyPaid, true);
});

console.log(`\n🏁 Phase 3 Summary: ${passed} Passed, ${failed} Failed\n`);
process.exit(failed > 0 ? 1 : 0);
