export type AuctionHistoryFilters = {
    search: string;
    status: string;
    group: string;
    month: string;
    accounting: string;
    sort: 'newest' | 'oldest' | 'discount' | 'prize';
};
type HistoryRecord = {
    id: string;
    chit_group_id: string;
    auction_number: number | null;
    status: string;
    ended_at: string | null;
    scheduled_at: string | null;
    winner_name: string | null;
    _winner_display?: string;
    discount_amount: number;
    winner_prize_amount: number;
    chit_groups: {
        name: string;
        group_code: string;
        accounting_type?: string;
    } | null;
};
export function historyMonth(date: string | null): string {
    if (!date || !Number.isFinite(Date.parse(date)))
        return '';
    return new Date(Date.parse(date) + 330 * 60000).toISOString().slice(0, 7);
}
export function filterAuctionHistory<T extends HistoryRecord>(rows: T[], filters: AuctionHistoryFilters): T[] {
    const words = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const timestamp = (row: T) => Date.parse(row.ended_at || row.scheduled_at || '') || 0;
    return rows.filter(row => {
        if (!['completed', 'cancelled'].includes(row.status))
            return false;
        if (filters.status !== 'all' && row.status !== filters.status)
            return false;
        if (filters.group !== 'all' && row.chit_group_id !== filters.group)
            return false;
        if (filters.accounting !== 'all' && row.chit_groups?.accounting_type !== filters.accounting)
            return false;
        if (filters.month !== 'all' && historyMonth(row.ended_at || row.scheduled_at) !== filters.month)
            return false;
        const haystack = [row.chit_groups?.name, row.chit_groups?.group_code, row.winner_name, row._winner_display, `auction #${row.auction_number} cycle ${row.auction_number}`].join(' ').toLowerCase();
        return words.every(word => haystack.includes(word));
    }).sort((a, b) => {
        const order = filters.sort === 'oldest' ? timestamp(a) - timestamp(b)
            : filters.sort === 'discount' ? Number(b.discount_amount || 0) - Number(a.discount_amount || 0)
                : filters.sort === 'prize' ? Number(b.winner_prize_amount || 0) - Number(a.winner_prize_amount || 0)
                    : timestamp(b) - timestamp(a);
        return order || a.id.localeCompare(b.id);
    });
}
