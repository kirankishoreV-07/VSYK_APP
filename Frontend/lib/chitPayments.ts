/** Shared chit payment / payable-installment logic (accounted + unaccounted). */

export interface AuctionCycleInfo {
  id?: string;
  auction_number: number | null;
  status?: string | null;
  scheduled_at?: string | null;
  final_due_amount?: number | null;
  installment_due?: number | null;
}

const AUCTION_STATUS_PRIORITY: Record<string, number> = {
  completed: 3,
  live: 2,
  upcoming: 1,
  cancelled: 0,
};

/** One row per auction_number — prefers completed > live > upcoming */
export function dedupeAuctionCycles(auctions: AuctionCycleInfo[]): AuctionCycleInfo[] {
  const map = new Map<number, AuctionCycleInfo>();
  for (const auction of auctions) {
    if (auction.auction_number == null) continue;
    const existing = map.get(auction.auction_number);
    const auctionPriority = AUCTION_STATUS_PRIORITY[auction.status || ''] || 0;
    const existingPriority = AUCTION_STATUS_PRIORITY[existing?.status || ''] || 0;
    if (!existing || auctionPriority > existingPriority) {
      map.set(auction.auction_number, auction);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => (a.auction_number ?? 0) - (b.auction_number ?? 0),
  );
}

function findSettledAuction(auctions: AuctionCycleInfo[], auctionNumber: number): AuctionCycleInfo | undefined {
  return dedupeAuctionCycles(auctions).find((a) => a.auction_number === auctionNumber);
}

/**
 * Payable amount for a collection/payment cycle (month_number = auction_number).
 * - Cycle N is collectible only after auction N is settled.
 * - Before auction 1 settles: cycle 1 uses base monthly installment.
 * - After auction N settles: cycle N uses that auction's settlement (final_due_amount).
 */
export function getCycleDueAmount(
  monthNumber: number,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
): number | null {
  const auction = findSettledAuction(auctions, monthNumber);

  if (monthNumber <= 1 && auction?.status !== 'completed') {
    return monthlyInstallment;
  }

  if (auction?.status !== 'completed') {
    return null;
  }

  if (auction.final_due_amount != null && auction.final_due_amount >= 0) {
    return auction.final_due_amount;
  }
  if (auction.installment_due != null && auction.installment_due > 0) {
    return auction.installment_due;
  }

  return null;
}

/** Whether cash/payment can be recorded for this cycle (auction must be settled). */
export function isCycleCollectible(
  monthNumber: number,
  auctions: AuctionCycleInfo[],
): boolean {
  return getCycleDueAmount(monthNumber, 0, auctions) != null;
}

/** Fallback to monthly installment when cycle due is not yet settled. */
export function getCycleDueAmountWithFallback(
  monthNumber: number,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
): number {
  return getCycleDueAmount(monthNumber, monthlyInstallment, auctions) ?? monthlyInstallment;
}

/** Payable installment from a completed auction settlement. */
export function getMemberDueAfterAuction(
  auction: AuctionCycleInfo,
  monthlyInstallment: number,
): number | null {
  if (auction.status !== 'completed') return null;
  if (auction.final_due_amount != null && auction.final_due_amount >= 0) {
    return auction.final_due_amount;
  }
  if (auction.installment_due != null && auction.installment_due > 0) {
    return auction.installment_due;
  }
  return null;
}

export type CyclePaymentStatus = 'awaiting_auction' | 'unpaid' | 'partial' | 'full';

/** Member payment state for a cycle (cash or logged transactions). */
export function getCyclePaymentStatus(
  monthNumber: number,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
  paidAmount: number,
): CyclePaymentStatus {
  const due = getCycleDueAmount(monthNumber, monthlyInstallment, auctions);
  if (due == null) return 'awaiting_auction';
  if (paidAmount >= due) return 'full';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function isCycleFullyCollected(
  monthNumber: number,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
  paidAmount: number,
): boolean {
  return getCyclePaymentStatus(monthNumber, monthlyInstallment, auctions, paidAmount) === 'full';
}

export function getCycleRemainingDue(
  monthNumber: number,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
  paidAmount: number,
): number | null {
  const due = getCycleDueAmount(monthNumber, monthlyInstallment, auctions);
  if (due == null) return null;
  return Math.max(0, due - paidAmount);
}

/** Months fully collected — partial cycles stay open for top-up/edit. */
export function getFullyCollectedMonths(
  collections: Array<{ month_number: number; amount: number }>,
  monthlyInstallment: number,
  auctions: AuctionCycleInfo[],
  excludeId?: string,
): number[] {
  return collections
    .filter((c) => {
      if (excludeId && 'id' in c && (c as { id?: string }).id === excludeId) return false;
      return isCycleFullyCollected(c.month_number, monthlyInstallment, auctions, c.amount);
    })
    .map((c) => c.month_number);
}

/** @deprecated Use getCycleDueAmount */
export const getUnaccountedCycleDueAmount = getCycleDueAmount;

/**
 * @deprecated Settlement writes now go through the authenticated backend and
 * public.apply_auction_settlement so auction + schedule changes are atomic.
 * Robustly applies (or creates) the post-auction settlement amounts on payment_schedules
 * for every member in the group for the given auction cycle (month_number = auction_number).
 * - Updates existing schedule rows.
 * - Inserts missing schedule rows (for members added before settlement or late-created schedules).
 * This ensures "payment dues" on admin customer views, collection modals, and customer chit screens
 * reflect the correct post-dividend installment for the cycle.
 */
export async function applyAuctionSettlementToSchedules(
  supabaseClient: { from: (table: string) => any },
  chitGroupId: string,
  auctionNumber: number,
  finalDuePaise: number,
  dividendPaise: number,
): Promise<{ updated: number; inserted: number; skipped: number; errors: string[] }> {
  const result = { updated: 0, inserted: 0, skipped: 0, errors: [] as string[] };

  if (!chitGroupId || auctionNumber == null || auctionNumber < 1) {
    result.errors.push('Invalid group or auction number');
    return result;
  }

  try {
    // Fetch current members (with shares)
    const { data: members, error: membersErr } = await supabaseClient
      .from('chit_members')
      .select('id, participation_share')
      .eq('chit_group_id', chitGroupId);

    if (membersErr) {
      result.errors.push(`Failed to load members: ${membersErr.message}`);
      return result;
    }

    if (!members || members.length === 0) {
      result.skipped = 0;
      return result;
    }

    // Due date for a settled cycle is one week from the FIRST time settlement
    // is applied — computed fresh only for brand-new schedule rows. Re-running
    // settlement (double-click, admin reopening the modal to correct a bid)
    // must NOT push the due date further out each time, so an existing row's
    // due_date is never recomputed/overwritten here.
    const settled = new Date();
    settled.setDate(settled.getDate() + 7);
    const dueDateForNewRow = settled.toISOString().split('T')[0];

    for (const m of members as Array<{ id: string; participation_share?: number | null }>) {
      const share = Number(m.participation_share || 1);
      const targetAmount = Math.max(0, Math.round(finalDuePaise * share));
      const targetDividend = Math.max(0, Math.round(dividendPaise * share));

      try {
        // Check if a schedule row already exists for this member + month
        const { data: existing } = await supabaseClient
          .from('payment_schedules')
          .select('id, amount, dividend_amount, due_date')
          .eq('chit_member_id', m.id)
          .eq('month_number', auctionNumber)
          .maybeSingle();

        if (existing?.id) {
          // Update only if different (avoid unnecessary writes). due_date is
          // intentionally excluded — it is set once, at row creation, and
          // never shifted by a re-run of settlement.
          const needsUpdate =
            Number(existing.amount || 0) !== targetAmount ||
            Number(existing.dividend_amount || 0) !== targetDividend;

          if (needsUpdate) {
            const { error: upErr } = await supabaseClient
              .from('payment_schedules')
              .update({
                amount: targetAmount,
                dividend_amount: targetDividend,
              })
              .eq('id', existing.id);

            if (upErr) {
              result.errors.push(`Update failed for member ${m.id}: ${upErr.message}`);
            } else {
              result.updated += 1;
            }
          } else {
            result.skipped += 1;
          }
        } else {
          // Insert a full schedule row for this cycle (use settled amounts)
          const insertRow: any = {
            chit_member_id: m.id,
            month_number: auctionNumber,
            due_date: dueDateForNewRow,
            amount: targetAmount,
            paid: false,
            paid_at: null,
            dividend_amount: targetDividend,
          };

          const { error: insErr } = await supabaseClient
            .from('payment_schedules')
            .insert([insertRow]);

          if (insErr) {
            // If unique violation (race or constraint added later), try update path once
            if (insErr.code === '23505') {
              const { data: recheck } = await supabaseClient
                .from('payment_schedules')
                .select('id')
                .eq('chit_member_id', m.id)
                .eq('month_number', auctionNumber)
                .maybeSingle();
              if (recheck?.id) {
                await supabaseClient
                  .from('payment_schedules')
                  .update({ amount: targetAmount, dividend_amount: targetDividend })
                  .eq('id', recheck.id);
                result.updated += 1;
              } else {
                result.errors.push(`Insert conflict (no row) for member ${m.id}`);
              }
            } else {
              result.errors.push(`Insert failed for member ${m.id}: ${insErr.message}`);
            }
          } else {
            result.inserted += 1;
          }
        }
      } catch (perMemberErr: any) {
        result.errors.push(`Member ${m.id} error: ${perMemberErr?.message || perMemberErr}`);
      }
    }
  } catch (outerErr: any) {
    result.errors.push(`Settlement apply failed: ${outerErr?.message || outerErr}`);
  }

  return result;
}

/**
 * Ensure base payment_schedules rows exist for a newly added member (all cycles).
 * Uses base monthly_installment (pre-settlement). Settlements for past cycles
 * are backfilled by the backend's atomic auction settlement endpoint.
 */
export async function ensureBaseSchedulesForMember(
  supabaseClient: { from: (table: string) => any },
  membershipId: string,
  group: { start_date?: string | null; monthly_installment?: number | null; duration_months?: number | null },
): Promise<number> {
  if (!membershipId || !group) return 0;

  const { data: existing } = await supabaseClient
    .from('payment_schedules')
    .select('id')
    .eq('chit_member_id', membershipId);

  if (existing && existing.length > 0) return existing.length;

  const duration = Number(group.duration_months || 0);
  if (duration <= 0) return 0;

  const baseAmount = Number(group.monthly_installment || 0);
  const start = group.start_date ? new Date(group.start_date) : new Date();
  start.setDate(1);

  const rows: any[] = [];
  for (let i = 0; i < duration; i++) {
    const monthNum = i + 1;
    const due = new Date(start);
    due.setMonth(due.getMonth() + monthNum);
    due.setDate(0);
    rows.push({
      chit_member_id: membershipId,
      month_number: monthNum,
      due_date: due.toISOString().split('T')[0],
      amount: baseAmount,
      paid: false,
      paid_at: null,
      dividend_amount: 0,
    });
  }

  const { error } = await supabaseClient.from('payment_schedules').insert(rows);
  if (error) {
    console.warn('ensureBaseSchedulesForMember insert error (non-fatal):', error.message);
    return 0;
  }
  return rows.length;
}
