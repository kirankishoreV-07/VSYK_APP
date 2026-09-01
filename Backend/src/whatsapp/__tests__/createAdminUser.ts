// One-off script: creates the real Supabase Auth admin account + admin_users
// row, replacing the old plaintext admin_users table. Requires migrations
// 037_admin_auth_rework.sql and 038_rls_lockdown.sql to already be applied
// (037 recreates admin_users with the auth.users(id) FK this script inserts
// into). Safe to re-run — idempotent (updates password if the user already
// exists, upserts the admin_users row).
// Run: npx ts-node src/whatsapp/__tests__/createAdminUser.ts

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || '';

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.');
    process.exit(1);
  }

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingList } = await sb.auth.admin.listUsers();
  const existing = existingList?.users.find((u) => u.email === ADMIN_EMAIL);

  // handle_new_user() (Frontend/supabase/migrations/001_profiles.sql) fires
  // on every auth.users insert and requires NEW.phone (profiles.phone is
  // NOT NULL) — same trigger that required a phone for member OTP signup in
  // Phase 1. Admin accounts have no real phone, so a placeholder is needed
  // purely to satisfy that constraint; it's never used for admin login.
  const PLACEHOLDER_ADMIN_PHONE = '+910000000001';

  let userId: string;
  if (existing) {
    const { data, error } = await sb.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) { console.error('Failed to update existing admin user:', error?.message); process.exit(1); }
    userId = data.user.id;
    console.log(`Updated existing auth user ${ADMIN_EMAIL} (${userId}) with new password.`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      phone: PLACEHOLDER_ADMIN_PHONE,
      phone_confirm: true,
    });
    if (error || !data.user) { console.error('Failed to create admin user:', error?.message); process.exit(1); }
    userId = data.user.id;
    console.log(`Created auth user ${ADMIN_EMAIL} (${userId}).`);
  }

  const { error: upsertErr } = await sb.from('admin_users').upsert({ id: userId, full_name: 'VSYK Admin' });
  if (upsertErr) { console.error('Failed to upsert admin_users row:', upsertErr.message); process.exit(1); }

  console.log(`\nAdmin account ready for ${ADMIN_EMAIL}.`);
  console.log('Use the configured credentials to log in via the admin login screen.');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
