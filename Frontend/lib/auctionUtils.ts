/** Shared auction scheduling / display logic — prevents phantom "scheduled" rows. */

import type { AuctionCycleInfo } from './chitPayments';

/** DB requires scheduled_at NOT NULL — placeholders use this sentinel (never shown as scheduled). */
export const PLACEHOLDER_AUCTION_SCHEDULED_AT = '1970-01-01T00:00:00.000Z';

export function getPlaceholderAuctionScheduleDate(): string {
  return PLACEHOLDER_AUCTION_SCHEDULED_AT;
}

export function isPlaceholderScheduleDate(date: string | null | undefined): boolean {
  if (date == null) return true;
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return true;
  return ts <= new Date(PLACEHOLDER_AUCTION_SCHEDULED_AT).getTime() + 1000;
}

const AUCTION_STATUS_PRIORITY: Record<string, number> = {
  completed: 3,
  live: 2,
  upcoming: 1,
  cancelled: 0,
};

export interface AuctionScheduleInfo extends AuctionCycleInfo {
  id?: string;
  chit_group_id?: string;
  closes_at?: string | null;
  min_bid?: number | null;
  max_bid?: number | null;
}

/** Admin saved bid range via SET UP / START AUCTION (not an auto-generated placeholder). */
export function isAuctionAdminConfigured(
  auction: Pick<AuctionScheduleInfo, 'min_bid' | 'max_bid'>,
): boolean {
  const min = Number(auction.min_bid ?? 0);
  const max = Number(auction.max_bid ?? 0);
  return min > 0 && max > min;
}

/** Auto-generated upcoming row with no admin configuration. */
export function isAuctionPlaceholder(
  auction: Pick<AuctionScheduleInfo, 'status' | 'min_bid'>,
): boolean {
  return auction.status === 'upcoming' && !isAuctionAdminConfigured(auction);
}

/** Configured upcoming whose close window has passed without going live. */
export function isStaleUnlaunchedAuction(
  auction: AuctionScheduleInfo,
  now = new Date(),
): boolean {
  if (auction.status !== 'upcoming' || !isAuctionAdminConfigured(auction)) return false;
  if (!auction.closes_at || isPlaceholderScheduleDate(auction.closes_at)) return false;
  return new Date(auction.closes_at).getTime() < now.getTime();
}

/** Show SCHEDULED on roadmap, cash collection, etc. */
export function isAuctionScheduledDisplay(
  auction: AuctionScheduleInfo,
  now = new Date(),
): boolean {
  if (auction.status !== 'upcoming') return false;
  if (!isAuctionAdminConfigured(auction)) return false;
  if (!auction.scheduled_at || isPlaceholderScheduleDate(auction.scheduled_at)) return false;
  return !isStaleUnlaunchedAuction(auction, now);
}

/** Show in admin Auctions tab "Scheduled Auctions" list. */
export function isAuctionScheduledForTab(
  auction: AuctionScheduleInfo,
  now = new Date(),
): boolean {
  return isAuctionScheduledDisplay(auction, now);
}

/** Suitable configured-upcoming fallback for live screen preview (not yet live). */
export function isAuctionConfiguredUpcoming(auction: AuctionScheduleInfo): boolean {
  return auction.status === 'upcoming'
    && isAuctionAdminConfigured(auction)
    && !!auction.scheduled_at
    && !isPlaceholderScheduleDate(auction.scheduled_at);
}

function auctionRowPriority(auction: AuctionScheduleInfo): number {
  return AUCTION_STATUS_PRIORITY[auction.status || ''] || 0;
}

/** Prefer completed > live > upcoming; among ties prefer admin-configured rows. */
export function dedupeAuctionRows<T extends AuctionScheduleInfo>(auctions: T[]): T[] {
  const map = new Map<string, T>();
  for (const auction of auctions) {
    if (auction.auction_number == null || !auction.chit_group_id) continue;
    const key = `${auction.chit_group_id}:${auction.auction_number}`;
    const existing = map.get(key);
    const nextPriority = auctionRowPriority(auction);
    const existingPriority = existing ? auctionRowPriority(existing) : -1;

    if (!existing || nextPriority > existingPriority) {
      map.set(key, auction);
      continue;
    }
    if (
      nextPriority === existingPriority
      && isAuctionAdminConfigured(auction)
      && !isAuctionAdminConfigured(existing)
    ) {
      map.set(key, auction);
    }
  }
  return Array.from(map.values());
}

export function filterScheduledUpcomingForTab<T extends AuctionScheduleInfo>(
  auctions: T[],
  now = new Date(),
): T[] {
  return dedupeAuctionRows(auctions)
    .filter((a) => isAuctionScheduledForTab(a, now))
    .sort(
      (a, b) =>
        new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime(),
    );
}

export function getPlaceholderRowsToSanitize<T extends AuctionScheduleInfo & { id?: string }>(
  auctions: T[],
): string[] {
  return auctions
    .filter(
      (a) =>
        isAuctionPlaceholder(a)
        && (
          (a.scheduled_at != null && !isPlaceholderScheduleDate(a.scheduled_at))
          || (a.closes_at != null && !isPlaceholderScheduleDate(a.closes_at))
        ),
    )
    .map((a) => a.id)
    .filter((id): id is string => !!id);
}

/** Reset fake schedule dates on auto-generated placeholder rows to the DB-safe sentinel. */
export async function sanitizePlaceholderAuctionSchedules(
  supabaseClient: { from: (table: string) => any },
  auctions: AuctionScheduleInfo[],
): Promise<boolean> {
  const ids = getPlaceholderRowsToSanitize(auctions);
  if (ids.length === 0) return false;

  const placeholderAt = getPlaceholderAuctionScheduleDate();
  const { error } = await supabaseClient
    .from('auctions')
    .update({ scheduled_at: placeholderAt, closes_at: placeholderAt })
    .in('id', ids);

  if (error) {
    console.error('Error sanitizing placeholder auctions:', error);
    return false;
  }
  return true;
}