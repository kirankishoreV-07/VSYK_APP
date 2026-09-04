import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidIndianMobile, normalizePhoneToDb, normalizePhoneToGupshup } from '../whatsapp/phoneUtils';
import { sendOTP } from '../whatsapp/templates';

type CustomerForAuth = {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string;
  auth_user_id: string | null;
  whatsapp_opt_in?: boolean | null;
  whatsapp_opt_out_at?: string | null;
};

type LookupResult =
  | { status: 'found'; customer: CustomerForAuth }
  | { status: 'not_found' | 'ambiguous' | 'inactive' | 'opted_out' | 'temporary_error'; customer: null };

// Keep this synchronized with the expiry configured on the approved
// authentication template. Gupshup currently has this template at 10 minutes.
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 3;
const OTP_MAX_ATTEMPTS = 5;

export const authRouter = Router();

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

function getAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return null;
  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function getAnonClient(): SupabaseClient | null {
  if (anonClient) return anonClient;
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

function getPhoneCandidates(phone10: string): string[] {
  const e164 = normalizePhoneToGupshup(phone10);
  return Array.from(new Set([phone10, e164, `+${e164}`]));
}

function genericAdminLoginError(res: Response) {
  return res.status(401).json({ error: 'The username or password is incorrect.' });
}

function hashSecret(value: string): string {
  const pepper = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!pepper) {
    throw new Error('OTP hashing secret is not configured.');
  }
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

function hashOtp(customerId: string, otp: string): string {
  return hashSecret(`${customerId}:${otp}`);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Admin login accepts either the configured legacy username or the admin's
 * Supabase email. The username-to-email mapping stays on the trusted backend;
 * passwords are verified only by Supabase Auth and are never stored here.
 */
authRouter.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');
    if (!identifier || !password) return genericAdminLoginError(res);

    const admin = getAdminClient();
    const config = getSupabaseConfig();
    if (!admin || !config.anonKey) {
      return res.status(500).json({ error: 'Admin login is not configured.' });
    }

    let email = identifier.toLowerCase();
    if (!identifier.includes('@')) {
      const configuredUsername = (process.env.ADMIN_LOGIN_USERNAME || '').trim();
      if (!configuredUsername || identifier.toLowerCase() !== configuredUsername.toLowerCase()) {
        return genericAdminLoginError(res);
      }

      // The current application has one administrator. Refuse ambiguous
      // username resolution if more than one marker exists; email login still
      // works for multi-admin installations.
      const { data: adminRows, error: rowsError } = await admin
        .from('admin_users')
        .select('id')
        .limit(2);
      if (rowsError || !adminRows || adminRows.length !== 1) {
        if (rowsError) console.error('[Admin Auth] Admin lookup failed:', rowsError.message);
        return genericAdminLoginError(res);
      }

      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(adminRows[0].id);
      if (userError || !authUser.user?.email) {
        if (userError) console.error('[Admin Auth] Auth user lookup failed:', userError.message);
        return genericAdminLoginError(res);
      }
      email = authUser.user.email;
    }

    const verifier = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInError } = await verifier.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) return genericAdminLoginError(res);

    const { data: adminMarker, error: markerError } = await admin
      .from('admin_users')
      .select('id')
      .eq('id', signIn.session.user.id)
      .maybeSingle();
    if (markerError || !adminMarker) {
      await verifier.auth.signOut({ scope: 'local' });
      return genericAdminLoginError(res);
    }

    return res.json({
      ok: true,
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    });
  } catch (error: any) {
    console.error('[Admin Auth] Login failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not complete admin login.' });
  }
});

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function makeMemberEmail(customerId: string): string {
  return `member+${customerId.replace(/-/g, '')}@auth.vsyk.local`;
}

