import { Request, Response, Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../middleware/adminAuth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IN_FILTER_BATCH = 20;

type ImpactCounts = Record<string, number>;

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

function chunks<T>(values: T[], size = IN_FILTER_BATCH): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function routeId(req: Request): string {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] || '' : value || '';
}

async function countIn(admin: SupabaseClient, table: string, column: string, ids: string[]): Promise<number> {
  let total = 0;
  for (const batch of chunks(ids)) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).in(column, batch);
    if (error) throw error;
    total += count || 0;
  }
  return total;
}

async function countEqual(admin: SupabaseClient, table: string, column: string, id: string): Promise<number> {
  const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq(column, id);
  if (error) throw error;
  return count || 0;
}

async function deleteIn(admin: SupabaseClient, table: string, column: string, ids: string[]): Promise<number> {
  let total = 0;
  for (const batch of chunks(ids)) {
    const { count, error } = await admin.from(table).delete({ count: 'exact' }).in(column, batch);
    if (error) throw error;
    total += count || 0;
  }
  return total;
}

async function groupImpact(admin: SupabaseClient, groupId: string) {
  const { data: group, error: groupError } = await admin
    .from('chit_groups')
    .select('id, name, group_code, status, accounting_type')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) return null;

  const [{ data: members, error: memberError }, { data: auctions, error: auctionError }] = await Promise.all([
    admin.from('chit_members').select('id').eq('chit_group_id', groupId),
    admin.from('auctions').select('id, status').eq('chit_group_id', groupId),
  ]);
  if (memberError) throw memberError;
  if (auctionError) throw auctionError;

  const memberIds = (members || []).map((row: any) => row.id as string);
  const auctionIds = (auctions || []).map((row: any) => row.id as string);
  const [paymentSchedules, transactions, cashCollections, followups, paymentOrders, prizeSettlements,
    foreclosureRequests, bids, participants, auctionEvents] = await Promise.all([
    countIn(admin, 'payment_schedules', 'chit_member_id', memberIds),
    countIn(admin, 'chit_member_transactions', 'chit_member_id', memberIds),
    countIn(admin, 'cash_collections', 'chit_member_id', memberIds),
    countIn(admin, 'collection_followups', 'chit_member_id', memberIds),
    countIn(admin, 'payment_orders', 'chit_member_id', memberIds),
    countIn(admin, 'auction_prize_settlements', 'chit_member_id', memberIds),
    countIn(admin, 'foreclosure_requests', 'chit_member_id', memberIds),
    countIn(admin, 'auction_bids', 'auction_id', auctionIds),
    countIn(admin, 'auction_participants', 'auction_id', auctionIds),
    countIn(admin, 'auction_events', 'auction_id', auctionIds),
  ]);

  const counts: ImpactCounts = {
    memberships: memberIds.length,
    paymentSchedules,
    transactions,
    cashCollections,
    collectionFollowups: followups,
    paymentOrders,
    prizeSettlements,
    foreclosureRequests,
    auctions: auctionIds.length,
    bids,
    auctionParticipants: participants,
    auctionEvents,
  };
  const activeAuctions = (auctions || []).filter((row: any) => row.status === 'live' || row.status === 'upcoming').length;
  const warnings = [
    'All memberships, payment records, auctions, bids and follow-up history belonging to this group will be permanently deleted.',
  ];
  if (group.status === 'active') warnings.push('This group is active. Deleting it immediately removes it from every member account.');
  if (activeAuctions > 0) warnings.push(`${activeAuctions} live or upcoming auction${activeAuctions === 1 ? '' : 's'} will be deleted.`);

  return {
    resourceType: 'group',
    id: group.id,
    name: group.name,
    secondaryLabel: group.group_code || group.accounting_type,
    confirmationValue: group.name,
    counts,
    warnings,
    blockedReason: null,
  };
}

