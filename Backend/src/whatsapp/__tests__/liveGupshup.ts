// ============================================================
// Live Gupshup smoke test (manual)
// ============================================================
// Hits the REAL Gupshup API using the credentials in Backend/.env.
// Run with:  npx ts-node src/whatsapp/__tests__/liveGupshup.ts
//
// This sends real messages and may consume wallet balance. It is a
// manual diagnostic, NOT part of the automated unit suite.
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import {
  isGupshupConfigured,
  optInUser,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  checkDeliveryStatus,
} from '../gupshup';
import {
  sendInstallmentDueReminder,
  sendPaymentOverdueReminder,
  sendAuctionScheduledNotice,
  sendOTP,
} from '../templates';

const TEST_DEST = process.env.TEST_DESTINATION || '';

function mark(ok: boolean) {
  return ok ? '✅' : '❌';
}

function line(name: string, res: any) {
  const ok = !!res?.success;
  console.log(
    `${mark(ok)} ${name.padEnd(24)} | success=${ok}` +
      (res?.messageId ? ` | msgId=${res.messageId}` : '') +
      (res?.statusCode ? ` | http=${res.statusCode}` : '') +
      (res?.status ? ` | status=${res.status}` : '') +
      (res?.error ? ` | error="${res.error}"` : ''),
  );
  return ok;
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log(' VSYK · Gupshup Live Smoke Test');
  console.log(` Destination: ${TEST_DEST}`);
  console.log(` App: ${process.env.GUPSHUP_APP_NAME} | AppId: ${process.env.GUPSHUP_APP_ID}`);
  console.log(` Configured: ${isGupshupConfigured()}`);
  console.log('══════════════════════════════════════════════════════════');

  if (!isGupshupConfigured()) {
    console.error('Gupshup is not configured — aborting.');
    process.exit(1);
  }
  if (!TEST_DEST) {
    console.error('TEST_DESTINATION is required for the live smoke test.');
    process.exit(1);
  }

  let lastTextMsgId: string | undefined;

  // 1. Opt-in (required before session messages)
  const optRes = await optInUser(TEST_DEST);
  line('optInUser', optRes);

  // 2. Text message
  const textRes = await sendTextMessage(
    TEST_DEST,
    `VSYK test · plain text · ${new Date().toISOString()}`,
  );
  line('sendTextMessage', textRes);
  lastTextMsgId = textRes.messageId;

  // 3. Media message (public sample image)
  const mediaRes = await sendMediaMessage(
    TEST_DEST,
    'https://www.gupshup.io/developer/docs/bot-platform/images/gupshup-logo.png',
    'image',
    'VSYK test · media caption',
  );
  line('sendMediaMessage', mediaRes);

  // 4. Template message (raw) — expected to fail unless a real templateId exists
  const tmplId = process.env.GUPSHUP_TEMPLATE_INSTALLMENT_DUE || 'REPLACE_WITH_TEMPLATE_ID';
  const tmplRes = await sendTemplateMessage(TEST_DEST, tmplId, ['Test User', '45,000', 'Cycle 1', '20 Aug 2026']);
  line('sendTemplateMessage', tmplRes);

  // 5-7. VSYK helper templates (gracefully report "not configured" until approved)
  line('sendInstallmentDueReminder', await sendInstallmentDueReminder(TEST_DEST, 'Test User', 'Cycle 1', '3', '50,000', '5,000', '45,000', '20 Aug 2026'));
  line('sendPaymentOverdueReminder', await sendPaymentOverdueReminder(TEST_DEST, 'Test User', '45,000', 'Cycle 1', '20 Aug 2026'));
  line('sendAuctionScheduledNotice', await sendAuctionScheduledNotice(TEST_DEST, 'Test User', 'Cycle 1', '3', '25 Aug 2026', '6:00 PM', '2,50,000'));
  line('sendOTP', await sendOTP(TEST_DEST, '123456'));

  // 9. Delivery status (read from webhook-fed store — 'unknown' offline is expected)
  if (lastTextMsgId) {
    const statusRes = checkDeliveryStatus(lastTextMsgId);
    line('checkDeliveryStatus', statusRes);
  } else {
    console.log('⚠️  checkDeliveryStatus       | skipped (no messageId from sendTextMessage)');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('Done. Note: template + delivery-status results depend on');
  console.log('approved templates and a live webhook (see report).');
  console.log('══════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
