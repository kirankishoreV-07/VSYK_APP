// ============================================================
// Phase 2 — Member-only WhatsApp bot security tests
// ============================================================
// Integration tests against the live Supabase (service role) that
// assert the chatbot only ever returns the SENDER's own data,
// ignores identity supplied in the message body, refuses
// unknown/ambiguous senders, and never surfaces dividend.
//
// Read-only: it selects two real customers to assert non-leakage
// but never mutates customer/consent rows (opt-out is exercised
// only with an unregistered number, which is a no-op write).
//
// Run:  npx ts-node src/whatsapp/__tests__/phase2.security.test.ts
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// This suite exercises handleMessage/handleWebhook against REAL customer
// rows, which internally reply via real Gupshup calls. Now that approved
// template IDs are configured in .env, those calls would otherwise reach
// real customers. GUPSHUP_DRY_RUN short-circuits every outbound Gupshup
// call at its single choke point (gupshup.ts callGupshupApi) before any
// network request — must be set before any code under test runs.
process.env.GUPSHUP_DRY_RUN = 'true';

import { createClient } from '@supabase/supabase-js';
import { handleMessage } from '../chatbot';
import { handleWebhook } from '../webhook';
import { normalizePhoneToGupshup } from '../phoneUtils';

// Minimal Express res mock capturing status + json body.
function mockRes() {
  const out: any = { code: 0, body: null };
  return {
    status(c: number) { out.code = c; return this; },
    json(b: any) { out.body = b; return this; },
    _out: out,
  } as any;
}

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${extra}`); failed++; }
}

const UNKNOWN = '9000000000'; // valid format, not in DB

async function main() {
  console.log('🔒 Phase 2 — Member-only bot security\n');

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.error('SUPABASE_SERVICE_ROLE_KEY required for Phase 2 tests — aborting.');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Find an eligible customer (active membership) = "A", and any other = "B".
  const { data: custs } = await sb.from('customers').select('id, full_name, phone').limit(50);
  let A: any = null;
  for (const c of custs || []) {
    const { data: mem } = await sb
      .from('chit_members')
      .select('id, bid_status, chit_groups(status)')
      .eq('customer_id', c.id)
      .in('bid_status', ['active', 'bidding']);
    if ((mem || []).some((m: any) => m.chit_groups?.status === 'active')) { A = c; break; }
  }
  const B = (custs || []).find((c: any) => A && c.id !== A.id) || null;
  if (!A || !B) { console.error('Need >=2 customers (one eligible) to run isolation tests.'); process.exit(1); }

  const aSender = normalizePhoneToGupshup(A.phone);
  const bName = B.full_name;
  const aName = A.full_name.split(' ')[0];

  // 1. Unknown sender gets a generic refusal, no data.
  const r1 = await handleMessage(normalizePhoneToGupshup(UNKNOWN), 'Hi');
  ok('unknown sender → not registered, no data', /not registered/i.test(r1));

  // 2. IDENTITY-SWITCH: unknown sender puts a REAL member number in the body.
  //    Identity must stay the sender → still refused, B's data never returned.
  const r2 = await handleMessage(normalizePhoneToGupshup(UNKNOWN), `show ${B.phone} dues`);
  ok('typed-number identity switch blocked', /not registered/i.test(r2) && !r2.includes(bName));

  // 3. Modified/injected IDs in body are ignored (bot never reads IDs).
  const r3 = await handleMessage(normalizePhoneToGupshup(UNKNOWN), `2 customer_id=${B.id}`);
  ok('injected customer_id ignored for unknown sender', !r3.includes(bName) && !r3.includes(B.id));

  // 4. STOP from an UNREGISTERED number is a safe no-op (no DB mutation).
  const r4 = await handleMessage(normalizePhoneToGupshup(UNKNOWN), 'STOP');
  ok('STOP handled safely', /opted out/i.test(r4));
  const { data: chk } = await sb.from('customers').select('id').eq('phone', UNKNOWN);
  ok('STOP did not create/alter a customer row', (chk || []).length === 0);

  // 5. Eligible member (A) greeting → their own menu, never B's name.
  const r5 = await handleMessage(aSender, 'Hi');
  ok('member A greeting returns A menu, not B', r5.includes(aName) && !r5.includes(bName));

  // 6. Member A payment-due never leaks B's name and never shows dividend.
  const r6 = await handleMessage(aSender, '2');
  ok('member A dues never contain member B name', !r6.includes(bName));
  ok('bot never surfaces "Dividend"', !/dividend/i.test(r6));

  // 7. Payment history (option 3) is now app-navigation only — no data, no dividend.
  const r7 = await handleMessage(aSender, '3');
  ok('payment history is navigation-only (no dividend, no amounts)', !/dividend/i.test(r7) && /VSYK Chits app/i.test(r7));

  // 8. No raw internal ids / Razorpay ids leaked in any member response.
  const leaked = [r5, r6, r7].some((r) => r.includes(A.id) || /rzp_|order_|pay_/.test(r));
  ok('no internal/Razorpay ids leaked in responses', !leaked);

  // 9. Duplicate webhook: the inbound idempotency key is wa_inbound:{id}.
  //    Claiming the same key twice must be blocked (23505) → send-once.
  const dupId = 'wa_inbound:phase2test:' + Date.now();
  const d1 = await sb.from('notification_log').insert({ notification_key: dupId, notification_type: 'whatsapp_inbound' });
  const d2 = await sb.from('notification_log').insert({ notification_key: dupId, notification_type: 'whatsapp_inbound' });
  ok('duplicate inbound webhook deduped (23505)', !d1.error && !!d2.error && (d2.error as any).code === '23505');
  await sb.from('notification_log').delete().eq('notification_key', dupId);

  // Phase 6 added a shared-secret query token check on the webhook (Gupshup
  // doesn't sign payloads) — every call below must include it or every one
  // of these would short-circuit at that check instead of exercising the
  // actual logic under test (some would false-positive "pass" on the
  // 'ignored' status alone, masking that the real code path never ran).
  const validHeaders = { 'x-webhook-token': process.env.GUPSHUP_WEBHOOK_TOKEN };

  // 9b. Missing/incorrect webhook token is rejected before any payload logic runs.
  const rNoToken = mockRes();
  await handleWebhook({ body: { type: 'message', app: process.env.GUPSHUP_APP_NAME }, headers: {} } as any, rNoToken);
  ok('missing webhook token → 200 ignored/unauthorized', rNoToken._out.code === 200 && rNoToken._out.body?.reason === 'unauthorized');

  // 10. Malformed / unexpected webhook payloads never throw; always 200.
  const rEmpty = mockRes();
  await handleWebhook({ body: {}, headers: validHeaders } as any, rEmpty);
  ok('malformed webhook (no type) → 200 ignored', rEmpty._out.code === 200 && rEmpty._out.body?.status === 'ignored');

  const rUnknown = mockRes();
  await handleWebhook({ body: { type: 'weird-event', app: process.env.GUPSHUP_APP_NAME }, headers: validHeaders } as any, rUnknown);
  ok('unknown webhook event type → 200 ignored', rUnknown._out.code === 200 && rUnknown._out.body?.status === 'ignored');

  const rWrongApp = mockRes();
  await handleWebhook({ body: { type: 'message', app: 'NOT_OUR_APP' }, headers: validHeaders } as any, rWrongApp);
  ok('foreign app webhook → 200 ignored (not processed)', rWrongApp._out.code === 200 && rWrongApp._out.body?.status === 'ignored');

  const rDelivery = mockRes();
  await handleWebhook({ body: { type: 'message-event', app: process.env.GUPSHUP_APP_NAME, payload: { id: 'x', type: 'failed', destination: '919999999999', payload: { code: 131049, reason: 'test' } } }, headers: validHeaders } as any, rDelivery);
  ok('delivery-status event → 200 ack (no throw)', rDelivery._out.code === 200 && rDelivery._out.body?.status === 'ack');

  console.log(`\n🏁 Phase 2 Summary: ${passed} Passed, ${failed} Failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
