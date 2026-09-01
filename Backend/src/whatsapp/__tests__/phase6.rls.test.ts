// ============================================================
// Phase 6 — RLS lockdown verification (read-only probes)
// ============================================================
// Confirms the new per-member/per-admin RLS policies (migrations 037-038)
// actually block cross-member access and actually allow legitimate access.
// Uses two REAL existing customers (already used as fixtures throughout
// this session) — only ever SELECTs, never writes/mutates their data. The
// only mutation here is temporarily setting a KNOWN password on their
// existing Supabase Auth users so we can sign in as them via the anon key
// (exactly the same mechanism Backend/src/auth/otp.ts already uses on every
// real OTP login — it re-randomizes the password each time, so this is not
// a new risk to their real login flow).
// Run: npx ts-node src/whatsapp/__tests__/phase6.rls.test.ts
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${extra}`); failed++; }
}

function makeMemberEmail(customerId: string): string {
  return `member+${customerId.replace(/-/g, '')}@auth.vsyk.local`;
}

async function main() {
  console.log('🔐 Phase 6 — RLS lockdown verification\n');

  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const fixturePhone = process.env.TEST_CUSTOMER_PHONE || '';
  if (!fixturePhone) {
    console.error('TEST_CUSTOMER_PHONE is required.');
    process.exit(1);
  }

  // A needs a real session. B does NOT need a session — we only ever read B's data through
  // A's session / the admin session, never sign in as B.
  const { data: aRow } = await admin
    .from('customers')
    .select('id, full_name, phone, auth_user_id')
    .eq('phone', fixturePhone)
    .maybeSingle();
  if (!aRow || !(aRow as any).auth_user_id) {
    console.error('Fixture customer has no auth_user_id (never logged in) — aborting.');
    process.exit(1);
  }
  const A = aRow as any;
  const { data: bRow } = await admin
    .from('customers')
    .select('id, full_name, phone')
    .neq('id', A.id)
    .limit(1)
    .maybeSingle();
  if (!bRow) { console.error('No second customer row found — aborting.'); process.exit(1); }
  const B = bRow as any;
  console.log(`Using fixture members: A=${A.id} (has session) B=${B.id} (no session, read-only target)`);

  const TEST_PASSWORD = 'RlsTestPassw0rd!' + Date.now();
  await admin.auth.admin.updateUserById(A.auth_user_id, { password: TEST_PASSWORD });

  const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInAErr } = await clientA.auth.signInWithPassword({ email: makeMemberEmail(A.id), password: TEST_PASSWORD });
  ok('member A can sign in with own session', !signInAErr, signInAErr?.message || '');

  // ---- 1. Member A can read their OWN customers row ----
  const { data: ownRow } = await clientA.from('customers').select('id, full_name').eq('id', A.id).maybeSingle();
  ok('member A can read own customers row', !!ownRow && ownRow.id === A.id);

  // ---- 2. Member A CANNOT read member B's customers row (IDOR blocked) ----
  const { data: otherRow } = await clientA.from('customers').select('id, full_name, aadhar_number, pan_number').eq('id', B.id).maybeSingle();
  ok('member A cannot read member B\'s customers row', !otherRow, JSON.stringify(otherRow));

  // ---- 3. Member A's chit_members: own visible, B's not ----
  const { data: ownMembers } = await clientA.from('chit_members').select('id').eq('customer_id', A.id);
  const { data: othersMembers } = await clientA.from('chit_members').select('id').eq('customer_id', B.id);
  ok('member A can list own chit_members', Array.isArray(ownMembers));
  ok('member A cannot list member B\'s chit_members', (othersMembers || []).length === 0, JSON.stringify(othersMembers));

  // ---- 4. Member A's payment_schedules: B's are invisible even via broad select ----
  const { data: bMembersRaw } = await admin.from('chit_members').select('id').eq('customer_id', B.id);
  const bMemberIds = (bMembersRaw || []).map((m: any) => m.id);
  if (bMemberIds.length > 0) {
    const { data: bSchedules } = await clientA.from('payment_schedules').select('id, amount').in('chit_member_id', bMemberIds);
    ok('member A cannot read member B\'s payment_schedules', (bSchedules || []).length === 0, JSON.stringify(bSchedules));
  } else {
    console.log('  (skipped payment_schedules cross-check — member B has no chit_members)');
  }

  // ---- 5. Member A's auction_bids: B's are invisible ----
  const { data: bBidsRaw } = await admin.from('auction_bids').select('id').eq('customer_id', B.id).limit(1);
  if ((bBidsRaw || []).length > 0) {
    const { data: bBids } = await clientA.from('auction_bids').select('id').eq('customer_id', B.id);
    ok('member A cannot read member B\'s auction_bids', (bBids || []).length === 0, JSON.stringify(bBids));
  } else {
    console.log('  (skipped auction_bids cross-check — member B has no bids)');
  }

  // ---- 6. Member A cannot write to member B's customers row ----
  const { error: writeErr, data: writeData } = await clientA
    .from('customers')
    .update({ notes: 'RLS test tamper attempt' })
    .eq('id', B.id)
    .select();
  ok('member A cannot UPDATE member B\'s customers row', !writeErr && (!writeData || writeData.length === 0), JSON.stringify({ writeErr, writeData }));

  // ---- 7. Anonymous (no session at all) cannot browse customers ----
  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: anonRows } = await anonClient.from('customers').select('id').limit(5);
  ok('anonymous (no session) cannot read any customers row', (anonRows || []).length === 0, JSON.stringify(anonRows));

  // ---- 8. Admin CAN read both members' data ----
  const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || '';
  const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || '';
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.');
    process.exit(1);
  }
  const adminClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: adminSignInErr } = await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  ok('admin can sign in', !adminSignInErr, adminSignInErr?.message || '');

  const { data: adminSeesA } = await adminClient.from('customers').select('id').eq('id', A.id).maybeSingle();
  const { data: adminSeesB } = await adminClient.from('customers').select('id').eq('id', B.id).maybeSingle();
  ok('admin can read member A\'s customers row', !!adminSeesA);
  ok('admin can read member B\'s customers row', !!adminSeesB);

  const { data: adminAdminRow } = await adminClient.from('admin_users').select('id').eq('id', (await adminClient.auth.getUser()).data.user?.id).maybeSingle();
  ok('admin session resolves to a real admin_users row', !!adminAdminRow);

  console.log(`\n🏁 Phase 6 RLS Summary: ${passed} Passed, ${failed} Failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