function makeOneTimePassword(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function genericRequestResponse(res: Response) {
  return res.json({
    ok: true,
    message: 'If this number is eligible, an OTP will be sent shortly.',
  });
}

function genericVerifyError(res: Response) {
  return res.status(400).json({ error: 'Invalid or expired OTP.' });
}

async function hasActiveMembership(supabase: SupabaseClient, customerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chit_members')
    .select('id, bid_status, chit_groups(status)')
    .eq('customer_id', customerId)
    .in('bid_status', ['active', 'bidding']);

  if (error) {
    console.error('[OTP] Membership check failed:', error.message);
    return false;
  }

  return (data || []).some((row: any) => row.chit_groups?.status === 'active');
}

async function findEligibleCustomer(phone: string): Promise<LookupResult> {
  const supabase = getAdminClient();
  if (!supabase) return { status: 'temporary_error', customer: null };

  const phone10 = normalizePhoneToDb(phone);
  if (!isValidIndianMobile(phone10)) return { status: 'not_found', customer: null };

  const { data, error } = await supabase
    .from('customers')
    .select('id, customer_id, full_name, phone, auth_user_id, whatsapp_opt_in, whatsapp_opt_out_at')
    .in('phone', getPhoneCandidates(phone10));

  if (error) {
    console.error('[OTP] Customer lookup failed:', error.message);
    return { status: 'temporary_error', customer: null };
  }

  const matching = (data || []).filter((row: any) => normalizePhoneToDb(row.phone || '') === phone10);
  if (matching.length === 0) return { status: 'not_found', customer: null };
  if (matching.length > 1) {
    console.warn('[OTP] Ambiguous customer lookup for phone ending', phone10.slice(-4));
    return { status: 'ambiguous', customer: null };
  }

  const customer = matching[0] as CustomerForAuth;
  // Pressing "Send OTP on WhatsApp" is an explicit, user-initiated request
  // for an authentication message. Do not confuse that with consent for
  // proactive reminders/marketing. Continue to honour an explicit STOP/
  // opt-out, while allowing existing customers whose legacy consent flag has
  // never been populated. Proactive notifications remain strict opt-in only.
  if (customer.whatsapp_opt_in === false && customer.whatsapp_opt_out_at) {
    return { status: 'opted_out', customer: null };
  }

  const active = await hasActiveMembership(supabase, customer.id);
  if (!active) return { status: 'inactive', customer: null };

  return { status: 'found', customer };
}

async function enforceRequestRateLimit(
  supabase: SupabaseClient,
  customerId: string,
  phoneHash: string,
): Promise<'ok' | 'cooldown' | 'limited'> {
  const now = Date.now();
  const cooldownSince = new Date(now - OTP_RESEND_COOLDOWN_MS).toISOString();
  const windowSince = new Date(now - OTP_RATE_WINDOW_MS).toISOString();

  const { data: recent } = await supabase
    .from('whatsapp_otp_requests')
    .select('id')
    .eq('customer_id', customerId)
    .eq('phone_hash', phoneHash)
    .gte('created_at', cooldownSince)
    .limit(1);

  if ((recent || []).length > 0) return 'cooldown';

  const { count } = await supabase
    .from('whatsapp_otp_requests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('phone_hash', phoneHash)
    .gte('created_at', windowSince);

  return (count || 0) >= OTP_MAX_REQUESTS_PER_WINDOW ? 'limited' : 'ok';
}

async function createSessionForCustomer(customer: CustomerForAuth) {
  const admin = getAdminClient();
  const anon = getAnonClient();
  if (!admin || !anon) {
    throw new Error('Supabase auth is not configured.');
  }

  const email = makeMemberEmail(customer.id);
  const password = makeOneTimePassword();
  // The auth.users insert trigger (handle_new_user) copies NEW.phone into
  // profiles.phone (NOT NULL), so the auth user MUST carry a phone or
  // createUser fails with "Database error creating new user".
  const authPhone = normalizePhoneToGupshup(customer.phone);
  let authUserId = customer.auth_user_id;

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        customer_id: customer.id,
        customer_code: customer.customer_id,
        full_name: customer.full_name,
        role: 'member',
      },
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      phone: authPhone,
      phone_confirm: true,
      password,
      email_confirm: true,
      user_metadata: {
        customer_id: customer.id,
        customer_code: customer.customer_id,
        full_name: customer.full_name,
        role: 'member',
      },
    });
    if (error || !data.user) throw error || new Error('Could not create auth user.');
    authUserId = data.user.id;

    const { error: linkError } = await admin
      .from('customers')
      .update({ auth_user_id: authUserId })
      .eq('id', customer.id);
    if (linkError) throw linkError;
  }

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    throw signInError || new Error('Could not create auth session.');
  }

  return {
    authUserId,
    session: signIn.session,
  };
}

