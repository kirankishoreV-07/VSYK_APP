// ============================================================
// VSYK WhatsApp Service — Supabase Data Queries
// ============================================================
// Provides clean functions for customer lookup, chit details,
// payment due, and payment history using the existing Supabase
// schema. All financial data comes from the real database.
//
// Requires SUPABASE_SERVICE_ROLE_KEY for backend-only access.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  VsykCustomer,
  WhatsAppCustomerLookupResult,
  WhatsAppCustomerLookupStatus,
  CustomerChitMembership,
  PendingInstallment,
  PaidInstallment,
} from './types';
import { isValidIndianMobile, normalizePhoneToDb, normalizePhoneToGupshup } from './phoneUtils';

// ── Supabase Client ───────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    console.warn('[WhatsApp Service] Supabase URL or key missing.');
    return null;
  }

  _supabase = createClient(url, key);
  return _supabase;
}

// ── Customer Lookup ───────────────────────────────────────────

/**
 * Find a VSYK customer by their 10-digit phone number.
 * Returns null if not found.
 */
export async function findCustomerByPhone(phone10: string): Promise<VsykCustomer | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id, customer_id, full_name, phone, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_out_at')
    .eq('phone', phone10)
    .maybeSingle();

  if (error) {
    console.error('[WhatsApp Service] Customer lookup error:', error.message);
    return null;
  }

  return data as VsykCustomer | null;
}

function getPhoneCandidates(phone10: string): string[] {
  const e164 = normalizePhoneToGupshup(phone10);
  return Array.from(new Set([phone10, e164, `+${e164}`]));
}

async function hasActiveMembership(customerId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('chit_members')
    .select('id, bid_status, chit_groups(status)')
    .eq('customer_id', customerId)
    .in('bid_status', ['active', 'bidding']);

  if (error) {
    console.error('[WhatsApp Service] Membership auth check error:', error.message);
    return false;
  }

  return (data || []).some((row: any) => row.chit_groups?.status === 'active');
}

/**
 * Resolve and authorize a WhatsApp sender before any customer-specific
 * chatbot query runs. Ambiguous, inactive, opted-out, and unknown senders are
 * treated as unauthorized so no account/payment/auction data can leak.
 */
export async function findAuthorizedWhatsAppCustomer(phone: string): Promise<WhatsAppCustomerLookupResult> {
  const phone10 = normalizePhoneToDb(phone);
  if (!isValidIndianMobile(phone10)) {
    return { status: 'invalid_phone', customer: null };
  }

  const supabase = getSupabase();
  if (!supabase) return { status: 'temporary_error', customer: null };

  const { data, error } = await supabase
    .from('customers')
    .select('id, customer_id, full_name, phone, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_out_at')
    .in('phone', getPhoneCandidates(phone10));

  if (error) {
    console.error('[WhatsApp Service] Customer auth lookup error:', error.message);
    return { status: 'temporary_error', customer: null };
  }

  const matching = (data || []).filter((row: any) => normalizePhoneToDb(row.phone || '') === phone10);

  if (matching.length === 0) {
    return { status: 'not_found', customer: null };
  }

  if (matching.length > 1) {
    console.warn('[WhatsApp Service] Ambiguous customer lookup for phone ending', phone10.slice(-4));
    return { status: 'ambiguous', customer: null };
  }

  const customer = matching[0] as VsykCustomer;

  if (customer.whatsapp_opt_in !== true) {
    return { status: 'opted_out', customer };
  }

  const active = await hasActiveMembership(customer.id);
  if (!active) {
    return { status: 'inactive', customer: null };
  }

  return { status: 'found', customer };
}

/**
 * Update WhatsApp consent for exactly one normalized customer phone. Unknown
 * or ambiguous phones are ignored to avoid leaking registration state.
 */
