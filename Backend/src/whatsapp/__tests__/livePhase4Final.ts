// ============================================================
// Phase 4 finalization — live send of the 4 approved templates
// ============================================================
// Sends exactly ONE real message per approved template to TEST_DESTINATION,
// then polls this backend's own /api/whatsapp/status/:messageId (fed by the
// Gupshup delivery-status webhook) until each reaches a terminal state or a
// timeout — so a 202 "submitted" from Gupshup is never reported as success.
// Run: npx ts-node src/whatsapp/__tests__/livePhase4Final.ts
// Requires the backend to be running locally AND its webhook URL configured
// in Gupshup to point at the current public tunnel.
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import {
  sendInstallmentDueReminder,
  sendPaymentOverdueReminder,
  sendPartialPaymentNotice,
  sendAuctionScheduledNotice,
} from '../templates';

const TEST_DEST = process.env.TEST_DESTINATION || '';
const STATUS_BASE = process.env.LOCAL_STATUS_BASE || 'http://localhost:5001';

interface Attempt {
  name: string;
  templateEnv: string;
  send: () => Promise<any>;
}

const attempts: Attempt[] = [
  {
    name: 'vsyk_installment_due',
    templateEnv: 'GUPSHUP_TEMPLATE_INSTALLMENT_DUE',
    send: () => sendInstallmentDueReminder(TEST_DEST, 'Ravi', 'Cycle 1', '3', '50,000', '5,000', '45,000', '24 Aug 2026'),
  },
  {
    name: 'vsyk_payment_overdue',
    templateEnv: 'GUPSHUP_TEMPLATE_PAYMENT_OVERDUE',
    send: () => sendPaymentOverdueReminder(TEST_DEST, 'Ravi', '45,000', 'Cycle 1', '10 Aug 2026'),
  },
  {
    name: 'vsyk_partial_payment',
    templateEnv: 'GUPSHUP_TEMPLATE_PARTIAL_PAYMENT',
    send: () => sendPartialPaymentNotice(TEST_DEST, 'Ravi', '15,000', 'Cycle 1', '30,000'),
  },
  {
    name: 'vsyk_auction_scheduled',
    templateEnv: 'GUPSHUP_TEMPLATE_AUCTION_SCHEDULED',
    send: () => sendAuctionScheduledNotice(TEST_DEST, 'Ravi', 'Cycle 1', '3', '25 Aug 2026', '6:00 PM', '2,50,000'),
  },
];

async function pollStatus(messageId: string, timeoutMs = 30000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${STATUS_BASE}/api/whatsapp/status/${messageId}`, {
        headers: { 'x-admin-secret': process.env.ADMIN_API_SECRET || '' },
      });
      const json: any = await res.json();
      if (json && json.status && json.status !== 'unknown') return json;
    } catch {
      // backend not reachable yet — keep trying
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'unknown', note: 'no webhook callback received within timeout' };
}

async function main() {
  if (!TEST_DEST) {
    console.error('TEST_DESTINATION is required for this live test.');
    process.exit(1);
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(' VSYK · Phase 4 Finalization — 4 approved templates');
  console.log(` Destination: ${TEST_DEST}`);
  console.log('══════════════════════════════════════════════════════════\n');

  const results: any[] = [];

  for (const a of attempts) {
    const templateId = process.env[a.templateEnv] || '';
    console.log(`→ ${a.name}  (${a.templateEnv}=${templateId || 'MISSING'})`);
    const sendRes = await a.send();
    if (!sendRes.success) {
      console.log(`  ❌ send failed: ${sendRes.error}`);
      results.push({ name: a.name, templateId, apiSuccess: false, error: sendRes.error });
      continue;
    }
    console.log(`  ✅ API accepted | messageId=${sendRes.messageId} | http=${sendRes.statusCode}`);
    console.log('  ⏳ waiting for webhook delivery-status callback...');
    const status = sendRes.messageId ? await pollStatus(sendRes.messageId) : { status: 'unknown', note: 'no messageId returned' };
    console.log(`  📬 webhook status: ${JSON.stringify(status)}`);
    results.push({ name: a.name, templateId, apiSuccess: true, messageId: sendRes.messageId, webhookStatus: status });
    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('══════════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`${r.name}: apiSuccess=${r.apiSuccess} messageId=${r.messageId || '-'} webhookStatus=${r.webhookStatus?.status || '-'}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