authRouter.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const phone10 = normalizePhoneToDb(String(req.body?.phone || ''));
    if (!isValidIndianMobile(phone10)) {
      return res.status(400).json({ error: 'Enter a valid registered mobile number.' });
    }

    const lookup = await findEligibleCustomer(phone10);
    if (lookup.status !== 'found') {
      return genericRequestResponse(res);
    }

    const supabase = getAdminClient();
    if (!supabase) return res.status(500).json({ error: 'OTP service is not configured.' });

    const phoneHash = hashSecret(phone10);
    const rateLimit = await enforceRequestRateLimit(supabase, lookup.customer.id, phoneHash);
    if (rateLimit === 'cooldown') {
      return res.status(429).json({ error: 'Please wait before requesting another OTP.' });
    }
    if (rateLimit === 'limited') {
      return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    const { data: otpRow, error: insertError } = await supabase
      .from('whatsapp_otp_requests')
      .insert({
        customer_id: lookup.customer.id,
        phone_hash: phoneHash,
        otp_hash: hashOtp(lookup.customer.id, otp),
        max_attempts: OTP_MAX_ATTEMPTS,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !otpRow) {
      console.error('[OTP] Could not store OTP request:', insertError?.message || 'missing row');
      return res.status(500).json({ error: 'Could not request OTP right now.' });
    }

    const sendResult = await sendOTP(phone10, otp);
    await supabase
      .from('whatsapp_otp_requests')
      .update({
        send_status: sendResult.success ? 'sent' : 'failed',
        gupshup_message_id: sendResult.messageId || null,
      })
      .eq('id', otpRow.id);

    if (!sendResult.success) {
      console.warn('[OTP] Gupshup OTP send failed:', sendResult.statusCode || '', sendResult.error || '');
      return res.status(503).json({ error: 'Could not send OTP right now.' });
    }

    return res.json({ ok: true, expiresInSeconds: OTP_EXPIRY_MS / 1000 });
  } catch (error: any) {
    console.error('[OTP] Request failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not request OTP right now.' });
  }
});

authRouter.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const phone10 = normalizePhoneToDb(String(req.body?.phone || ''));
    const otp = String(req.body?.otp || '').trim();

    if (!isValidIndianMobile(phone10) || !/^\d{6}$/.test(otp)) {
      return genericVerifyError(res);
    }

    const lookup = await findEligibleCustomer(phone10);
    if (lookup.status !== 'found') {
      return genericVerifyError(res);
    }

    const supabase = getAdminClient();
    if (!supabase) return res.status(500).json({ error: 'OTP service is not configured.' });

    const { data: otpRow, error: otpError } = await supabase
      .from('whatsapp_otp_requests')
      .select('id, otp_hash, attempt_count, max_attempts')
      .eq('customer_id', lookup.customer.id)
      .eq('phone_hash', hashSecret(phone10))
      .eq('send_status', 'sent')
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error('[OTP] Verify lookup failed:', otpError.message);
      return genericVerifyError(res);
    }
    if (!otpRow) return genericVerifyError(res);

    const attempts = Number((otpRow as any).attempt_count || 0);
    const maxAttempts = Number((otpRow as any).max_attempts || OTP_MAX_ATTEMPTS);
    if (attempts >= maxAttempts) {
      return res.status(429).json({ error: 'Too many verification attempts. Please request a new OTP.' });
    }

    const expectedHash = hashOtp(lookup.customer.id, otp);
    const matched = timingSafeEqualHex((otpRow as any).otp_hash, expectedHash);

    if (!matched) {
      await supabase
        .from('whatsapp_otp_requests')
        .update({ attempt_count: attempts + 1 })
        .eq('id', (otpRow as any).id);
      return genericVerifyError(res);
    }

    await supabase
      .from('whatsapp_otp_requests')
      .update({ consumed_at: new Date().toISOString(), attempt_count: attempts + 1 })
      .eq('id', (otpRow as any).id);

    const { authUserId, session } = await createSessionForCustomer(lookup.customer);

    return res.json({
      ok: true,
      customerId: lookup.customer.id,
      authUserId,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: {
          id: session.user.id,
          email: session.user.email,
        },
      },
    });
  } catch (error: any) {
    console.error('[OTP] Verify failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not verify OTP right now.' });
  }
});
