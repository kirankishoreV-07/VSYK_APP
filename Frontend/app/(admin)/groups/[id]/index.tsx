import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../../components/AppLogo';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiPostAdmin } from '../../../../lib/api';
import { AuctionSettlementModal } from '../../customers/_components/AuctionSettlementModal';
import { RecordPrizeSettlementModal } from '../../customers/_components/RecordPrizeSettlementModal';
import { PrizeSettlementDetailsModal } from '../../customers/_components/PrizeSettlementDetailsModal';
import { getAuctionWinnerDisplayName } from '../../../../lib/auctionWinner';
import {
  dedupeAuctionCycles,
  getMemberDueAfterAuction,
  ensureBaseSchedulesForMember,
} from '../../../../lib/chitPayments';
import {
  isAuctionScheduledDisplay,
  sanitizePlaceholderAuctionSchedules,
  getPlaceholderAuctionScheduleDate,
} from '../../../../lib/auctionUtils';
import { useAdminParentBack } from '../../../../lib/hooks/admin/useAdminParentBack';

// ── Step3Review: extracted to avoid IIFE JSX parsing issues ──
function Step3Review({
  tempScheduledAt, tempClosesAt, tempMinBid, tempMaxBid, groupValue,
  isValidatingSchedule, onBack, onSave, onLaunch,
  formatDate, formatTime, formatRupees, styles,
}: {
  tempScheduledAt: Date; tempClosesAt: Date; tempMinBid: string; tempMaxBid: string;
  groupValue: number; isValidatingSchedule: boolean;
  onBack: () => void; onSave: () => void; onLaunch: () => void;
  formatDate: (v: any) => string; formatTime: (v: any) => string;
  formatRupees: (v: number) => string; styles: any;
}) {
  const isGoingLive = tempScheduledAt.getTime() <= Date.now() + 60000;
  const durationMins = Math.round((tempClosesAt.getTime() - tempScheduledAt.getTime()) / 60000);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={styles.prepStepTitle}>{isGoingLive ? 'Ready to Launch?' : 'Confirm Schedule'}</Text>
        <Text style={styles.prepStepSub}>
          {isGoingLive
            ? 'The auction will go live immediately and members can start bidding.'
            : 'Review details before scheduling. You can edit before it goes live.'}
        </Text>
      </View>

      <View style={[styles.prepCard, { gap: 0 }]}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{isGoingLive ? 'Live For' : 'Opens'}</Text>
          <Text style={styles.reviewVal}>
            {isGoingLive ? `${durationMins} minutes` : `${formatDate(tempScheduledAt)} · ${formatTime(tempScheduledAt)}`}
          </Text>
        </View>
        <View style={styles.reviewDivider} />
        {!isGoingLive && (
          <>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Closes</Text>
              <Text style={styles.reviewVal}>{formatDate(tempClosesAt)} · {formatTime(tempClosesAt)}</Text>
            </View>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Duration</Text>
              <Text style={styles.reviewVal}>{durationMins} minutes</Text>
            </View>
            <View style={styles.reviewDivider} />
          </>
        )}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Discount Range</Text>
          <Text style={styles.reviewVal}>
            {formatRupees(Number(tempMinBid) * 100)} – {formatRupees(Number(tempMaxBid) * 100)}
          </Text>
        </View>
        <View style={styles.reviewDivider} />
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Chit Value</Text>
          <Text style={styles.reviewVal}>{formatRupees(groupValue)}</Text>
        </View>
      </View>

      {isGoingLive ? (
        <TouchableOpacity
          style={[styles.launchBtn, { backgroundColor: '#10B981' }, isValidatingSchedule && { opacity: 0.7 }]}
          onPress={onLaunch}
          disabled={isValidatingSchedule}
        >
          <Text style={styles.launchBtnText}>LAUNCH LIVE NOW</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={[styles.launchBtn, { backgroundColor: '#005E7D' }, isValidatingSchedule && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={isValidatingSchedule}
          >
            <Text style={styles.launchBtnText}>SAVE SCHEDULE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.launchBtn, { backgroundColor: '#10B981' }, isValidatingSchedule && { opacity: 0.7 }]}
            onPress={onLaunch}
            disabled={isValidatingSchedule}
          >
            <Text style={styles.launchBtnText}>LAUNCH LIVE INSTEAD</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={onBack} style={{ alignSelf: 'center', padding: 12 }}>
        <Text style={{ color: '#94A3B8', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>← Modify Bid Limits</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminGroupDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const handleParentBack = useAdminParentBack('/(admin)/groups');
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isGeneratingRef = React.useRef(false);
  // Only ever pre-generate auctions from a list we actually managed to read.
  // A failed/unauthenticated read returns [] and must never be mistaken for
  // "this group has no auctions yet" — that turned a read failure into a
  // bogus 20-row insert (rejected by RLS as 42501).
  const auctionsLoadedRef = React.useRef(false);

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [activating, setActivating] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [participation, setParticipation] = useState<'full' | 'half'>('full');

  const [auctions, setAuctions] = useState<any[]>([]);

  // Auction Settlement Modal State (installment / bid result)
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAuction, setSettlementAuction] = useState<any>(null);

  // Prize / Winner Payout Settlement (new - supports partial for accounted + unaccounted)
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [prizeAuction, setPrizeAuction] = useState<any>(null);
  const [prizeSettlements, setPrizeSettlements] = useState<any[]>([]);

  // Detailed prize payout report modal (denominations etc.)
  const [showPrizeDetailsModal, setShowPrizeDetailsModal] = useState(false);
  const [prizeDetailsAuction, setPrizeDetailsAuction] = useState<any>(null);

  // Create Auction Modal State
  const [auctionDrafts, setAuctionDrafts] = useState<Record<number, {
    id?: string | null;
    status?: string | null;
    scheduledAt: Date;
    closesAt: Date;
    minBid: string;
    maxBid: string;
  }>>({});
  const [savingAuctionMonth, setSavingAuctionMonth] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeDateTarget, setActiveDateTarget] = useState<'scheduled' | 'closes' | null>(null);
  const [activeTimeTarget, setActiveTimeTarget] = useState<'scheduled' | 'closes' | null>(null);
  const [activeDraftMonth, setActiveDraftMonth] = useState<number | null>(null);
  const [pendingDateValue, setPendingDateValue] = useState(new Date());
  const [pendingTimeValue, setPendingTimeValue] = useState(new Date());
  const [currentDateValue, setCurrentDateValue] = useState(new Date());
  const [currentTimeValue, setCurrentTimeValue] = useState(new Date());

  // New Scheduling Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAuctionForSchedule, setSelectedAuctionForSchedule] = useState<any | null>(null);
  const [prepStep, setPrepStep] = useState(1);
  const [tempMinBid, setTempMinBid] = useState('');
  const [tempMaxBid, setTempMaxBid] = useState('');
  const [tempScheduledAt, setTempScheduledAt] = useState(new Date());
  const [tempClosesAt, setTempClosesAt] = useState(new Date());
  const [isValidatingSchedule, setIsValidatingSchedule] = useState(false);

  const capacity = group?.capacity || 50;
  const totalShares = members.reduce((sum, m) => sum + (Number(m.participation_share) || 1), 0);
  const memberCount = members.length;
  const isAtCapacity = totalShares >= capacity;
  const isUnaccountedGroup = group?.accounting_type === 'unaccounted';
  const calculatedEmi = ((Number(group?.value) || 0) / (Number(group?.no_of_installments) || Number(group?.duration_months) || 1));
  const baseEmi = (Number(group?.emi_amount) || Number(group?.monthly_installment) || calculatedEmi) / 100;
  const displayEmi = participation === 'full' ? baseEmi : baseEmi / 2;

  const handleActivateGroup = async () => {
    if (!group?.id || group.status !== 'draft' || activating) return;
    if (totalShares !== capacity) {
      Alert.alert(
        'Enrollment Incomplete',
        `This group holds ${capacity} shares and ${totalShares} are filled — enrol ${capacity - totalShares} more before activating.`,
      );
      return;
    }
    setActivating(true);
    try {
      const { data, error } = await supabase
        .from('chit_groups')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', group.id)
        .eq('status', 'draft')
        .select('id, status')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Group status changed before activation. Refresh and try again.');
      setGroup((current: any) => ({ ...current, status: 'active' }));
      Alert.alert('Group Activated', 'The group is now visible to enrolled customers and auctions can begin.');
    } catch (error: any) {
      Alert.alert('Activation Failed', error?.message || 'The group could not be activated.');
    } finally {
      setActivating(false);
    }
  };

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

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase.from('customers').select('id, full_name, phone, customer_id').order('full_name');
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchPrizeSettlements = useCallback(async (auctionRows: any[]) => {
    if (!auctionRows || auctionRows.length === 0) {
      setPrizeSettlements([]);
      return;
    }
    try {
      const ids = auctionRows.map((a: any) => a.id);
      const { data: ps } = await supabase
        .from('auction_prize_settlements')
        .select('*')
        .in('auction_id', ids);
      setPrizeSettlements(ps || []);
    } catch (e) {
      console.warn('Failed to load prize settlements', e);
    }
  }, []);

  const fetchAuctions = useCallback(async () => {
    if (!group?.id) return;
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('chit_group_id', group.id)
        .order('auction_number', { ascending: false });
      if (error) {
        auctionsLoadedRef.current = false;
        console.error('Error fetching auctions:', error);
        return;
      }
      auctionsLoadedRef.current = true;
      const rows = data || [];
      const sanitized = await sanitizePlaceholderAuctionSchedules(supabase, rows);
      let finalRows = rows;
      if (sanitized) {
        const { data: refreshed } = await supabase
          .from('auctions')
          .select('*')
          .eq('chit_group_id', group.id)
          .order('auction_number', { ascending: false });
        finalRows = refreshed || rows;
        setAuctions(finalRows);
      } else {
        setAuctions(rows);
        finalRows = rows;
      }

      // Always load prize settlements after auctions (for partial winner payouts)
      await fetchPrizeSettlements(finalRows);

    } catch (err) {
      console.error('Error fetching auctions:', err);
    }
  }, [group?.id, fetchPrizeSettlements]);

  const ensureAuctionsExist = async (g: any, currentAuctions: any[]) => {
    if (!g?.id) return;
    if (!auctionsLoadedRef.current) return;
    // The Supabase session is restored asynchronously on a cold start; writing
    // before it lands goes out unauthenticated and is refused by RLS.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const totalNeeded = g.no_of_installments || g.duration_months || 0;
    if (totalNeeded <= 0) return;

    const existingNumbers = new Set(currentAuctions.map((a: any) => a.auction_number));
    const placeholderAt = getPlaceholderAuctionScheduleDate();
    const missing = [];
    for (let i = 1; i <= totalNeeded; i++) {
      if (!existingNumbers.has(i)) {
        missing.push({
          chit_group_id: g.id,
          auction_number: i,
          status: 'upcoming',
          prize_pool: g.value || 0,
          min_bid: 0,
          max_bid: 0,
          current_bid: 0,
          scheduled_at: placeholderAt,
          closes_at: placeholderAt,
        });
      }
    }

    if (missing.length > 0 && !isGeneratingRef.current) {
      isGeneratingRef.current = true;
      console.log(`Pre-generating ${missing.length} missing auctions...`);
      const { error } = await supabase.from('auctions').insert(missing);
      isGeneratingRef.current = false;
      if (error) {
        console.error('Error pre-generating auctions:', error);
        Alert.alert(
          'Auction Setup Failed',
          'The auction schedule for this group could not be created. Please reopen the group, and contact support if it keeps happening.',
        );
      } else fetchAuctions();
    }
  };

  useEffect(() => { fetchGroup(); }, [id]);
  useEffect(() => {
    if (group?.id) {
      fetchMembers();
      fetchAuctions();
    }
  }, [group?.id]);

  useEffect(() => {
    if (group?.id && auctions.length >= 0) {
      const total = group.no_of_installments || group.duration_months || 0;
      if (auctions.length < total) {
        ensureAuctionsExist(group, auctions);
      }
    }
  }, [group, auctions.length]);

  useEffect(() => {
    if (!group) return;
    const total = group.no_of_installments || group.duration_months || 0;
    const byNumber = new Map(auctions.map((a) => [a.auction_number, a]));
    const nextDrafts: Record<number, {
      id?: string | null;
      status?: string | null;
      scheduledAt: Date;
      closesAt: Date;
      minBid: string;
      maxBid: string;
    }> = {};

    for (let i = 1; i <= total; i += 1) {
      const existing = byNumber.get(i);
      const scheduledAt = existing?.scheduled_at ? new Date(existing.scheduled_at) : new Date();
      const closesAt = existing?.closes_at ? new Date(existing.closes_at) : new Date(Date.now() + (60 * 60 * 1000));
      nextDrafts[i] = {
        id: existing?.id || null,
        status: existing?.status || null,
        scheduledAt,
        closesAt,
        minBid: existing?.min_bid ? String(Math.round(existing.min_bid / 100)) : '',
        maxBid: existing?.max_bid ? String(Math.round(existing.max_bid / 100)) : '',
      };
    }

    setAuctionDrafts(nextDrafts);
  }, [group, auctions]);

  const deduplicatedAuctions = React.useMemo(
    () => dedupeAuctionCycles(auctions) as typeof auctions,
    [auctions],
  );

  useEffect(() => {
    if (!group?.id) return;

    // Supabase Realtime now returns an existing channel when the topic already
    // exists. removeChannel() is asynchronous, so a quick remount (navigation,
    // StrictMode, or Fast Refresh) can otherwise receive the old subscribed
    // channel and throw when these callbacks are added. Use a unique topic for
    // every effect instance and opportunistically remove stale instances.
    const channelPrefix = `admin-group-detail-${group.id}`;
    for (const existing of supabase.getChannels()) {
      if (existing.topic.startsWith(`realtime:${channelPrefix}`)) {
        void supabase.removeChannel(existing);
      }
    }
    const channelName = `${channelPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups', filter: `id=eq.${group.id}` }, fetchGroup)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `chit_group_id=eq.${group.id}` }, fetchMembers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `chit_group_id=eq.${group.id}` }, fetchAuctions)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // console.log(`[admin] group realtime subscribed: ${channelName}`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [group?.id, fetchGroup, fetchMembers, fetchAuctions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroup();
    await fetchMembers();
    await fetchAuctions();
    setRefreshing(false);
    setLoading(false);
  };

  const handleOpenScheduleModal = (auction: any) => {
    setSelectedAuctionForSchedule(auction);
    setPrepStep(1);
    setTempMinBid(String((auction.min_bid || 0) / 100));
    setTempMaxBid(String((auction.max_bid || group?.value || 0) / 100));

    // CRITICAL: If the existing times are in the past, reset to NOW + 1hr
    // This prevents launching with an already-expired closes_at (which blocks all bids)
    const now = new Date();
    const existingStart = auction.scheduled_at ? new Date(auction.scheduled_at) : null;
    const existingClose = auction.closes_at ? new Date(auction.closes_at) : null;

    if (existingStart && existingStart > now) {
      setTempScheduledAt(existingStart);
    } else {
      setTempScheduledAt(now);
    }

    if (existingClose && existingClose > now) {
      setTempClosesAt(existingClose);
    } else {
      setTempClosesAt(new Date(now.getTime() + 3600000)); // NOW + 1 hour
    }

    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (setLive = false) => {
    if (!selectedAuctionForSchedule || !group) return;

    if (setLive && group.status !== 'active') {
      const shortfall = capacity - totalShares;
      Alert.alert(
        'Activate Group First',
        shortfall > 0
          ? `This group is still a draft. Enrol ${shortfall} more of its ${capacity} shares, then press ACTIVATE GROUP before starting an auction.`
          : 'This group is still a draft. Press ACTIVATE GROUP on this screen before starting an auction.',
      );
      return;
    }

    const min = parseFloat(tempMinBid) || 0;
    const max = parseFloat(tempMaxBid) || 0;
    const chitValue = (group.value || 0) / 100;

    if (min >= max) {
      Alert.alert('Validation Error', 'Minimum bid must be less than maximum bid.');
      return;
    }
    if (max > chitValue) {
      Alert.alert('Validation Error', `Maximum bid cannot exceed chit value (₹${chitValue.toLocaleString()}).`);
      return;
    }
    if (tempClosesAt <= tempScheduledAt) {
      Alert.alert('Validation Error', 'Close time must be after start time.');
      return;
    }

    // SAFETY: If launching live, ensure closes_at is in the future
    if (setLive && tempClosesAt <= new Date()) {
      Alert.alert('Validation Error', 'Close time is in the past. Please set a future close time before launching.');
      return;
    }

    setIsValidatingSchedule(true);
    try {
      // Only check overlap against live/completed auctions — NOT upcoming placeholders
      const { data: overlaps } = await supabase
        .from('auctions')
        .select('id, auction_number, status')
        .eq('chit_group_id', group.id)
        .neq('id', selectedAuctionForSchedule.id)
        .in('status', ['live', 'completed'])
        .filter('scheduled_at', 'lte', tempClosesAt.toISOString())
        .filter('closes_at', 'gte', tempScheduledAt.toISOString());

      if (overlaps && overlaps.length > 0) {
        Alert.alert('Conflict Detected', `This time slot overlaps with Auction #${overlaps[0].auction_number} (${overlaps[0].status}).`);
        setIsValidatingSchedule(false);
        return;
      }

      if (setLive) {
        const { data: liveAuctions } = await supabase
          .from('auctions')
          .select('id, auction_number')
          .eq('chit_group_id', group.id)
          .eq('status', 'live')
          .neq('id', selectedAuctionForSchedule.id);

        if (liveAuctions && liveAuctions.length > 0) {
          Alert.alert('Conflict Detected', `Auction #${liveAuctions[0].auction_number} is already LIVE. Only one auction can be live at a time.`);
          setIsValidatingSchedule(false);
          return;
        }
      }

      const { error } = await supabase
        .from('auctions')
        .update({
          min_bid: Math.round(min * 100),
          max_bid: Math.round(max * 100),
          scheduled_at: tempScheduledAt.toISOString(),
          closes_at: tempClosesAt.toISOString(),
          status: setLive ? 'live' : selectedAuctionForSchedule.status
        })
        .eq('id', selectedAuctionForSchedule.id);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowScheduleModal(false);
      fetchAuctions();

      if (setLive) router.push({ pathname: '/(admin)/auctions/live', params: { auctionId: selectedAuctionForSchedule.id } });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsValidatingSchedule(false);
    }
  };

  useEffect(() => { onRefresh(); }, []);

  // --- ADD MEMBER LOGIC ---
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setParticipation('full');
  };

  const handleAddMemberConfirm = async () => {
    if (!group?.id || !selectedCustomer?.id) return;

    // Safety check on frontend
    const alreadyExists = members.some(m => m.customer_id === selectedCustomer.id);
    if (alreadyExists) {
      Alert.alert('Already Enrolled', 'This customer is already a member of this group.');
      return;
    }

    const share = participation === 'full' ? 1.0 : 0.5;
    if (totalShares + share > capacity) {
      const remaining = Math.max(0, capacity - totalShares);
      Alert.alert(
        'Group Full',
        remaining > 0
          ? `Only ${remaining} share${remaining === 1 ? '' : 's'} remaining in this group (${totalShares}/${capacity} filled).`
          : `This group is at full capacity (${capacity}/${capacity} shares).`,
      );
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('chit_members').insert([{
        chit_group_id: group.id,
        customer_id: selectedCustomer.id,
        participation_type: participation,
        participation_share: share,
      }]);

      if (error) {
        if (error.code === '23505') Alert.alert('Already Added', 'This member is already in the group.');
        else if (error.code === 'check_violation' || error.message?.toLowerCase().includes('capacity')) {
          Alert.alert('Group Full', `Cannot add member — group is at full capacity (${capacity}/${capacity} shares).`);
        } else Alert.alert('Error', error.message);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchMembers();
        setShowAddModal(false);
        setSelectedCustomer(null);

        // FIX: For the newly added member, proactively create base payment_schedules (all months)
        // and back-apply any already-completed auction settlements so their "payment due" amounts
        // are immediately correct on admin customer views and collections.
        try {
          // Re-fetch the just-created membership id
          const { data: newMember } = await supabase
            .from('chit_members')
            .select('id')
            .eq('chit_group_id', group.id)
            .eq('customer_id', selectedCustomer.id)
            .maybeSingle();

          if (newMember?.id) {
            // 1. Ensure base rows exist using current group values
            await ensureBaseSchedulesForMember(supabase, newMember.id, {
              start_date: group.start_date,
              monthly_installment: group.monthly_installment,
              duration_months: group.no_of_installments || group.duration_months,
            });

          }
        } catch (e) {
          console.warn('Post-add member schedule backfill non-fatal:', e);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAdding(false);
    }
  };

  const updateDraft = (monthNumber: number, updates: Partial<{
    scheduledAt: Date;
    closesAt: Date;
    minBid: string;
    maxBid: string;
    status: string | null;
    id: string | null;
  }>) => {
    setAuctionDrafts((prev) => ({
      ...prev,
      [monthNumber]: {
        ...prev[monthNumber],
        ...updates,
      },
    }));
  };

  const openDatePicker = (monthNumber: number, target: 'scheduled' | 'closes', value: Date) => {
    setActiveDraftMonth(monthNumber);
    setActiveDateTarget(target);
    setCurrentDateValue(value);
    setPendingDateValue(value);
    setShowDatePicker(true);
  };

  const openTimePicker = (monthNumber: number, target: 'scheduled' | 'closes', value: Date) => {
    setActiveDraftMonth(monthNumber);
    setActiveTimeTarget(target);
    setCurrentTimeValue(value);
    setPendingTimeValue(value);
    setShowTimePicker(true);
  };

  const openDatePickerForPrep = (target: 'scheduled' | 'closes') => {
    const value = target === 'scheduled' ? tempScheduledAt : tempClosesAt;
    setActiveDateTarget(target);
    setCurrentDateValue(value);
    setPendingDateValue(value);
    setShowDatePicker(true);
  };

  const openTimePickerForPrep = (target: 'scheduled' | 'closes') => {
    const value = target === 'scheduled' ? tempScheduledAt : tempClosesAt;
    setActiveTimeTarget(target);
    setCurrentTimeValue(value);
    setPendingTimeValue(value);
    setShowTimePicker(true);
  };


  const applyDateValue = (value: Date) => {
    if (!activeDateTarget) return;
    if (activeDateTarget === 'closes') {
      const updated = new Date(tempClosesAt);
      updated.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      setTempClosesAt(updated);
    } else {
      const updated = new Date(tempScheduledAt);
      updated.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      setTempScheduledAt(updated);
    }
  };

  const applyTimeValue = (value: Date) => {
    if (!activeTimeTarget) return;
    if (activeTimeTarget === 'closes') {
      const updated = new Date(tempClosesAt);
      updated.setHours(value.getHours(), value.getMinutes(), 0, 0);
      setTempClosesAt(updated);
    } else {
      const updated = new Date(tempScheduledAt);
      updated.setHours(value.getHours(), value.getMinutes(), 0, 0);
      setTempScheduledAt(updated);
    }
  };

  const handleDateChange = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (_event?.type === 'dismissed') return;
      const next = selected || currentDateValue;
      applyDateValue(next);
      return;
    }
    if (selected) setPendingDateValue(selected);
  };

  const handleTimeChange = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (_event?.type === 'dismissed') return;
      const next = selected || currentTimeValue;
      applyTimeValue(next);
      return;
    }
    if (selected) setPendingTimeValue(selected);
  };

  const formatDate = (value: any) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatTime = (value: any) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRupees = (value: number | null | undefined) =>
    `₹${Math.round(Number(value || 0) / 100).toLocaleString('en-IN')}`;

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

  // Prize payout settlement (separate from installment/bid-result settlement)
  const handleOpenPrizeSettlement = (auction: any) => {
    if (!auction || auction.status !== 'completed' || !auction.winner_member_id) {
      Alert.alert('Not ready', 'Prize settlement is only available for completed auctions with a declared winner.');
      return;
    }
    setPrizeAuction(auction);
    setShowPrizeModal(true);
  };

  const handlePrizeSaved = () => {
    setShowPrizeModal(false);
    setPrizeAuction(null);
    fetchAuctions(); // refresh auctions + prize settlements
  };

  const handleOpenPrizeDetails = (auction: any) => {
    setPrizeDetailsAuction(auction);
    setShowPrizeDetailsModal(true);
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery);
    const isAlreadyMember = members.some(m => m.customer_id === c.id);
    return matchesSearch && !isAlreadyMember;
  });

  const prizePool = Number(group?.value || 0) / 100;

  if (loading && !group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#005E7D" size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleParentBack}
          accessibilityRole="button"
          accessibilityLabel="Back to chit groups"
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#0F172A">
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <AppLogo size={36} />
        <View style={styles.headerTitleBox}>
          <Text style={styles.appBarTitle} numberOfLines={1}>{group?.name || 'Group'}</Text>
          <Text style={styles.appBarSubtitle}>{group?.group_code || id} • {group?.duration_months || 0} Months</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: group?.status === 'active' ? 'rgba(84,250,239,0.3)' : '#F1F5F9' }]}>
          <Text style={[styles.badgeText, { color: group?.status === 'active' ? '#00716b' : '#64748B' }]}>
            {(group?.status || 'ACTIVE').toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005E7D" />}
      >
        {/* Group Info Card */}
        <View style={styles.engineCard}>
          <View style={styles.glowBg} />
          <View style={styles.engineHeader}>
            <Text style={styles.engineTitle}>Group Overview</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={styles.statusDot} />
              <Text style={styles.engineSubtitle}>{group?.frequency || 'Monthly'} • EMI: ₹{baseEmi.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.engineStatsRow}>
            <View style={styles.engineStatCol}>
              <Text style={styles.engineStatLabel}>CHIT VALUE</Text>
              <Text style={styles.engineStatVal}>₹{prizePool.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.engineDivider} />
            <View style={styles.engineStatCol}>
              <Text style={styles.engineStatLabel}>INSTALLMENTS</Text>
              <Text style={styles.engineStatVal}>{group?.no_of_installments || group?.duration_months || 0}</Text>
            </View>
            <View style={styles.engineDivider} />
            <View style={styles.engineStatCol}>
              <Text style={styles.engineStatLabel}>SHARES</Text>
              <Text style={[styles.engineStatVal, { color: '#54FAEF' }]}>{totalShares} / {capacity}</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.executeBtn, isAtCapacity && { opacity: 0.5 }]}
              onPress={() => {
                if (isAtCapacity) {
                  Alert.alert('Group Full', `All ${capacity} shares are filled. Cannot add more members.`);
                  return;
                }
                setSelectedCustomer(null);
                setShowAddModal(true);
                fetchCustomers();
              }}
              disabled={isAtCapacity}
            >
              <Text style={styles.executeBtnText}>{isAtCapacity ? 'GROUP FULL' : '+ ADD MEMBER'}</Text>
            </TouchableOpacity>
            {group?.status === 'draft' && (
              <TouchableOpacity
                style={[styles.executeBtn, activating && { opacity: 0.5 }]}
                onPress={handleActivateGroup}
                disabled={activating}
                accessibilityRole="button"
                accessibilityLabel="Activate chit group"
              >
                <Text style={styles.executeBtnText}>{activating ? 'ACTIVATING…' : 'ACTIVATE GROUP'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Enrollment Status */}
        <View style={styles.enrollmentBlock}>
          <View style={styles.healthCard}>
            <View style={styles.healthLeft}>
              <Text style={styles.healthTitle}>Enrollment Status</Text>
              <Text style={styles.healthSub}>{totalShares} of {capacity} shares filled</Text>
              <View style={{ marginTop: 12 }}>
                <View style={styles.healthLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Enrolled ({totalShares})</Text>
                </View>
                <View style={styles.healthLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Available ({capacity - totalShares})</Text>
                </View>
              </View>
            </View>
            <View style={styles.progressCircle}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <Circle cx="50" cy="50" r="40" stroke="#F1F5F9" strokeWidth="12" fill="none" />
                <Circle cx="50" cy="50" r="40" stroke="#10B981" strokeWidth="12" fill="none"
                  strokeDasharray="251" strokeDashoffset={String(251 - (totalShares / capacity) * 251)}
                  strokeLinecap="round" transform="rotate(-90 50 50)" />
              </Svg>
              <View style={styles.circleInner}>
                <Text style={styles.circleText}>{capacity > 0 ? Math.round((totalShares / capacity) * 100) : 0}%</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewMembersBtn}
            onPress={() => router.push(`/(admin)/groups/${id}/members`)}
            activeOpacity={0.85}
          >
            <View style={styles.viewMembersBtnLeft}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="#01789E">
                <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </Svg>
              <View>
                <Text style={styles.viewMembersBtnTitle}>View Enrolled Members</Text>
                <Text style={styles.viewMembersBtnSub}>{members.length} member{members.length === 1 ? '' : 's'} · Tap for payment history</Text>
              </View>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
              <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Monthly Auctions Roadmap */}
        <View style={styles.auctionsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Auction Roadmap</Text>
            <View style={styles.roadmapBadge}>
              <Text style={styles.roadmapBadgeText}>
                {group?.no_of_installments || group?.duration_months || 0} MONTHS
              </Text>
            </View>
          </View>

          <View style={styles.timelineContainer}>
            {deduplicatedAuctions.map((auction, idx) => {
              const isCompleted = auction.status === 'completed';
              const isLive = auction.status === 'live';
              const isUpcoming = auction.status === 'upcoming';
              const isScheduled = isAuctionScheduledDisplay(auction);
              const isLast = idx === deduplicatedAuctions.length - 1;

              let statusColor = '#CBD5E1';
              if (isLive) statusColor = '#10B981';
              else if (isCompleted) statusColor = '#005E7D';
              else if (isScheduled) statusColor = '#F59E0B';

              return (
                <View key={auction.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: statusColor, shadowColor: statusColor }]}>
                      {isCompleted && <Svg width={12} height={12} viewBox="0 0 24 24" fill="#FFFFFF"><Path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></Svg>}
                      {isLive && <View style={styles.pulseDot} />}
                    </View>
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: isCompleted ? '#005E7D' : '#E2E8F0' }]} />}
                  </View>

                  <View style={[styles.timelineCard, isLive && styles.timelineCardLive, isCompleted && styles.timelineCardCompleted]}>
                    <View style={styles.timelineCardHeader}>
                      <View>
                        <Text style={styles.timelineMonth}>Auction #{auction.auction_number}</Text>
                        <Text style={styles.timelineStatus}>
                          {isLive ? 'LIVE NOW' : isCompleted ? 'SETTLED' : isScheduled ? 'SCHEDULED' : 'PENDING SETUP'}
                        </Text>
                      </View>
                      {isScheduled && !isCompleted && (
                        <View style={styles.timeTag}>
                          <Text style={styles.timeTagText}>{formatDate(auction.scheduled_at)}</Text>
                        </View>
                      )}
                    </View>

                    {isCompleted ? (
                      <View style={styles.timelineSummary}>
                        <View style={styles.timelineResultRow}>
                          <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>WINNER</Text>
                            <Text style={[
                              styles.summaryVal,
                              !auction.winner_member_id && { color: '#DC2626', fontStyle: 'italic' }
                            ]} numberOfLines={1}>
                              {auction.winner_member_id
                                ? getAuctionWinnerDisplayName(auction, members)
                                : 'Not assigned'}
                            </Text>
                          </View>
                          <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>PRIZE</Text>
                            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{formatRupees(auction.winner_prize_amount)}</Text>
                          </View>
                        </View>
                        {(() => {
                          const payable = getMemberDueAfterAuction(auction, group?.monthly_installment || 0);
                          if (payable == null) return null;
                          return (
                            <View style={styles.timelinePayableBar}>
                              <Text style={styles.timelinePayableLabel}>Payable Installment</Text>
                              <Text style={styles.timelinePayableValue}>{formatRupees(payable)}</Text>
                            </View>
                          );
                        })()}

                        {/* Prize / Payout Settlement section — always shown for completed auctions that have a prize amount.
                            This fixes the "mixed" display: Auction #2 shows full partial tracking because winner is linked.
                            #3/#4 (and any other group) will now consistently show the prize + clear guidance if winner linkage is missing.
                            The root data issue (winner_member_id not set even though prize was pre-filled via STOP or old save) is surfaced as actionable UI. */}
                        {auction.winner_prize_amount > 0 && (() => {
                          const hasWinner = !!auction.winner_member_id;
                          const winnerSettlements = hasWinner
                            ? prizeSettlements.filter(
                                (ps: any) => ps.auction_id === auction.id && ps.chit_member_id === auction.winner_member_id
                              )
                            : [];
                          const settledPaise = winnerSettlements.reduce((s: number, ps: any) => s + (ps.amount || 0), 0);
                          const prizePaise = auction.winner_prize_amount || 0;
                          const rem = Math.max(0, prizePaise - settledPaise);
                          const pct = prizePaise > 0 ? Math.min(100, (settledPaise / prizePaise) * 100) : 0;
                          const isFull = hasWinner && rem <= 0;
                          const isPartial = hasWinner && settledPaise > 0 && !isFull;

                          return (
                            <View style={styles.prizeSettlementBar}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={styles.prizeSettlementLabel}>PRIZE SETTLEMENT</Text>
                                {hasWinner ? (
                                  <Text style={[
                                    styles.prizeSettlementStatus,
                                    isFull ? { color: '#16A34A' } : isPartial ? { color: '#B45309' } : { color: '#DC2626' }
                                  ]}>
                                    {isFull ? 'FULLY PAID' : isPartial ? 'PARTIAL' : 'PENDING'}
                                  </Text>
                                ) : (
                                  <Text style={[styles.prizeSettlementStatus, { color: '#DC2626' }]}>WINNER NOT ASSIGNED</Text>
                                )}
                              </View>

                              {hasWinner ? (
                                <>
                                  <View style={styles.progressTrack}>
                                    <View style={[styles.progressFillGreen, { width: `${pct}%` }]} />
                                  </View>

                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                                    <Text style={styles.prizeSettlementText}>
                                      Settled: {formatRupees(settledPaise)}
                                    </Text>
                                    <Text style={[styles.prizeSettlementText, { color: rem > 0 ? '#DC2626' : '#16A34A' }]}>
                                      Remaining: {formatRupees(rem)}
                                    </Text>
                                  </View>

                                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                    <TouchableOpacity
                                      style={[styles.recordPrizeBtn, { flex: 1 }]}
                                      onPress={() => handleOpenPrizeSettlement(auction)}
                                    >
                                      <Text style={styles.recordPrizeBtnText}>
                                        {settledPaise > 0 ? 'RECORD ADDITIONAL PAYOUT' : 'RECORD PRIZE PAYOUT'}
                                      </Text>
                                    </TouchableOpacity>

                                    {/* Small "Details" button for full payout report (denominations, history) */}
                                    <TouchableOpacity
                                      style={[styles.recordPrizeBtn, { flex: 0.55, backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                                      onPress={() => handleOpenPrizeDetails(auction)}
                                    >
                                      <Text style={[styles.recordPrizeBtnText, { color: '#475569', fontSize: 10 }]}>DETAILS</Text>
                                    </TouchableOpacity>
                                  </View>
                                </>
                              ) : (
                                <View style={{ marginTop: 6 }}>
                                  <Text style={[styles.prizeSettlementText, { color: '#DC2626', marginBottom: 6 }]}>
                                    Prize amount recorded (₹{(prizePaise/100).toLocaleString('en-IN')}) but no winner linked yet.
                                    Prize payouts cannot be recorded until the winner is assigned.
                                  </Text>
                                  <TouchableOpacity
                                    style={[styles.recordPrizeBtn, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
                                    onPress={() => handleOpenSettlement(auction)}
                                  >
                                    <Text style={[styles.recordPrizeBtnText, { color: '#92400E' }]}>
                                      ASSIGN WINNER (Edit Settlement)
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    ) : null}
                    {!isCompleted && (
                      <View style={styles.timelineActions}>
                        {isLive ? (
                          <TouchableOpacity style={styles.timelineActionBtnLive} onPress={() => router.push({ pathname: '/(admin)/auctions/live', params: { auctionId: auction.id } })}>
                            <Text style={styles.timelineActionBtnTextLive}>ENTER LIVE AUCTION →</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.timelineActionBtn, isScheduled && { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}
                            onPress={() => handleOpenScheduleModal(auction)}
                          >
                            <Text style={[styles.timelineActionBtnText, isScheduled && { color: '#D97706' }]}>
                              {isScheduled ? 'START AUCTION' : 'SET UP AUCTION'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.timelineSettlementBtn, isCompleted && styles.timelineSettlementBtnCompleted]}
                      onPress={() => handleOpenSettlement(auction)}
                      activeOpacity={0.85}
                    >
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill={isCompleted ? '#005E7D' : '#01789E'}>
                        <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L19 8l-9 9z" />
                      </Svg>
                      <Text style={[styles.timelineSettlementBtnText, isCompleted && styles.timelineSettlementBtnTextCompleted]}>
                        {isCompleted ? 'EDIT SETTLEMENT' : 'SET AUCTION SETTLEMENT'}
                      </Text>
                    </TouchableOpacity>
                    {!isCompleted && (
                      <Text style={styles.timelineSettlementHint}>
                        For auctions held outside the app — unlocks collection for this cycle
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* --- ADD MEMBER MODAL --- */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              if (selectedCustomer) setSelectedCustomer(null);
              else setShowAddModal(false);
            }} style={styles.closeBtn}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                <Path d={selectedCustomer ? "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" : "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"} />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedCustomer ? 'Select Participation' : 'Select Customer'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {!selectedCustomer ? (
            <>
              <View style={{ paddingHorizontal: 20, marginBottom: 16, marginTop: 16 }}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                {filteredCustomers.length === 0 ? (
                  <Text style={{ color: '#94A3B8', fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 32 }}>
                    No customers found. Add customers first.
                  </Text>
                ) : (
                  filteredCustomers.map(c => (
                    <TouchableOpacity key={c.id} style={styles.customerRow} onPress={() => handleSelectCustomer(c)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.avatarMini}>
                          <Text style={styles.avatarMiniText}>{(c.full_name || 'U').charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.memberName}>{c.full_name}</Text>
                          <Text style={styles.memberId}>{c.customer_id} • {c.phone}</Text>
                        </View>
                      </View>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
                        <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                      </Svg>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.participationContainer}>
              <View style={styles.selectedCustomerCard}>
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarMiniText}>{(selectedCustomer.full_name || 'U').charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.memberName}>{selectedCustomer.full_name}</Text>
                  <Text style={styles.memberId}>{selectedCustomer.customer_id} • {selectedCustomer.phone}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Participation Type</Text>

              <View style={styles.partOptionsRow}>
                <TouchableOpacity style={[styles.partOption, participation === 'full' && styles.partOptionActive]} onPress={() => { setParticipation('full'); Haptics.selectionAsync(); }}>
                  <View style={styles.partRadioContainer}>
                    <View style={[styles.partRadio, participation === 'full' && styles.partRadioActive]}>
                      {participation === 'full' && <View style={styles.partRadioInner} />}
                    </View>
                  </View>
                  <Text style={[styles.partTitle, participation === 'full' && styles.partTitleActive]}>Full Share</Text>
                  <Text style={styles.partDesc}>Standard 100% EMI and dividend participation.</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.partOption, participation === 'half' && styles.partOptionActive]} onPress={() => { setParticipation('half'); Haptics.selectionAsync(); }}>
                  <View style={styles.partRadioContainer}>
                    <View style={[styles.partRadio, participation === 'half' && styles.partRadioActive]}>
                      {participation === 'half' && <View style={styles.partRadioInner} />}
                    </View>
                  </View>
                  <Text style={[styles.partTitle, participation === 'half' && styles.partTitleActive]}>Half Share</Text>
                  <Text style={styles.partDesc}>50% EMI contribution and 50% dividend.</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.emiPreviewBox}>
                <Text style={styles.emiPreviewLabel}>Estimated Monthly EMI</Text>
                <Text style={styles.emiPreviewVal}>₹{displayEmi.toLocaleString('en-IN')}</Text>
                <Text style={styles.emiPreviewSub}>* Before dividend deductions</Text>
              </View>

              <TouchableOpacity style={[styles.executeBtn, { flex: 0, marginTop: 'auto', marginBottom: 40 }]} onPress={handleAddMemberConfirm} disabled={adding}>
                {adding ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.executeBtnText}>CONFIRM & ADD MEMBER</Text>}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>


      <AuctionSettlementModal
        visible={showSettlementModal}
        auction={settlementAuction}
        group={group}
        members={members}
        memberCount={memberCount}
        totalShares={totalShares}
        onClose={() => { setShowSettlementModal(false); setSettlementAuction(null); }}
        onSaved={() => {
          setShowSettlementModal(false);
          setSettlementAuction(null);
          fetchAuctions();
        }}
      />

      {/* Prize Payout Settlement Modal (partial supported for accounted + unaccounted) */}
      <RecordPrizeSettlementModal
        visible={showPrizeModal}
        onClose={() => { setShowPrizeModal(false); setPrizeAuction(null); }}
        onSaved={handlePrizeSaved}
        auction={prizeAuction}
        group={group}
        winner={prizeAuction && members.find((m: any) => m.id === prizeAuction.winner_member_id)}
        existingSettlements={prizeSettlements}
      />

      {/* Detailed Prize Payout Report (denominations, history per auction) */}
      <PrizeSettlementDetailsModal
        visible={showPrizeDetailsModal}
        onClose={() => { setShowPrizeDetailsModal(false); setPrizeDetailsAuction(null); }}
        auction={prizeDetailsAuction}
        group={group}
        winner={prizeDetailsAuction && members.find((m: any) => m.id === prizeDetailsAuction.winner_member_id)}
        settlements={prizeSettlements}
      />

      {/* --- AUCTION PREP CENTER (STEPPED MODAL) --- */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScheduleModal(false)}
     />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={styles.closeBtn}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </Svg>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Auction Prep Center</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Stepper Header */}
          <View style={styles.stepperContainer}>
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <View style={[styles.stepCircle, prepStep >= s && styles.stepCircleActive]}>
                  <Text style={[styles.stepNum, prepStep >= s && styles.stepNumActive]}>{s}</Text>
                </View>
                {s < 3 && <View style={[styles.stepLine, prepStep > s && styles.stepLineActive]} />}
              </React.Fragment>
            ))}
          </View>

          {/* --- AUCTION PREP CENTER (STEPPED MODAL) --- */}
          <Modal
            visible={showScheduleModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowScheduleModal(false)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
              {/* Modal header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={styles.closeBtn}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </Svg>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  Auction #{selectedAuctionForSchedule?.auction_number}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Step progress bar */}
              <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8, backgroundColor: '#F8FAFC' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
                  {[1, 2, 3].map((s) => (
                    <React.Fragment key={s}>
                      <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: prepStep >= s ? '#005E7D' : '#E2E8F0',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {prepStep > s ? (
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="#FFFFFF">
                            <Path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </Svg>
                        ) : (
                          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: prepStep >= s ? '#FFFFFF' : '#94A3B8' }}>{s}</Text>
                        )}
                      </View>
                      {s < 3 && (
                        <View style={{ flex: 1, height: 2, backgroundColor: prepStep > s ? '#005E7D' : '#E2E8F0' }} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {['Launch Mode', 'Bid Limits', 'Confirm'].map((label, i) => (
                    <Text key={i} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9, color: prepStep >= i + 1 ? '#005E7D' : '#94A3B8', letterSpacing: 0.4 }}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

                {/* ── STEP 1: Launch Mode ─────────────────────────────── */}
                {prepStep === 1 && (
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={styles.prepStepTitle}>How do you want to start?</Text>
                      <Text style={styles.prepStepSub}>Choose to go live immediately or schedule for a future time.</Text>
                    </View>

                    {/* GO LIVE NOW card */}
                    <TouchableOpacity
                      style={[styles.modeCard, styles.modeCardLive]}
                      onPress={() => {
                        // Auto-set start = now, close = now + 2 hours
                        const now = new Date();
                        const close = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                        setTempScheduledAt(now);
                        setTempClosesAt(close);
                        setPrepStep(2);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.modeCardIconLive}>
                        <Svg width={28} height={28} viewBox="0 0 24 24" fill="#FFFFFF">
                          <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                        </Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modeCardTitle}>Go Live Now</Text>
                        <Text style={styles.modeCardSub}>Opens immediately · 2hr window · Members can bid right away</Text>
                      </View>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                        <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                      </Svg>
                    </TouchableOpacity>

                    {/* SCHEDULE card */}
                    <TouchableOpacity
                      style={[styles.modeCard, styles.modeCardSchedule]}
                      onPress={() => {
                        // Keep existing tempScheduledAt / tempClosesAt
                        setPrepStep(1.5 as any); // use a flag to show timing step
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.modeCardIconSchedule}>
                        <Svg width={28} height={28} viewBox="0 0 24 24" fill="#005E7D">
                          <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                        </Svg>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modeCardTitle, { color: '#0B1C30' }]}>Schedule for Later</Text>
                        <Text style={[styles.modeCardSub, { color: '#64748B' }]}>Pick a date & time · Opens automatically at scheduled time</Text>
                      </View>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
                        <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                      </Svg>
                    </TouchableOpacity>

                    {/* Show current schedule if one exists */}
                    {selectedAuctionForSchedule && isAuctionScheduledDisplay(selectedAuctionForSchedule) && (
                      <View style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12 }}>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' }}>
                          Currently scheduled: {formatDate(selectedAuctionForSchedule.scheduled_at)} at {formatTime(selectedAuctionForSchedule.scheduled_at)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* ── STEP 1.5: Timing (only for Schedule mode) ───────── */}
                {(prepStep as any) === 1.5 && (
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={styles.prepStepTitle}>Set Auction Timing</Text>
                      <Text style={styles.prepStepSub}>Define the exact window when bidding will be open.</Text>
                    </View>

                    <View style={styles.prepCard}>
                      {/* Start */}
                      <Text style={styles.schedulingFieldLabel}>AUCTION OPENS</Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        <TouchableOpacity style={styles.timePickerBtn} onPress={() => openDatePickerForPrep('scheduled')}>
                          <Text style={styles.timePickerLabel}>DATE</Text>
                          <Text style={styles.timePickerVal}>{formatDate(tempScheduledAt)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timePickerBtn} onPress={() => openTimePickerForPrep('scheduled')}>
                          <Text style={styles.timePickerLabel}>TIME</Text>
                          <Text style={styles.timePickerVal}>{formatTime(tempScheduledAt)}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Close */}
                      <Text style={styles.schedulingFieldLabel}>AUCTION CLOSES</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.timePickerBtn} onPress={() => openDatePickerForPrep('closes')}>
                          <Text style={styles.timePickerLabel}>DATE</Text>
                          <Text style={styles.timePickerVal}>{formatDate(tempClosesAt)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.timePickerBtn} onPress={() => openTimePickerForPrep('closes')}>
                          <Text style={styles.timePickerLabel}>TIME</Text>
                          <Text style={styles.timePickerVal}>{formatTime(tempClosesAt)}</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Duration pill */}
                      {tempClosesAt > tempScheduledAt && (
                        <View style={{ marginTop: 16, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#1E40AF' }}>
                            Duration: {Math.round((tempClosesAt.getTime() - tempScheduledAt.getTime()) / 60000)} minutes
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[styles.nextStepBtn, { backgroundColor: '#F1F5F9', flex: 1 }]} onPress={() => setPrepStep(1)}>
                        <Text style={[styles.nextStepBtnText, { color: '#64748B' }]}>← Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.nextStepBtn, { flex: 2 }]} onPress={() => setPrepStep(2)}>
                        <Text style={styles.nextStepBtnText}>Set Bid Limits →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── STEP 2: Bid Parameters ───────────────────────────── */}
                {prepStep === 2 && (
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text style={styles.prepStepTitle}>Bidding Limits</Text>
                      <Text style={styles.prepStepSub}>Set the discount range members can offer. Highest discount wins.</Text>
                    </View>

                    <View style={styles.prepCard}>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.schedulingFieldLabel}>MIN DISCOUNT (₹)</Text>
                          <TextInput
                            style={styles.prepInput}
                            keyboardType="numeric"
                            value={tempMinBid}
                            onChangeText={setTempMinBid}
                            placeholder="Enter minimum discount"
                            placeholderTextColor="#CBD5E1"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.schedulingFieldLabel}>MAX DISCOUNT (₹)</Text>
                          <TextInput
                            style={styles.prepInput}
                            keyboardType="numeric"
                            value={tempMaxBid}
                            onChangeText={setTempMaxBid}
                            placeholder="Enter maximum discount"
                            placeholderTextColor="#CBD5E1"
                          />
                        </View>
                      </View>

                      {/* Prize preview */}
                      {Number(tempMaxBid) > 0 && (
                        <View style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}>
                          <View style={{ backgroundColor: '#005E7D', padding: 16 }}>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
                              IF SOMEONE BIDS MAX DISCOUNT
                            </Text>
                            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#FFFFFF', marginTop: 4 }}>
                              {formatRupees((group?.value || 0) - (Number(tempMaxBid) * 100))}
                            </Text>
                            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                              minimum prize the winner could receive
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[styles.nextStepBtn, { backgroundColor: '#F1F5F9', flex: 1 }]} onPress={() => setPrepStep(1)}>
                        <Text style={[styles.nextStepBtnText, { color: '#64748B' }]}>← Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.nextStepBtn, { flex: 2 }]} onPress={() => setPrepStep(3)}>
                        <Text style={styles.nextStepBtnText}>Review →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ── STEP 3: Review & Confirm ──────────────────────────── */}
                {prepStep === 3 && (
                  <Step3Review
                    tempScheduledAt={tempScheduledAt}
                    tempClosesAt={tempClosesAt}
                    tempMinBid={tempMinBid}
                    tempMaxBid={tempMaxBid}
                    groupValue={group?.value || 0}
                    isValidatingSchedule={isValidatingSchedule}
                    onBack={() => setPrepStep(2)}
                    onSave={() => handleSaveSchedule(false)}
                    onLaunch={() => Alert.alert(
                      'Launch Auction',
                      'Members will be able to bid immediately. Are you ready?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Yes, Launch', onPress: () => handleSaveSchedule(true) },
                      ]
                    )}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    formatRupees={formatRupees}
                    styles={styles}
                  />
                )}

              </ScrollView>

              {/* Date / Time pickers must live OUTSIDE ScrollView to avoid JSX nesting issues */}
              {showDatePicker && Platform.OS === 'ios' && (
                <View style={styles.pickerOverlay}>
                  <View style={styles.pickerSheet}>
                    <View style={{ height: 216, justifyContent: 'center' }}>
                      <DateTimePicker
                        value={pendingDateValue}
                        mode="date"
                        display="inline"
                        onChange={handleDateChange}
                        textColor="#0B1C30"
                        themeVariant="light"
                        style={{ height: 216, alignSelf: 'stretch', backgroundColor: '#FFFFFF' }}
                      />
                    </View>
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={[styles.pickerCancelBtn, { flex: 1 }]} onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerCancelText}>CANCEL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.pickerSaveBtn, { flex: 1 }]} onPress={() => { applyDateValue(pendingDateValue); setShowDatePicker(false); }}>
                        <Text style={styles.pickerSaveText}>DONE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              {showTimePicker && Platform.OS === 'ios' && (
                <View style={styles.pickerOverlay}>
                  <View style={styles.pickerSheet}>
                    <View style={{ height: 216, justifyContent: 'center' }}>
                      <DateTimePicker
                        value={pendingTimeValue}
                        mode="time"
                        display="spinner"
                        onChange={handleTimeChange}
                        textColor="#0B1C30"
                        themeVariant="light"
                        style={{ height: 216, alignSelf: 'stretch', backgroundColor: '#FFFFFF' }}
                      />
                    </View>
                    <View style={styles.pickerActions}>
                      <TouchableOpacity style={[styles.pickerCancelBtn, { flex: 1 }]} onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerCancelText}>CANCEL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.pickerSaveBtn, { flex: 1 }]} onPress={() => { applyTimeValue(pendingTimeValue); setShowTimePicker(false); }}>
                        <Text style={styles.pickerSaveText}>DONE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker value={currentDateValue} mode="date" display="default" onChange={handleDateChange} />
              )}
              {showTimePicker && Platform.OS === 'android' && (
                <DateTimePicker value={currentTimeValue} mode="time" display="default" onChange={handleTimeChange} />
              )}
            </SafeAreaView>
          </Modal>

        </SafeAreaView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  appBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, height: 64, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  engineCard: { backgroundColor: '#0F172A', borderRadius: 24, padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden' },
  glowBg: { position: 'absolute', top: -100, right: -100, width: 300, height: 300, backgroundColor: 'rgba(0,209,193,0.15)', borderRadius: 150 },
  engineHeader: { marginBottom: 24, zIndex: 1 },
  engineTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  engineSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  engineStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, zIndex: 1 },
  engineStatCol: { flex: 1 },
  engineStatLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', marginBottom: 4 },
  engineStatVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#F8FAFC' },
  engineDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16 },
  executeBtn: { backgroundColor: '#00D1C1', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, flex: 1, alignItems: 'center' },
  executeBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0F172A', letterSpacing: 0.5 },
  enrollmentBlock: { marginBottom: 24, gap: 12 },
  healthCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  viewMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 16,
  },
  viewMembersBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  viewMembersBtnTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#005E7D' },
  viewMembersBtnSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  healthLeft: { flex: 1 },
  healthTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#0B1C30' },
  healthSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginBottom: 16 },
  healthLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#475569' },
  progressCircle: { width: 100, height: 100, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  circleInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  circleText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0B1C30' },
  membersSection: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: '#164E63', marginBottom: 16, marginLeft: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHelper: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#94A3B8' },
  sectionAction: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  sectionActionText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#005E7D', letterSpacing: 0.6 },
  emptyNote: { fontFamily: 'Inter_400Regular', color: '#94A3B8', textAlign: 'center', marginTop: 8 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
  emptyTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#0B1C30', marginBottom: 6 },
  createAuctionBtn: { marginTop: 14, backgroundColor: '#00D1C1', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  createAuctionBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#0F172A', letterSpacing: 0.6 },
  memberCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  avatarMiniText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#005E7D' },
  memberName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  memberId: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  partBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  partBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  modalTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#0B1C30' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  searchInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30' },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  participationContainer: { flex: 1, padding: 20 },
  selectedCustomerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  partOptionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  partOption: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, padding: 16 },
  partOptionActive: { borderColor: '#005E7D', backgroundColor: '#F0F9FF' },
  partRadioContainer: { marginBottom: 12 },
  partRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  partRadioActive: { borderColor: '#005E7D' },
  partRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#005E7D' },
  partTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0F172A', marginBottom: 4 },
  partTitleActive: { color: '#005E7D' },
  partDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', lineHeight: 18 },
  emiPreviewBox: { backgroundColor: '#0F172A', borderRadius: 16, padding: 20, alignItems: 'center' },
  emiPreviewLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginBottom: 8 },
  emiPreviewVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#54FAEF', marginBottom: 4 },
  emiPreviewSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748B', fontStyle: 'italic' },

  // Transaction Modal Styles
  txSummaryCard: { backgroundColor: '#0F172A', padding: 24, borderRadius: 20, marginBottom: 24, shadowColor: '#00D1C1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  txSummaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#94A3B8', marginBottom: 8 },
  txSummaryValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: '#FFFFFF' },
  txSummaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  txSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txSummarySubText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#94A3B8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  txIconBoxAlt: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  txTitleAlt: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0F172A', marginBottom: 4 },
  txDateAlt: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B' },
  txAmountAlt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#10B981', marginBottom: 4 },
  txStatusAlt: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B' },
  auctionChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  auctionChipActive: { backgroundColor: '#F0F9FF', borderColor: '#005E7D' },
  auctionChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  auctionChipTextActive: { color: '#005E7D' },
  auctionCycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  auctionCycleRowActive: { borderColor: '#005E7D', backgroundColor: '#F0F9FF' },
  auctionCycleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0F172A' },
  auctionCycleTitleActive: { color: '#005E7D' },
  auctionCycleDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  auctionCyclePayable: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#01789E', marginTop: 4 },
  auctionCyclePending: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
  auctionCycleRowPending: { opacity: 0.55 },
  auctionCycleStatus: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748B', letterSpacing: 0.3 },

  auctionsSection: { marginBottom: 24 },
  auctionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12 },
  auctionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  auctionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#0B1C30' },
  auctionSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#64748B', marginTop: 4 },
  auctionBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F1F5F9' },
  auctionBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0B1C30', letterSpacing: 0.5 },
  auctionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  auctionMetaLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.6 },
  auctionMetaVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#0B1C30', marginTop: 4 },
  auctionWinnerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  auctionWinnerLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' },
  auctionWinnerName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0B1C30', flex: 1, marginLeft: 12 },
  auctionWinnerPrize: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: '#10B981' },

  settlementGrid: { gap: 12 },
  settlementField: { gap: 6 },
  settlementLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B', letterSpacing: 0.4 },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  monthChipActive: { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
  monthChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  monthChipTextActive: { color: '#0B1C30' },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  pickerCancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCancelText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#64748B', letterSpacing: 0.6 },
  pickerSaveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#005E7D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSaveText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 0.6 },

  editBtnSmall: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editBtnTextSmall: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748B' },
  winnerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  winnerLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' },
  winnerName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0B1C30', flex: 1, marginLeft: 12 },
  winnerAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12 },
  startAuctionBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  startAuctionBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 0.6 },
  schedulingFieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },

  roadmapBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  roadmapBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748B' },
  timelineContainer: { paddingLeft: 8, marginTop: 16 },
  timelineItem: { flexDirection: 'row', minHeight: 120 },
  timelineLeft: { width: 40, alignItems: 'center' },
  timelineDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    borderWidth: 4, borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  timelineLine: { width: 2, flex: 1, marginTop: -2, marginBottom: -2, zIndex: 1 },
  timelineCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, marginLeft: 8,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1
  },
  timelineCardLive: { borderColor: '#10B981', backgroundColor: '#F0FDF4', borderLeftWidth: 4, borderLeftColor: '#10B981' },
  timelineCardCompleted: { backgroundColor: '#F8FAFC' },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  timelineMonth: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30' },
  timelineStatus: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#94A3B8', marginTop: 2, letterSpacing: 0.5 },
  timeTag: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FEF3C7' },
  timeTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#D97706' },
  timelineSummary: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  timelineResultRow: { flexDirection: 'row', gap: 24 },
  timelinePayableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  timelinePayableLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#005E7D', letterSpacing: 0.4 },
  timelinePayableValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#01789E' },
  summaryItem: { flex: 1 },
  summaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.6 },
  summaryVal: { fontFamily: 'Inter_700Bold', fontSize: 13, color: '#0B1C30', marginTop: 2 },
  timelineActions: { marginTop: 8 },
  timelineActionBtn: {
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center'
  },
  timelineActionBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#64748B', letterSpacing: 0.5 },
  timelineActionBtnLive: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  timelineActionBtnTextLive: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 0.5 },
  timelineSettlementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  timelineSettlementBtnCompleted: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  timelineSettlementBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#01789E',
    letterSpacing: 0.4,
  },
  timelineSettlementBtnTextCompleted: { color: '#005E7D' },
  timelineSettlementHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },

  // Prize settlement (payout to winner) styles - partial support
  prizeSettlementBar: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  prizeSettlementLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#166534', letterSpacing: 0.6 },
  prizeSettlementStatus: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFillGreen: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  prizeSettlementText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#166534' },
  recordPrizeBtn: {
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  recordPrizeBtnText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#166534', letterSpacing: 0.3 },

  stepperContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
  stepCircleActive: { backgroundColor: '#005E7D', borderColor: '#005E7D' },
  stepNum: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#94A3B8' },
  stepNumActive: { color: '#FFFFFF' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 8 },
  stepLineActive: { backgroundColor: '#005E7D' },

  prepStepTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#0B1C30', marginBottom: 4 },
  prepStepSub: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#64748B', marginBottom: 24 },
  prepCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  prepRow: { flexDirection: 'row', gap: 12 },
  pickerPreviewLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', marginBottom: 4 },
  pickerPreviewVal: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0B1C30' },
  calculationBox: { marginTop: 24, padding: 16, backgroundColor: '#F0F9FF', borderRadius: 12, alignItems: 'center' },
  calcLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0369A1' },
  calcVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#0369A1', marginVertical: 4 },
  calcNote: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#38BDF8' },
  nextStepBtn: { backgroundColor: '#0F172A', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  nextStepBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  reviewItem: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  reviewLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  reviewVal: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0B1C30' },
  warningBox: { flexDirection: 'row', gap: 10, backgroundColor: '#FFFBEB', padding: 12, borderRadius: 10, marginTop: 12 },
  warningText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#92400E' },
  launchBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  launchBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF', letterSpacing: 0.5 },

  // ── New prep center styles ──────────────────────────────────
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 18, borderWidth: 1 },
  modeCardLive: { backgroundColor: '#005E7D', borderColor: '#005E7D' },
  modeCardSchedule: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  modeCardIconLive: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modeCardIconSchedule: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  modeCardTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#FFFFFF', marginBottom: 4 },
  modeCardSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },

  timePickerBtn: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  timePickerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, marginBottom: 6 },
  timePickerVal: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0B1C30' },

  prepInput: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 14, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30' },

  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  reviewDivider: { height: 1, backgroundColor: '#F1F5F9' },
});
