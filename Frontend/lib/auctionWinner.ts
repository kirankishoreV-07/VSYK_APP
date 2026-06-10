/** Highlight styling + helpers when a member won an auction cycle. */

export const WINNER_HIGHLIGHT = {
  bg: '#FFFBEB',
  border: '#FCD34D',
  borderStrong: '#F59E0B',
  accent: '#B45309',
  badgeBg: '#FEF3C7',
  badgeText: '#92400E',
  dot: '#F59E0B',
  text: '#92400E',
};

export type AuctionWinnerRef = {
  winner_member_id?: string | null;
  auction_number?: number | null;
  status?: string | null;
};

function normalizeId(id: string | null | undefined): string | null {
  if (id == null) return null;
  const value = String(id).trim();
  return value.length > 0 ? value : null;
}

/** True only when this specific chit_members.id won a completed auction cycle. */
export function isMemberAuctionWinner(
  auction: AuctionWinnerRef | null | undefined,
  membershipId: string | null | undefined,
): boolean {
  if (!auction) return false;
  const memberId = normalizeId(membershipId);
  const winnerId = normalizeId(auction.winner_member_id);
  if (!memberId || !winnerId) return false;
  return auction.status === 'completed' && winnerId === memberId;
}

export function getMemberWonAuctionNumbers(
  auctions: AuctionWinnerRef[],
  membershipId: string | null | undefined,
): Set<number> {
  const won = new Set<number>();
  if (!membershipId) return won;
  for (const auction of auctions) {
    if (isMemberAuctionWinner(auction, membershipId) && auction.auction_number != null) {
      won.add(auction.auction_number);
    }
  }
  return won;
}

export function getMemberWonAuctions<T extends AuctionWinnerRef>(
  auctions: T[],
  membershipId: string | null | undefined,
): T[] {
  if (!membershipId) return [];
  return auctions.filter((a) => isMemberAuctionWinner(a, membershipId));
}

export type WinnerMemberRef = {
  id: string;
  ticket_number?: string | null;
  customers?: { full_name?: string | null } | null;
};

/** Resolve display name for auction winner (admin views). */
export function getAuctionWinnerDisplayName(
  auction: {
    winner_name?: string | null;
    winner_member_id?: string | null;
  },
  members: WinnerMemberRef[] = [],
): string {
  const stored = auction.winner_name?.trim();
  if (stored) return stored;

  const winnerId = normalizeId(auction.winner_member_id);
  if (winnerId) {
    const member = members.find((m) => normalizeId(m.id) === winnerId);
    const fullName = member?.customers?.full_name?.trim();
    if (fullName) return fullName;
    if (member?.ticket_number) return `Ticket #${member.ticket_number}`;
  }

  return '—';
}