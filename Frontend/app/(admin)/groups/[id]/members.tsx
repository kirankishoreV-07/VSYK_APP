import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { dedupeAuctionCycles } from '../../../../lib/chitPayments';
import { AuctionSettlementModal } from '../../customers/_components/AuctionSettlementModal';
import {
  GroupMemberPaymentModal,
  type GroupMemberWithTicket,
} from '../_components/GroupMemberPaymentModal';
import { useAdminParentBack } from '../../../../lib/hooks/admin/useAdminParentBack';

export default function GroupMembersPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const handleParentBack = useAdminParentBack(`/(admin)/groups/${String(id || '')}` as any);
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMember, setSelectedMember] = useState<GroupMemberWithTicket | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAuction, setSettlementAuction] = useState<any>(null);

  const totalShares = members.reduce((sum, m) => sum + (Number(m.participation_share) || 1), 0);
  const memberCount = members.length;

  const deduplicatedAuctions = useMemo(
    () => dedupeAuctionCycles(auctions) as typeof auctions,
    [auctions],
  );

  const fetchGroup = useCallback(async () => {
    try {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(id));
      let query = supabase.from('chit_groups').select('*');

      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('group_code', id);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      if (data) setGroup(data);
    } catch (err) {
      console.error('Error fetching group:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchMembers = useCallback(async () => {
    if (!group?.id) return;
    try {
      const { data } = await supabase
        .from('chit_members')
        .select('*, customers(full_name, phone, customer_id)')
        .eq('chit_group_id', group.id)
        .order('ticket_number', { ascending: true });
      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, [group?.id]);

  const fetchAuctions = useCallback(async () => {
    if (!group?.id) return;
    try {
      const { data } = await supabase
        .from('auctions')
        .select('*')
        .eq('chit_group_id', group.id)
        .order('auction_number', { ascending: false });
      setAuctions(data || []);
    } catch (err) {
      console.error('Error fetching auctions:', err);
    }
  }, [group?.id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    if (group?.id) {
      fetchMembers();
      fetchAuctions();
    }
  }, [group?.id, fetchMembers, fetchAuctions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroup();
    await fetchMembers();
    await fetchAuctions();
    setRefreshing(false);
  };

  const openMemberTransactions = (member: any, displayTicket: number) => {
    setSelectedMember({ ...member, display_ticket: displayTicket });
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedMember(null);
  };

  const handleOpenSettlement = (auction: any) => {
    const open = () => {
      setSettlementAuction(auction);
      setShowSettlementModal(true);
    };

    if (auction.status === 'live') {
      Alert.alert(
        'Manual Settlement',
        'This auction is currently live in the app. Only use manual settlement if it was conducted outside the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: open },
        ],
      );
      return;
    }

    open();
  };

  const openSettlementForMonth = (monthNumber: number) => {
    const auction = deduplicatedAuctions.find((a) => a.auction_number === monthNumber);
    if (!auction) {
      Alert.alert(
        'Auction not found',
        `No auction record found for cycle ${monthNumber}. Set up the auction first.`,
      );
      return;
    }
    handleOpenSettlement(auction);
  };

  const handleBack = () => {
    handleParentBack();
  };

  if (loading && !group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#005E7D" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to group details"
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#0F172A">
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <AppLogo size={36} />
        <View style={styles.headerTitleBox}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {group?.name || 'Group'}
          </Text>
          <Text style={styles.appBarSubtitle}>Enrolled Members</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005E7D" />
        }
      >
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>Enrolled Members ({members.length})</Text>
          <Text style={styles.sectionHelper}>Tap a member to view transaction history.</Text>

          {members.length === 0 ? (
            <Text style={styles.emptyNote}>
              No members enrolled yet.
            </Text>
          ) : (
            members.map((m, index) => {
              const displayTicket = index + 1;
              const name = m.customers?.full_name || `Member #${displayTicket}`;
              const initial = name.charAt(0).toUpperCase();
              const isHalf = m.participation_type === 'half';

              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberCard}
                  onPress={() => openMemberTransactions(m, displayTicket)}
                >
                  <View style={styles.memberInfo}>
                    <View style={styles.avatarMini}>
                      <Text style={styles.avatarMiniText}>{initial}</Text>
                    </View>
                    <View>
                      <Text style={styles.memberName}>{name}</Text>
                      <View style={styles.memberMeta}>
                        <Text style={styles.memberId}>Ticket #{displayTicket}</Text>
                        <View style={[styles.partBadge, { backgroundColor: isHalf ? '#FEF2F2' : '#EFF6FF' }]}>
                          <Text style={[styles.partBadgeText, { color: isHalf ? '#DC2626' : '#2563EB' }]}>
                            {isHalf ? '½ Share' : '1 Share'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="#CBD5E1">
                    <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                  </Svg>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <GroupMemberPaymentModal
        visible={showPaymentModal}
        member={selectedMember}
        group={group}
        deduplicatedAuctions={deduplicatedAuctions}
        onClose={handleClosePaymentModal}
        onMemberRemoved={fetchMembers}
        onRequestSettlement={openSettlementForMonth}
      />

      <AuctionSettlementModal
        visible={showSettlementModal}
        auction={settlementAuction}
        group={group}
        members={members}
        memberCount={memberCount}
        totalShares={totalShares}
        onClose={() => {
          setShowSettlementModal(false);
          setSettlementAuction(null);
        }}
        onSaved={() => {
          setShowSettlementModal(false);
          setSettlementAuction(null);
          fetchAuctions();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1 },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0F172A' },
  appBarSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  membersSection: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 16,
    color: '#164E63',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHelper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    marginLeft: 4,
  },
  emptyNote: {
    fontFamily: 'Inter_400Regular',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 24,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#005E7D' },
  memberName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  memberId: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  partBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  partBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
});
