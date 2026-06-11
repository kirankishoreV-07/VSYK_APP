import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { ChitMember, Auction, AuctionParticipant, AuctionPrizeSettlement } from './types';
import { formatPaise, formatDateIST } from './utils';
import { isMemberAuctionWinner, WINNER_HIGHLIGHT } from '../../../../lib/auctionWinner';

interface AuctionsTabProps {
    memberships: ChitMember[];
    auctions: Auction[];
    participants: AuctionParticipant[];
    prizeSettlements?: AuctionPrizeSettlement[];  // Actual disbursed prize payouts (partials supported)
}

type FilterType = 'all' | 'won' | 'participated' | 'not_participated';

export function AuctionsTab({ memberships, auctions, participants, prizeSettlements = [] }: AuctionsTabProps) {
    const [filter, setFilter] = useState<FilterType>('all');

    // Build auction timeline for this customer - ONLY COMPLETED AUCTIONS
    const auctionTimeline = useMemo(() => {
        const groupIds = memberships.map(m => m.chit_group_id);

        // Filter: Only completed auctions
        const completedAuctions = auctions.filter(a =>
            groupIds.includes(a.chit_group_id) &&
            a.status === 'completed'
        );

        return completedAuctions
            .map(auction => {
                const membership = memberships.find(m => m.chit_group_id === auction.chit_group_id);
                const participated = participants.some(p => p.auction_id === auction.id);
                const won = membership ? isMemberAuctionWinner(auction, membership.id) : false;

                let outcome: 'won' | 'participated' | 'not_participated';
                if (won) {
                    outcome = 'won';
                } else if (participated) {
                    outcome = 'participated';
                } else {
                    outcome = 'not_participated';
                }

                // Calculate discount applied to this customer
                const memberCount = membership?.chit_groups?.duration_months || 1;
                const discountPerMember = auction.discount_amount ? auction.discount_amount / memberCount : 0;

                // NEW: Prize settlement / payout info for won auctions (partials)
                let prizeSettled = 0;
                let prizeRemaining = 0;
                let prizeStatus: 'FULLY PAID' | 'PARTIAL' | 'PENDING' | null = null;
                if (won && membership && auction.winner_prize_amount) {
                    const relevant = prizeSettlements.filter(
                        (ps) => ps.auction_id === auction.id && ps.chit_member_id === membership.id
                    );
                    prizeSettled = relevant.reduce((sum, ps) => sum + (ps.amount || 0), 0);
                    prizeRemaining = Math.max(0, (auction.winner_prize_amount || 0) - prizeSettled);
                    if (prizeRemaining <= 0 && prizeSettled > 0) prizeStatus = 'FULLY PAID';
                    else if (prizeSettled > 0) prizeStatus = 'PARTIAL';
                    else prizeStatus = 'PENDING';
                }

                return {
                    auctionId: auction.id,
                    groupName: membership?.chit_groups?.name || 'Unknown',
                    cycle: auction.auction_number || 0,
                    date: auction.ended_at || auction.scheduled_at,
                    outcome,
                    winningBid: auction.winner_prize_amount,
                    discountApplied: won ? auction.winner_prize_amount || 0 : discountPerMember,
                    winnerName: auction.winner_name,
                    totalDiscount: auction.discount_amount,
                    // Prize payout fields
                    prizeSettled,
                    prizeRemaining,
                    prizeStatus,
                };
            })
            .filter(item => {
                if (filter === 'all') return true;
                if (filter === 'won') return item.outcome === 'won';
                if (filter === 'participated') return item.outcome === 'participated';
                if (filter === 'not_participated') return item.outcome === 'not_participated';
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [memberships, auctions, participants, prizeSettlements, filter]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Summary Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>TOTAL AUCTIONS</Text>
                    <Text style={styles.statValue}>{auctionTimeline.length}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>AUCTIONS WON</Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                        {auctionTimeline.filter(a => a.outcome === 'won').length}
                    </Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>PARTICIPATED</Text>
                    <Text style={[styles.statValue, { color: '#0EA5E9' }]}>
                        {auctionTimeline.filter(a => a.outcome === 'participated').length}
                    </Text>
                </View>
            </View>

            {/* Filter Chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersScroll}
                contentContainerStyle={styles.filtersContent}
            >
                {(['all', 'won', 'participated', 'not_participated'] as const).map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterChip, filter === f && styles.filterChipActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                            {f === 'all' ? 'All Auctions' :
                                f === 'won' ? 'Won' :
                                    f === 'participated' ? 'Participated' :
                                        'Did Not Bid'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Auction Timeline</Text>

            {auctionTimeline.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="#94A3B8">
                        <Path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No Completed Auctions</Text>
                    <Text style={styles.emptyText}>
                        {filter === 'all'
                            ? 'This customer has no completed auction history yet.'
                            : `No auctions match the "${filter}" filter.`}
                    </Text>
                </View>
            ) : (
                <View style={styles.timeline}>
                    {auctionTimeline.map((item, index) => {
                        const outcomeColor =
                            item.outcome === 'won' ? WINNER_HIGHLIGHT.dot :
                                item.outcome === 'participated' ? '#0EA5E9' :
                                    '#94A3B8';

                        const outcomeBg =
                            item.outcome === 'won' ? WINNER_HIGHLIGHT.badgeBg :
                                item.outcome === 'participated' ? '#E0F2FE' :
                                    '#F1F5F9';

                        return (
                            <View key={item.auctionId} style={styles.timelineItem}>
                                {/* Timeline Connector */}
                                <View style={styles.timelineConnector}>
                                    <View style={[styles.timelineDot, { backgroundColor: outcomeColor }]} />
                                    {index < auctionTimeline.length - 1 && (
                                        <View style={styles.timelineLine} />
                                    )}
                                </View>

                                {/* Auction Card */}
                                <View style={[
                                    styles.auctionCard,
                                    item.outcome === 'won' && styles.auctionCardWinner,
                                ]}>
                                    <View style={styles.auctionHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.auctionGroup}>{item.groupName}</Text>
                                            <Text style={styles.auctionMeta}>
                                                Cycle {item.cycle} • {formatDateIST(item.date)}
                                            </Text>
                                        </View>
                                        <View style={[
                                            styles.outcomeBadge,
                                            {
                                                backgroundColor: outcomeBg,
                                                borderWidth: item.outcome === 'won' ? 1 : 0,
                                                borderColor: item.outcome === 'won' ? WINNER_HIGHLIGHT.border : 'transparent',
                                            },
                                        ]}>
                                            <Text style={[styles.outcomeBadgeText, { color: outcomeColor }]}>
                                                {item.outcome === 'won' ? 'WINNER' :
                                                    item.outcome === 'participated' ? 'BID' :
                                                        'NO BID'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.auctionDetails}>
                                        {item.outcome === 'won' && item.winningBid !== null && item.winningBid !== undefined && (
                                            <View style={styles.detailRow}>
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#10B981" style={styles.detailIcon}>
                                                    <Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                                                </Svg>
                                                <Text style={styles.detailLabel}>Prize Received:</Text>
                                                <Text style={[styles.detailValue, { color: '#10B981', fontFamily: 'SpaceGrotesk_600SemiBold' }]}>
                                                    {formatPaise(item.winningBid)}
                                                </Text>
                                            </View>
                                        )}

                                        {/* NEW: Actual prize settlement / payout tracking (partials) for won auctions */}
                                        {item.outcome === 'won' && item.prizeStatus && (
                                            <View style={[styles.detailRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' }]}>
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#01789E" style={styles.detailIcon}>
                                                    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                                </Svg>
                                                <Text style={styles.detailLabel}>Prize Payout:</Text>
                                                <Text style={[styles.detailValue, { color: item.prizeStatus === 'FULLY PAID' ? '#16A34A' : item.prizeStatus === 'PARTIAL' ? '#B45309' : '#DC2626', fontFamily: 'SpaceGrotesk_600SemiBold' }]}>
                                                    {item.prizeStatus} {item.prizeSettled > 0 ? `(${formatPaise(item.prizeSettled)})` : ''}
                                                </Text>
                                            </View>
                                        )}
                                        {item.outcome === 'won' && item.prizeStatus && item.prizeRemaining > 0 && (
                                            <View style={styles.detailRow}>
                                                <Text style={[styles.detailLabel, { marginLeft: 20 }]}>Remaining to receive:</Text>
                                                <Text style={[styles.detailValue, { color: '#DC2626' }]}>
                                                    {formatPaise(item.prizeRemaining)}
                                                </Text>
                                            </View>
                                        )}
                                        {item.outcome !== 'won' && item.totalDiscount !== null && item.totalDiscount !== undefined && (
                                            <View style={styles.detailRow}>
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#F59E0B" style={styles.detailIcon}>
                                                    <Path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                                                </Svg>
                                                <Text style={styles.detailLabel}>Total Discount:</Text>
                                                <Text style={[styles.detailValue, { color: '#F59E0B', fontFamily: 'SpaceGrotesk_600SemiBold' }]}>
                                                    {formatPaise(item.totalDiscount)}
                                                </Text>
                                            </View>
                                        )}
                                        {item.outcome === 'won' ? (
                                            <View style={styles.detailRow}>
                                                <Text style={[styles.detailLabel, { color: WINNER_HIGHLIGHT.text }]}>
                                                    You won this auction cycle
                                                </Text>
                                            </View>
                                        ) : item.outcome === 'participated' ? (
                                            <View style={styles.detailRow}>
                                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="#0EA5E9" style={styles.detailIcon}>
                                                    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                                                </Svg>
                                                <Text style={styles.detailLabel}>Your Dividend:</Text>
                                                <Text style={[styles.detailValue, { color: '#0EA5E9', fontFamily: 'SpaceGrotesk_600SemiBold' }]}>
                                                    {formatPaise(item.discountApplied)}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F8FAFC',
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        color: '#94A3B8',
        marginBottom: 4,
    },
    statValue: {
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 24,
        color: '#0B1C30',
    },
    filtersScroll: {
        marginBottom: 20,
    },
    filtersContent: {
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 100,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    filterChipActive: {
        backgroundColor: '#01789E',
        borderColor: '#01789E',
    },
    filterChipText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        color: '#64748B',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    sectionTitle: {
        fontFamily: 'SpaceGrotesk_600SemiBold',
        fontSize: 18,
        color: '#164E63',
        marginBottom: 20,
    },
    timeline: {
        paddingLeft: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    timelineConnector: {
        width: 40,
        alignItems: 'center',
        marginRight: 16,
    },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    timelineDotIcon: {
        fontSize: 14,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#E2E8F0',
        marginTop: 4,
    },
    auctionCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#01789E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    auctionCardWinner: {
        backgroundColor: WINNER_HIGHLIGHT.bg,
        borderColor: WINNER_HIGHLIGHT.borderStrong,
        borderWidth: 2,
    },
    auctionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    auctionGroup: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginBottom: 4,
    },
    auctionMeta: {
        fontFamily: 'Inter_500Medium',
        fontSize: 13,
        color: '#94A3B8',
    },
    outcomeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        alignSelf: 'flex-start',
    },
    outcomeBadgeText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 11,
        letterSpacing: 0.5,
    },
    auctionDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailIcon: {
        marginRight: 4,
    },
    detailLabel: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: '#64748B',
        flex: 1,
    },
    detailValue: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
        color: '#0B1C30',
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: '#0B1C30',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
});