async function customerImpact(admin: SupabaseClient, customerId: string) {
  const { data: customer, error: customerError } = await admin
    .from('customers')
    .select('id, customer_id, full_name, auth_user_id')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) return null;

  const { data: memberships, error: membershipError } = await admin
    .from('chit_members')
    .select('id, chit_group_id')
    .eq('customer_id', customerId);
  if (membershipError) throw membershipError;
  const memberIds = (memberships || []).map((row: any) => row.id as string);
  const groupCount = new Set((memberships || []).map((row: any) => row.chit_group_id)).size;

  const [paymentSchedules, transactions, cashCollections, followups, paymentOrders, prizeSettlements,
    foreclosureRequests, bids, participants, otpRequests, deviceTokens] = await Promise.all([
    countIn(admin, 'payment_schedules', 'chit_member_id', memberIds),
    countIn(admin, 'chit_member_transactions', 'chit_member_id', memberIds),
    countIn(admin, 'cash_collections', 'chit_member_id', memberIds),
    countIn(admin, 'collection_followups', 'chit_member_id', memberIds),
    countIn(admin, 'payment_orders', 'chit_member_id', memberIds),
    countIn(admin, 'auction_prize_settlements', 'chit_member_id', memberIds),
    countIn(admin, 'foreclosure_requests', 'chit_member_id', memberIds),
    countEqual(admin, 'auction_bids', 'customer_id', customerId),
    countEqual(admin, 'auction_participants', 'customer_id', customerId),
    countEqual(admin, 'whatsapp_otp_requests', 'customer_id', customerId),
    countEqual(admin, 'member_device_tokens', 'customer_id', customerId),
  ]);

  let isAdminAccount = false;
  if (customer.auth_user_id) {
    const { data: adminRow, error: adminError } = await admin
      .from('admin_users')
      .select('id')
      .eq('id', customer.auth_user_id)
      .maybeSingle();
    if (adminError) throw adminError;
    isAdminAccount = Boolean(adminRow);
  }

  const counts: ImpactCounts = {
    memberships: memberIds.length,
    chitGroups: groupCount,
    paymentSchedules,
    transactions,
    cashCollections,
    collectionFollowups: followups,
    paymentOrders,
    prizeSettlements,
    foreclosureRequests,
    bids,
    auctionParticipations: participants,
    otpRequests,
    deviceTokens,
  };
  const warnings = [
    'All memberships, payments, bids, auction participation, follow-ups and device records belonging to this customer will be permanently deleted.',
  ];
  if (customer.auth_user_id) warnings.push('The customer login account and all active sessions will also be removed.');

  return {
    resourceType: 'customer',
    id: customer.id,
    name: customer.full_name,
    secondaryLabel: customer.customer_id,
    confirmationValue: customer.customer_id,
    counts,
    warnings,
    authUserId: customer.auth_user_id as string | null,
    blockedReason: isAdminAccount ? 'This customer is linked to an administrator account and cannot be deleted here.' : null,
  };
}

async function deleteMembershipData(admin: SupabaseClient, memberIds: string[], deleted: ImpactCounts) {
  for (const [table, label] of [
    ['collection_followups', 'collectionFollowups'],
    ['cash_collections', 'cashCollections'],
    ['payment_orders', 'paymentOrders'],
    ['chit_member_transactions', 'transactions'],
    ['auction_prize_settlements', 'prizeSettlements'],
    ['foreclosure_requests', 'foreclosureRequests'],
  ] as const) deleted[label] = await deleteIn(admin, table, 'chit_member_id', memberIds);
  deleted.paymentSchedules = await deleteIn(admin, 'payment_schedules', 'chit_member_id', memberIds);
  deleted.memberships = await deleteIn(admin, 'chit_members', 'id', memberIds);
}

export const adminDestructiveDeletionRouter = Router();

adminDestructiveDeletionRouter.get('/groups/:id/deletion-impact', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  const groupId = routeId(req);
  if (!admin) return res.status(503).json({ error: 'Deletion service is not configured.' });
  if (!UUID.test(groupId)) return res.status(400).json({ error: 'A valid group ID is required.' });
  try {
    const impact = await groupImpact(admin, groupId);
    return impact ? res.json(impact) : res.status(404).json({ error: 'Chit group not found.' });
  } catch (error: any) {
    console.error('[Admin delete] group impact failed:', error?.message);
    return res.status(500).json({ error: 'Could not calculate the group deletion impact.' });
  }
});

