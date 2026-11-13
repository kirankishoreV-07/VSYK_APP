import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { apiPostAdmin } from '../../../lib/api';
import { formatPaise } from '../../../lib/hooks/useDashboard';
import { filterAuctionHistory, historyMonth, type AuctionHistoryFilters } from '../../../lib/auctionHistorySearch';
import type { AuctionRow } from '../../../app/(admin)/auctions';
const defaults: AuctionHistoryFilters = { search: '', status: 'all', group: 'all', month: 'all', accounting: 'all', sort: 'newest' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
const money = (value: number | null | undefined) => value == null ? '—' : formatPaise(value);
function Choices({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (value: string) => void;
}) {
    return <View style={s.filter}>
    <Text style={s.label}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
      {options.map(option => <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)} style={[s.chip, option.value === value && s.selected]}>
        <Text style={[s.chipText, option.value === value && s.selectedText]}>{option.label}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}
export function AuctionHistoryPanel({ history }: {
    history: AuctionRow[];
}) {
    const [filters, setFilters] = useState(defaults);
    const [advanced, setAdvanced] = useState(false);
    const [limit, setLimit] = useState(20);
    const [selected, setSelected] = useState<string | null>(null);
    const matches = useMemo(() => filterAuctionHistory(history, filters), [history, filters]);
    const auction = history.find(row => row.id === selected);
    const groups = useMemo(() => Array.from(new Map(history.map(row => [row.chit_group_id, row.chit_groups?.name || 'Unnamed group'])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [history]);
    const months = useMemo(() => [...new Set(history.map(row => historyMonth(row.ended_at || row.scheduled_at)).filter(Boolean))].sort().reverse(), [history]);
    useEffect(() => { setLimit(20); }, [filters]);
    const completed = matches.filter(row => row.status === 'completed');
    const stats = [
        ['MATCHING RECORDS', String(matches.length)],
        ['COMPLETED', String(completed.length)],
        ['TOTAL PRIZE AMOUNT', money(completed.reduce((sum, row) => sum + Number(row.winner_prize_amount || 0), 0))],
        ['TOTAL DISCOUNT', money(completed.reduce((sum, row) => sum + Number(row.discount_amount || 0), 0))],
    ];
    const set = (key: keyof AuctionHistoryFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
    return <View style={{ gap: 14 }}>
    <View style={s.intro}><Text style={s.title}>Auction records</Text><Text style={s.muted}>Search results, settlement amounts and the recorded activity for every closed auction.</Text></View>
    <View style={s.search}>
      <TextInput style={s.searchInput} placeholder="Group, code, winner or cycle…" value={filters.search} onChangeText={value => set('search', value)} autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search auction history"/>
      {!!filters.search && <TouchableOpacity onPress={() => set('search', '')} style={s.clear} accessibilityLabel="Clear search"><Text style={s.link}>Clear</Text></TouchableOpacity>}
    </View>
    <Choices label="Status" value={filters.status} onChange={value => set('status', value)} options={[{ value: 'all', label: 'All records' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]}/>
    <View style={s.toolbar}>
      <TouchableOpacity style={s.outline} onPress={() => setAdvanced(value => !value)}><Text style={s.link}>{advanced ? 'Hide filters' : 'Group, month & sort'}</Text></TouchableOpacity>
      <TouchableOpacity style={s.clear} onPress={() => setFilters(defaults)}><Text style={s.link}>Reset all</Text></TouchableOpacity>
    </View>
    {advanced && <View style={s.filterBox}>
      <Choices label="Chit group" value={filters.group} onChange={value => set('group', value)} options={[{ value: 'all', label: 'All groups' }, ...groups.map(([value, label]) => ({ value, label }))]}/>
      <Choices label="Month (IST)" value={filters.month} onChange={value => set('month', value)} options={[{ value: 'all', label: 'Any month' }, ...months.map(value => ({ value, label: new Date(`${value}-01T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric' }) }))]}/>
      <Choices label="Accounting type" value={filters.accounting} onChange={value => set('accounting', value)} options={[{ value: 'all', label: 'Both types' }, { value: 'accounted', label: 'Accounted' }, { value: 'unaccounted', label: 'Unaccounted' }]}/>
      <Choices label="Sort records" value={filters.sort} onChange={value => set('sort', value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'discount', label: 'Highest discount' }, { value: 'prize', label: 'Highest prize' }]}/>
    </View>}
    {!advanced && (filters.group !== 'all' || filters.month !== 'all' || filters.accounting !== 'all' || filters.sort !== 'newest') && <Text style={s.muted}>Additional filters applied · open filters to review.</Text>}
    <View style={s.grid}>{stats.map(([label, value]) => <View key={label} style={s.cell}><Text style={s.label}>{label}</Text><Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>)}</View>
    <Text style={s.muted}>Showing {Math.min(limit, matches.length)} of {matches.length} records · Tap a record for its timeline.</Text>
    {matches.slice(0, limit).map(row => <TouchableOpacity key={row.id} style={s.card} onPress={() => setSelected(row.id)} activeOpacity={0.8} accessibilityLabel={`View ${row.chit_groups?.name}, auction ${row.auction_number}`}>
      <View style={s.row}><View style={{ flex: 1 }}><Text style={s.group}>{row.chit_groups?.name || 'Unnamed group'}</Text><Text style={s.muted}>{row.chit_groups?.group_code || '—'} · Cycle {row.auction_number ?? '—'}</Text></View><Text style={[s.badge, row.status === 'cancelled' && s.cancelled]}>{row.status.toUpperCase()}</Text></View>
      <Text style={s.muted}>{date(row.ended_at || row.scheduled_at)}</Text>
      {row.status === 'completed' ? <><Text style={s.winner}>Winner: {row._winner_display || row.winner_name || 'Not recorded'}</Text><View style={s.grid}>
        {([['Prize amount', row.winner_prize_amount], ['Discount', row.discount_amount], ['Dividend / member', row.dividend_amount], ['Due / member', row.final_due_amount]] as const).map(([label, value]) => <View key={label} style={s.cell}><Text style={s.label}>{label}</Text><Text style={s.amount}>{money(value)}</Text></View>)}
      </View></> : <Text style={s.muted}>Cancelled auction · no completed settlement shown.</Text>}
      <View style={s.row}><Text style={s.muted}>{row._bid_count ?? 0} non-retracted bids</Text><Text style={s.link}>View activity →</Text></View>
    </TouchableOpacity>)}
    {!matches.length && <View style={s.card}><Text style={s.group}>No matching auctions</Text><Text style={s.muted}>Clear the search or adjust the filters. Live and upcoming auctions are shown in their own tabs.</Text></View>}
    {matches.length > limit && <TouchableOpacity style={s.outline} onPress={() => setLimit(value => value + 20)}><Text style={s.link}>Load 20 more records</Text></TouchableOpacity>}
    <Modal visible={!!auction} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      {auction && <HistoryDetails auction={auction} onClose={() => setSelected(null)}/>}
    </Modal>
  </View>;
}
async function readPages(table: string, fields: string, auctionId: string, order: string) {
    const rows: any[] = [];
    for (let offset = 0;; offset += 500) {
        const { data, error } = await supabase.from(table).select(fields).eq('auction_id', auctionId).order(order, { ascending: true }).order('id', { ascending: true }).range(offset, offset + 499);
        if (error)
            throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500)
            return rows;
    }
}
function HistoryDetails({ auction, onClose }: {
    auction: AuctionRow;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<'timeline' | 'bids'>('timeline');
    const [search, setSearch] = useState('');
    const [bidFilter, setBidFilter] = useState('all');
    const [limit, setLimit] = useState(40);
    const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ['admin', 'auction-history-activity', auction.id], queryFn: async () => {
            const [bids, eventResult, payouts] = await Promise.all([
                readPages('auction_bids', 'id, customer_id, bidder_name, bid_amount, placed_at, is_retracted, retracted_at', auction.id, 'placed_at'),
                apiPostAdmin<{
                    events: {
                        id: string;
                        event_type: string;
                        performed_by: string | null;
                        notes: string | null;
                        created_at: string;
                    }[];
                }>(`/api/admin/auctions/${auction.id}/history-events`, {}),
                readPages('auction_prize_settlements', 'id, amount, notes, recorded_at', auction.id, 'recorded_at'),
            ]);
            const customerIds = [...new Set(bids.map(bid => bid.customer_id).filter(Boolean))];
            const names = new Map<string, string>();
            for (let offset = 0; offset < customerIds.length; offset += 100) {
                const { data: customers, error } = await supabase.from('customers').select('id, full_name').in('id', customerIds.slice(offset, offset + 100));
                if (error)
                    throw error;
                for (const customer of customers || [])
                    names.set(customer.id, customer.full_name);
            }
            return { events: eventResult.events, payouts, bids: bids.map(bid => ({ ...bid, name: bid.bidder_name || names.get(bid.customer_id) || 'Customer name not recorded' })) };
        }, staleTime: 10000 });
    useEffect(() => { setLimit(40); }, [tab, search, bidFilter]);
    const timeline = useMemo(() => {
        const rows = (data?.events || []).map(event => ({ id: `event-${event.id}`, at: event.created_at, title: event.event_type.replace(/_/g, ' '), detail: [event.performed_by, event.notes].filter(Boolean).join(' · ') }));
        for (const bid of data?.bids || []) {
            rows.push({ id: `bid-${bid.id}`, at: bid.placed_at, title: 'Bid placed', detail: `${bid.name} · ${money(bid.bid_amount)}` });
            if (bid.is_retracted && bid.retracted_at)
                rows.push({ id: `retracted-${bid.id}`, at: bid.retracted_at, title: 'Bid retracted', detail: `${bid.name} · ${money(bid.bid_amount)}` });
        }
        for (const payout of data?.payouts || [])
            rows.push({ id: `payout-${payout.id}`, at: payout.recorded_at, title: 'Prize payout recorded', detail: [money(payout.amount), payout.notes].filter(Boolean).join(' · ') });
        return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
    }, [data]);
    const filteredBids = (data?.bids || []).filter(bid => (bidFilter === 'all' || (bidFilter === 'retracted' ? bid.is_retracted : !bid.is_retracted)) && bid.name.toLowerCase().includes(search.trim().toLowerCase())).slice().reverse();
    return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.detailHeader}><View style={{ flex: 1 }}><Text style={s.group}>{auction.chit_groups?.name} · Cycle {auction.auction_number}</Text><Text style={s.muted}>Auction record · {auction.status}</Text></View><TouchableOpacity style={s.clear} onPress={onClose}><Text style={s.link}>Close</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={s.detailBody} keyboardShouldPersistTaps="handled">
      <View style={s.card}><Text style={s.group}>Auction schedule</Text><Text style={s.muted}>Scheduled: {date(auction.scheduled_at)}</Text><Text style={s.muted}>Closing time: {date(auction.closes_at)}</Text><Text style={s.muted}>Ended: {date(auction.ended_at)}</Text><Text style={s.muted}>Times shown in IST. Prize amount is the entitlement, not confirmation of payout.</Text></View>
      {!!data && auction.status === 'completed' && <View style={s.grid}><View style={s.cell}><Text style={s.label}>PRIZE PAYOUT RECORDED</Text><Text style={s.amount}>{money(data.payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0))}</Text></View><View style={s.cell}><Text style={s.label}>PRIZE REMAINING</Text><Text style={s.amount}>{money(Math.max(0, Number(auction.winner_prize_amount || 0) - data.payouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0)))}</Text></View></View>}
      <Choices label="Activity records" value={tab} onChange={value => setTab(value as 'timeline' | 'bids')} options={[{ value: 'timeline', label: `Timeline (${timeline.length})` }, { value: 'bids', label: `Bids (${data?.bids.length || 0})` }]}/>
      <TouchableOpacity style={s.outline} disabled={isRefetching} onPress={() => { void refetch(); }}><Text style={s.link}>{isRefetching ? 'Refreshing…' : 'Refresh activity'}</Text></TouchableOpacity>
      {isLoading ? <ActivityIndicator color="#005E7D"/> : error ? <Text style={s.error}>Could not load activity. Tap Refresh activity to retry.</Text> : tab === 'timeline' ? <>
        {!timeline.length && <Text style={s.muted}>No activity events were saved for this auction.</Text>}
        {timeline.slice(0, limit).map(item => <View key={item.id} style={s.event}><Text style={s.label}>{date(item.at)}</Text><Text style={s.eventTitle}>{item.title}</Text>{!!item.detail && <Text style={s.muted}>{item.detail}</Text>}</View>)}
      </> : <>
        <TextInput style={s.search} placeholder="Search bidder name…" value={search} onChangeText={setSearch} autoCorrect={false}/>
        <Choices label="Bid status" value={bidFilter} onChange={setBidFilter} options={[{ value: 'all', label: 'All bids' }, { value: 'valid', label: 'Not retracted' }, { value: 'retracted', label: 'Retracted' }]}/>
        {filteredBids.slice(0, limit).map(bid => <View key={bid.id} style={s.card}><View style={s.row}><Text style={[s.group, { flex: 1 }]}>{bid.name}</Text><Text style={s.amount}>{money(bid.bid_amount)}</Text></View><Text style={s.muted}>{date(bid.placed_at)}</Text><Text style={bid.is_retracted ? s.error : s.link}>{bid.is_retracted ? 'Retracted' : 'Not retracted'}</Text></View>)}
        {!filteredBids.length && <Text style={s.muted}>No bids match these filters.</Text>}
      </>}
      {(tab === 'timeline' ? timeline.length : filteredBids.length) > limit && <TouchableOpacity style={s.outline} onPress={() => setLimit(value => value + 40)}><Text style={s.link}>Load more activity</Text></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, intro: { gap: 5 }, title: { fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', color: '#0B1C30' },
    muted: { fontSize: 12, lineHeight: 18, color: '#64748B', fontFamily: 'Inter_400Regular' }, label: { fontSize: 10, lineHeight: 15, color: '#64748B', fontFamily: 'Inter_600SemiBold' },
    search: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#D8E2EA', backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, fontSize: 14, color: '#0B1C30', minWidth: 0 }, clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
    filter: { gap: 6 }, chips: { gap: 8 }, chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EA', backgroundColor: '#FFF' }, selected: { backgroundColor: '#005E7D', borderColor: '#005E7D' }, chipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#475569' }, selectedText: { color: '#FFF' },
    toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, outline: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#B8D5DE', backgroundColor: '#FFF' }, link: { fontSize: 12, color: '#005E7D', fontFamily: 'Inter_600SemiBold' }, filterBox: { gap: 14, padding: 14, borderRadius: 14, backgroundColor: '#EEF5F8' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, cell: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 12, backgroundColor: '#F1F6F8', gap: 5 }, value: { fontSize: 21, fontFamily: 'SpaceGrotesk_700Bold', color: '#005E7D' }, amount: { fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#005E7D' },
    card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' }, group: { fontSize: 16, lineHeight: 22, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#0B1C30' }, badge: { fontSize: 9, color: '#005E7D', backgroundColor: '#E0F2FE', padding: 7, borderRadius: 8, overflow: 'hidden' }, cancelled: { color: '#B91C1C', backgroundColor: '#FEE2E2' }, winner: { fontSize: 14, color: '#0F766E', fontFamily: 'Inter_600SemiBold' },
    detailHeader: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' }, detailBody: { padding: 16, gap: 14, paddingBottom: 40 }, event: { padding: 14, gap: 5, borderLeftWidth: 3, borderLeftColor: '#005E7D', backgroundColor: '#FFF', borderRadius: 8 }, eventTitle: { fontSize: 14, textTransform: 'capitalize', fontFamily: 'Inter_600SemiBold', color: '#0B1C30' }, error: { fontSize: 12, lineHeight: 18, color: '#B91C1C' },
});
