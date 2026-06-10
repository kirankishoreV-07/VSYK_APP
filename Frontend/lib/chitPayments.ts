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