adminDestructiveDeletionRouter.delete('/groups/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  const groupId = routeId(req);
  if (!admin) return res.status(503).json({ error: 'Deletion service is not configured.' });
  if (!UUID.test(groupId)) return res.status(400).json({ error: 'A valid group ID is required.' });
  try {
    const impact = await groupImpact(admin, groupId);
    if (!impact) return res.status(404).json({ error: 'Chit group not found.' });
    if (String(req.body?.confirmation || '').trim() !== impact.confirmationValue) {
      return res.status(400).json({ error: `Type ${impact.confirmationValue} exactly to confirm deletion.` });
    }

    const { data: auctions, error: auctionReadError } = await admin.from('auctions').select('id').eq('chit_group_id', groupId);
    const { data: members, error: memberReadError } = await admin.from('chit_members').select('id').eq('chit_group_id', groupId);
    if (auctionReadError || memberReadError) throw auctionReadError || memberReadError;
    const auctionIds = (auctions || []).map((row: any) => row.id as string);
    const memberIds = (members || []).map((row: any) => row.id as string);
    const deleted: ImpactCounts = {};

    for (const [table, label] of [
      ['auction_events', 'auctionEvents'],
      ['auction_bids', 'bids'],
      ['auction_participants', 'auctionParticipants'],
      ['auction_reminders', 'auctionReminders'],
      ['auction_prize_settlements', 'prizeSettlements'],
    ] as const) deleted[label] = await deleteIn(admin, table, 'auction_id', auctionIds);
    deleted.auctions = await deleteIn(admin, 'auctions', 'id', auctionIds);
    await deleteMembershipData(admin, memberIds, deleted);
    const { count, error: deleteError } = await admin.from('chit_groups').delete({ count: 'exact' }).eq('id', groupId);
    if (deleteError) throw deleteError;
    if (!count) return res.status(409).json({ error: 'The group was changed or deleted by another request.' });
    deleted.chitGroups = count;
    return res.json({ ok: true, deleted });
  } catch (error: any) {
    console.error('[Admin delete] group deletion failed:', error?.message);
    return res.status(500).json({ error: 'Could not completely delete the chit group. Refresh and review its current state.' });
  }
});

adminDestructiveDeletionRouter.get('/customers/:id/deletion-impact', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  const customerId = routeId(req);
  if (!admin) return res.status(503).json({ error: 'Deletion service is not configured.' });
  if (!UUID.test(customerId)) return res.status(400).json({ error: 'A valid customer ID is required.' });
  try {
    const impact = await customerImpact(admin, customerId);
    return impact ? res.json(impact) : res.status(404).json({ error: 'Customer not found.' });
  } catch (error: any) {
    console.error('[Admin delete] customer impact failed:', error?.message);
    return res.status(500).json({ error: 'Could not calculate the customer deletion impact.' });
  }
});

adminDestructiveDeletionRouter.delete('/customers/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const admin = getAdmin();
  const customerId = routeId(req);
  if (!admin) return res.status(503).json({ error: 'Deletion service is not configured.' });
  if (!UUID.test(customerId)) return res.status(400).json({ error: 'A valid customer ID is required.' });
  try {
    const impact = await customerImpact(admin, customerId);
    if (!impact) return res.status(404).json({ error: 'Customer not found.' });
    if (impact.blockedReason) return res.status(409).json({ error: impact.blockedReason });
    if (String(req.body?.confirmation || '').trim() !== impact.confirmationValue) {
      return res.status(400).json({ error: `Type ${impact.confirmationValue} exactly to confirm deletion.` });
    }

    const { data: members, error: memberError } = await admin.from('chit_members').select('id').eq('customer_id', customerId);
    if (memberError) throw memberError;
    const memberIds = (members || []).map((row: any) => row.id as string);
    const deleted: ImpactCounts = {};
    deleted.bids = await countEqual(admin, 'auction_bids', 'customer_id', customerId);
    const { error: bidError } = await admin.from('auction_bids').delete().eq('customer_id', customerId);
    if (bidError) throw bidError;
    deleted.auctionParticipations = await countEqual(admin, 'auction_participants', 'customer_id', customerId);
    const { error: participantError } = await admin.from('auction_participants').delete().eq('customer_id', customerId);
    if (participantError) throw participantError;
    await deleteMembershipData(admin, memberIds, deleted);

    const { count, error: customerDeleteError } = await admin.from('customers').delete({ count: 'exact' }).eq('id', customerId);
    if (customerDeleteError) throw customerDeleteError;
    if (!count) return res.status(409).json({ error: 'The customer was changed or deleted by another request.' });
    deleted.customers = count;

    let authAccountDeleted = false;
    let warning: string | null = null;
    if (impact.authUserId) {
      const { error: authError } = await admin.auth.admin.deleteUser(impact.authUserId);
      authAccountDeleted = !authError;
      if (authError) {
        console.error('[Admin delete] customer auth cleanup failed:', authError.message);
        warning = 'Customer data was deleted, but the linked login account could not be removed. Remove that Auth user from Supabase before reusing the phone number.';
      }
    }
    return res.json({ ok: true, deleted, authAccountDeleted, warning });
  } catch (error: any) {
    console.error('[Admin delete] customer deletion failed:', error?.message);
    return res.status(500).json({ error: 'Could not completely delete the customer. Refresh and review its current state.' });
  }
});
