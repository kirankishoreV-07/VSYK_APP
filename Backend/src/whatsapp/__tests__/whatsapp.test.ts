// ============================================================
// Automated Tests for WhatsApp / Gupshup Integration
// ============================================================

import assert from 'node:assert';
import process from 'node:process';
import dotenv from 'dotenv';
dotenv.config();
import {
  normalizePhoneToDb,
  normalizePhoneToGupshup,
  isValidIndianMobile,
} from '../phoneUtils';
import { handleMessage } from '../chatbot';
import { isGupshupConfigured } from '../gupshup';

async function runTests() {
  console.log('🧪 Starting WhatsApp Integration Unit & Logic Tests...\n');
  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`  ✅ PASS: ${description}`);
            passed++;
          })
          .catch((err) => {
            console.error(`  ❌ FAIL: ${description}`);
            console.error(`     Error: ${err.message}`);
            failed++;
          });
      }
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // ── 1. Phone Normalization Tests ────────────────────────────
  console.log('📋 Test Group 1: Phone Normalization');

  test('normalizePhoneToDb: 10-digit unchanged', () => {
    assert.strictEqual(normalizePhoneToDb('9876543210'), '9876543210');
  });

  test('normalizePhoneToDb: 91 prefix stripped', () => {
    assert.strictEqual(normalizePhoneToDb('919876543210'), '9876543210');
  });

  test('normalizePhoneToDb: +91 prefix stripped', () => {
    assert.strictEqual(normalizePhoneToDb('+919876543210'), '9876543210');
  });

  test('normalizePhoneToDb: handles spaces and dashes', () => {
    assert.strictEqual(normalizePhoneToDb('+91 98765-43210'), '9876543210');
    assert.strictEqual(normalizePhoneToDb('91 98765 43210'), '9876543210');
  });

  test('normalizePhoneToGupshup: 10-digit gets 91 prefix', () => {
    assert.strictEqual(normalizePhoneToGupshup('9876543210'), '919876543210');
  });

  test('normalizePhoneToGupshup: 91 prefix preserved', () => {
    assert.strictEqual(normalizePhoneToGupshup('919876543210'), '919876543210');
  });

  test('isValidIndianMobile: valid numbers', () => {
    assert.strictEqual(isValidIndianMobile('9876543210'), true);
    assert.strictEqual(isValidIndianMobile('8123456789'), true);
    assert.strictEqual(isValidIndianMobile('7012345678'), true);
    assert.strictEqual(isValidIndianMobile('6987654321'), true);
  });

  test('isValidIndianMobile: invalid numbers', () => {
    assert.strictEqual(isValidIndianMobile('1234567890'), false);
    assert.strictEqual(isValidIndianMobile('5555555555'), false);
    assert.strictEqual(isValidIndianMobile('98765'), false);
    assert.strictEqual(isValidIndianMobile('987654321012'), false);
  });

  // ── 2. Chatbot Routing & Unregistered Customer Tests ─────────
  console.log('\n📋 Test Group 2: Chatbot Logic & Customer Fallbacks');

  await test('handleMessage: Unregistered customer gets support message', async () => {
    const response = await handleMessage('910000000000', 'Hi');
    assert.strictEqual(response, 'This WhatsApp number is not registered with VSYK Chits.');
  });

  await test('handleMessage: STOP returns safe opt-out acknowledgement', async () => {
    const response = await handleMessage('910000000000', 'STOP');
    assert(response.includes('opted out'));
    assert(!response.includes('account'));
  });

  await test('handleMessage: Greeting detection works for various formats', async () => {
    const res1 = await handleMessage('910000000000', 'hello');
    assert(typeof res1 === 'string' && res1.length > 0);
    const res2 = await handleMessage('910000000000', 'Namaste');
    assert(typeof res2 === 'string' && res2.length > 0);
    const res3 = await handleMessage('910000000000', 'Vanakkam');
    assert(typeof res3 === 'string' && res3.length > 0);
  });

  // ── 3. Webhook Handler Express Mock Tests ───────────────────
  console.log('\n📋 Test Group 3: Webhook Express Handler');
  const { handleWebhook } = await import('../webhook');

  await test('handleWebhook: ignores invalid payload gracefully with 200', async () => {
    let statusCode = 0;
    let jsonResponse: any = null;
    const req = { body: {} } as any;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResponse = data;
        return this;
      },
    } as any;

    await handleWebhook(req, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(jsonResponse.status, 'ignored');
  });

  await test('handleWebhook: acknowledges message-event delivery status', async () => {
    let statusCode = 0;
    let jsonResponse: any = null;
    const req = {
      body: {
        app: 'VSYKCHITS',
        timestamp: Date.now(),
        version: 2,
        type: 'message-event',
        payload: {
          id: 'msg-123',
          type: 'delivered',
          destination: '919876543210',
        },
      },
    } as any;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResponse = data;
        return this;
      },
    } as any;

    await handleWebhook(req, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(jsonResponse.status, 'ack');
  });

  await test('handleWebhook: accepts message type and returns received immediately', async () => {
    let statusCode = 0;
    let jsonResponse: any = null;
    const req = {
      body: {
        app: 'VSYKCHITS',
        timestamp: Date.now(),
        version: 2,
        type: 'message',
        payload: {
          id: 'test-inbound-' + Date.now(),
          source: '910000000000',
          type: 'text',
          payload: { text: 'Hi' },
          sender: { phone: '910000000000', name: 'Test User' },
        },
      },
    } as any;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResponse = data;
        return this;
      },
    } as any;

    await handleWebhook(req, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(jsonResponse.status, 'received');
  });

  // ── 4. Gupshup Configuration Checks ─────────────────────────
  console.log('\n📋 Test Group 4: Gupshup Service State');

  test('isGupshupConfigured returns boolean safely', () => {
    const configured = isGupshupConfigured();
    assert(typeof configured === 'boolean');
    console.log(`     (Gupshup configured in env: ${configured})`);
  });

  // ── 5. New Outbound Helpers (offline, no network) ───────────
  console.log('\n📋 Test Group 5: Media / Opt-in / Delivery Status Guards');
  const {
    sendMediaMessage,
    checkDeliveryStatus,
    recordDeliveryStatus,
  } = await import('../gupshup');
  const { sendOTP } = await import('../templates');

  await test('sendMediaMessage: rejects a non-http media URL', async () => {
    const res = await sendMediaMessage('919876543210', 'ftp://x/y.png', 'image');
    assert.strictEqual(res.success, false);
    assert(/valid http/i.test(res.error || ''));
  });

  test('checkDeliveryStatus: unknown before any callback', () => {
    const res = checkDeliveryStatus('never-seen-id');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'unknown');
  });

  test('checkDeliveryStatus: reflects a recorded webhook transition', () => {
    recordDeliveryStatus('roundtrip-id', 'read', 0, undefined);
    const res = checkDeliveryStatus('roundtrip-id');
    assert.strictEqual(res.status, 'read');
    assert(typeof res.updatedAt === 'number');
  });

  test('checkDeliveryStatus: empty messageId is an error', () => {
    const res = checkDeliveryStatus('');
    assert.strictEqual(res.success, false);
  });

  await test('sendOTP: rejects a malformed OTP without a configured template', async () => {
    // With a template configured but a bad OTP, the digit guard must fire.
    const prev = process.env.GUPSHUP_TEMPLATE_OTP;
    process.env.GUPSHUP_TEMPLATE_OTP = 'test-template-id';
    const res = await sendOTP('919876543210', 'abcd');
    assert.strictEqual(res.success, false);
    assert(/4.?8 digits/i.test(res.error || ''));
    process.env.GUPSHUP_TEMPLATE_OTP = prev;
  });

  console.log(`\n========================================`);
  console.log(`🏁 Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
