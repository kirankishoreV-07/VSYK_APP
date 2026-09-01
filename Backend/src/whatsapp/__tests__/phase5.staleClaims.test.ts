// ============================================================
// Phase 5 — stale notification claim recovery (isolated, no Gupshup calls)
// ============================================================
// Verifies sweepStaleNotificationClaims (proactiveNotifications.ts) only
// clears claims orphaned by a process crash between "claim" and "send"
// (sent_count=0, old) and never touches a genuinely in-flight claim (fresh)
// or a completed send (sent_count>0). Touches only synthetic test keys in
// notification_log — no customer data, no real send attempted.
// Run: npx ts-node src/whatsapp/__tests__/phase5.staleClaims.test.ts
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
import { sweepStaleNotificationClaims } from '../proactiveNotifications';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${extra}`); failed++; }
}

async function main() {
  console.log('🧹 Phase 5 — stale notification claim recovery\n');
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const staleKey = `wa_test_stale_claim:${Date.now()}`;
  const freshKey = `wa_test_fresh_claim:${Date.now()}`;
  const sentKey = `wa_test_sent_claim:${Date.now()}`;
  const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago

  // Clean slate.
  await sb.from('notification_log').delete().in('notification_key', [staleKey, freshKey, sentKey]);

  await sb.from('notification_log').insert([
    { notification_key: staleKey, notification_type: 'wa_test', sent_count: 0, created_at: oldTimestamp },
    { notification_key: freshKey, notification_type: 'wa_test', sent_count: 0 }, // created_at defaults to now
    { notification_key: sentKey, notification_type: 'wa_test', sent_count: 1, created_at: oldTimestamp },
  ]);

  const recovered = await sweepStaleNotificationClaims();
  ok('sweep reports at least the 1 synthetic stale claim recovered', recovered >= 1, String(recovered));

  const { data: staleRow } = await sb.from('notification_log').select('id').eq('notification_key', staleKey);
  ok('orphaned claim (sent_count=0, old) is removed', (staleRow || []).length === 0);

  const { data: freshRow } = await sb.from('notification_log').select('id').eq('notification_key', freshKey);
  ok('genuinely in-flight claim (sent_count=0, fresh) is NOT touched', (freshRow || []).length === 1);

  const { data: sentRow } = await sb.from('notification_log').select('id').eq('notification_key', sentKey);
  ok('completed send (sent_count>0, old) is NEVER swept — permanent dedup preserved', (sentRow || []).length === 1);

  // Cleanup.
  await sb.from('notification_log').delete().in('notification_key', [staleKey, freshKey, sentKey]);

  console.log(`\n🏁 Phase 5 stale-claim Summary: ${passed} Passed, ${failed} Failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