export async function updateWhatsAppConsentByPhone(
  phone: string,
  optIn: boolean,
): Promise<WhatsAppCustomerLookupStatus> {
  const phone10 = normalizePhoneToDb(phone);
  if (!isValidIndianMobile(phone10)) return 'invalid_phone';

  const supabase = getSupabase();
  if (!supabase) return 'temporary_error';

  const { data, error } = await supabase
    .from('customers')
    .select('id, phone')
    .in('phone', getPhoneCandidates(phone10));

  if (error) {
    console.error('[WhatsApp Service] Consent lookup error:', error.message);
    return 'temporary_error';
  }

  const matching = (data || []).filter((row: any) => normalizePhoneToDb(row.phone || '') === phone10);
  if (matching.length === 0) return 'not_found';
  if (matching.length > 1) return 'ambiguous';

  if (optIn) {
    const active = await hasActiveMembership(matching[0].id);
    if (!active) return 'inactive';
  }

  const now = new Date().toISOString();
  const updates = optIn
    ? { whatsapp_opt_in: true, whatsapp_opt_in_at: now, whatsapp_opt_out_at: null }
    : { whatsapp_opt_in: false, whatsapp_opt_out_at: now };

  const { error: updateError } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', matching[0].id);

  if (updateError) {
    console.error('[WhatsApp Service] Consent update error:', updateError.message);
    return 'temporary_error';
  }

  // Audit the consent change without leaking PII: log only the action and a
  // masked phone (last 4 digits). Never log the full number or customer id.
  console.log(
    `[WhatsApp Service] Consent ${optIn ? 'OPT-IN' : 'OPT-OUT'} recorded for ...${phone10.slice(-4)} at ${now}`,
  );

  return 'found';
}

// ── Chit Details ──────────────────────────────────────────────

/**
 * Get all chit group memberships for a customer.
 */
export async function getCustomerChits(customerId: string): Promise<CustomerChitMembership[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('chit_members')
    .select(`
      id,
      ticket_number,
      participation_share,
      chit_groups (
        name,
        value,
        duration_months,
        monthly_installment,
        status
      )
    `)
    .eq('customer_id', customerId);

  if (error) {
    console.error('[WhatsApp Service] Chit query error:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    memberId: row.id,
    ticketNumber: row.ticket_number,
    participationShare: Number(row.participation_share || 1),
    groupName: row.chit_groups?.name || 'Unknown Group',
    groupValue: Number(row.chit_groups?.value || 0),
    durationMonths: Number(row.chit_groups?.duration_months || 0),
    monthlyInstallment: Number(row.chit_groups?.monthly_installment || 0),
    groupStatus: row.chit_groups?.status || 'unknown',
  }));
}

// ── Payment Due ───────────────────────────────────────────────

/**
 * Get all unpaid installments for a customer, ordered by due date.
 */
export async function getPendingInstallments(customerId: string): Promise<PendingInstallment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // First, get all chit_member IDs for this customer
  const { data: members, error: membersError } = await supabase
    .from('chit_members')
    .select('id')
    .eq('customer_id', customerId);

  if (membersError || !members || members.length === 0) {
    return [];
  }

  const memberIds = members.map((m: any) => m.id);

  // Then get unpaid payment schedules for those memberships
  const { data: schedules, error: schedError } = await supabase
    .from('payment_schedules')
    .select(`
      id,
      chit_member_id,
      month_number,
      due_date,
      amount,
      dividend_amount,
      chit_members (
        chit_groups (
          name
        )
      )
    `)
    .in('chit_member_id', memberIds)
    .eq('paid', false)
    .gt('amount', 0)
    .order('due_date', { ascending: true });

  if (schedError) {
    console.error('[WhatsApp Service] Pending installments error:', schedError.message);
    return [];
  }

  return (schedules || []).map((row: any) => ({
    scheduleId: row.id,
    chitMemberId: row.chit_member_id,
    monthNumber: row.month_number,
    dueDate: row.due_date,
    amount: Number(row.amount || 0),
    dividendAmount: Number(row.dividend_amount || 0),
    groupName: row.chit_members?.chit_groups?.name || 'Unknown Group',
  }));
}

/**
 * Outstanding dues for a customer — ONLY installments whose auction cycle is
 * completed (so the amount is finalized) and that still have an unpaid balance.
 * Future/not-yet-auctioned months are excluded. Ordered by due date.
 *
 * NOTE: the current schema only has a boolean `paid`, so "amount" here is the
 * full finalized due. Phase 3 adds `payment_schedules.paid_amount`, at which
 * point this returns the true remaining (amount - paid_amount), surfacing
 * partial balances down to ₹1.
 */
export async function getOutstandingDues(customerId: string): Promise<PendingInstallment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: members, error: memErr } = await supabase
    .from('chit_members')
    .select('id, chit_group_id')
    .eq('customer_id', customerId);
  if (memErr || !members || members.length === 0) return [];

  const memberIds = members.map((m: any) => m.id);
  const groupIds = Array.from(new Set(members.map((m: any) => m.chit_group_id)));
  const memberGroup = new Map<string, string>(members.map((m: any) => [m.id, m.chit_group_id]));

  // A (group, month) is finalized if ANY auction row for it is completed.
  const { data: aucs, error: aucErr } = await supabase
    .from('auctions')
    .select('chit_group_id, auction_number, status')
    .in('chit_group_id', groupIds)
    .eq('status', 'completed');
  if (aucErr) {
    console.error('[WhatsApp Service] Outstanding dues auction lookup error:', aucErr.message);
    return [];
  }
  const completed = new Set(
    (aucs || []).map((a: any) => `${a.chit_group_id}:${a.auction_number}`),
  );
  if (completed.size === 0) return [];

  const { data: schedules, error: schErr } = await supabase
    .from('payment_schedules')
    .select(`
      id, chit_member_id, month_number, due_date, amount, paid_amount,
      chit_members ( chit_groups ( name ) )
    `)
    .in('chit_member_id', memberIds)
    .eq('paid', false)
    .gt('amount', 0)
    .order('due_date', { ascending: true });
  if (schErr) {
    console.error('[WhatsApp Service] Outstanding dues schedule error:', schErr.message);
    return [];
  }

  return (schedules || [])
    .filter((row: any) => {
      const gid = memberGroup.get(row.chit_member_id);
      return gid && completed.has(`${gid}:${row.month_number}`);
    })
    .map((row: any) => {
      // Remaining = finalized amount minus what has actually been paid.
      const remaining = Math.max(0, Number(row.amount || 0) - Number(row.paid_amount || 0));
      return {
        scheduleId: row.id,
        chitMemberId: row.chit_member_id,
        monthNumber: row.month_number,
        dueDate: row.due_date,
        amount: remaining, // outstanding balance (surfaces partial remainders ≥ ₹1)
        dividendAmount: 0,
        groupName: row.chit_members?.chit_groups?.name || 'Unknown Group',
      };
    })
    // A schedule can be flagged unpaid yet fully covered by partials — hide those.
    .filter((d) => d.amount > 0);
}

// ── Payment History ───────────────────────────────────────────

/**
 * Get the most recent paid installments for a customer (up to 10).
 */
export async function getPaymentHistory(customerId: string): Promise<PaidInstallment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // Get member IDs
  const { data: members } = await supabase
    .from('chit_members')
    .select('id')
    .eq('customer_id', customerId);

  if (!members || members.length === 0) return [];

  const memberIds = members.map((m: any) => m.id);

  // Get paid schedules
  const { data: schedules, error } = await supabase
    .from('payment_schedules')
    .select(`
      month_number,
      amount,
      paid_at,
      dividend_amount,
      chit_members (
        chit_groups (
          name
        )
      )
    `)
    .in('chit_member_id', memberIds)
    .eq('paid', true)
    .order('paid_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[WhatsApp Service] Payment history error:', error.message);
    return [];
  }

  return (schedules || []).map((row: any) => ({
    monthNumber: row.month_number,
    amount: Number(row.amount || 0),
    paidAt: row.paid_at || '',
    dividendAmount: Number(row.dividend_amount || 0),
    groupName: row.chit_members?.chit_groups?.name || 'Unknown Group',
  }));
}

// ── Formatting Helpers ────────────────────────────────────────

/**
 * Format paise amount to Indian Rupees display string.
 * 4500000 → "₹45,000"
 */
export function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Format a date string (YYYY-MM-DD) to Indian display format.
 * "2026-08-20" → "20 Aug 2026"
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
