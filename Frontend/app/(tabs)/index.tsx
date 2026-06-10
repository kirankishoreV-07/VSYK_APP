import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../lib/constants';
import { AppLogo } from '../../components/AppLogo';
import { useMemberSession } from '../../lib/MemberSessionContext';
import { getHealthLabel, getHealthSubtext } from '../../lib/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  useActiveChits,
  useDashboardStats,
  useUpcomingAuctions,
  formatPaise,
  formatShortDate,
  formatAuctionTime,
  type ActiveChit,
  type UpcomingAuction,
} from '../../lib/hooks/useDashboard';
import { useToggleReminder } from '../../lib/hooks/useReminder';


const { width: SW } = Dimensions.get('window');

// ─── Health Score Ring ────────────────────────────────────────
function HealthScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <View style={styles.ringContainer}>
      <Svg width={96} height={96} viewBox="0 0 96 96">
        <G rotation="-90" origin="48,48">
          <Circle cx={48} cy={48} r={radius} stroke="#F1F5F9" strokeWidth={8} fill="none" />
          <Circle
            cx={48} cy={48} r={radius}
            stroke={Colors.secondary} strokeWidth={8} fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <Text style={styles.ringScore}>{score}</Text>
    </View>
  );
}

// ─── Skeleton Block ───────────────────────────────────────────
function Skeleton({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) {
  return (
    <View style={[styles.skeleton, { width: w as any, height: h, borderRadius: radius }]} />
  );
}

// ─── Chit Card ────────────────────────────────────────────────
function ChitCard({ item }: { item: ActiveChit }) {
  const router = useRouter();
  const group = item.chit_group;
  const progress = item.current_month / group.duration_months;
  const statusLabel = item.bid_status === 'bidding' ? 'Bidding' : 'Active';
  const statusColor = item.bid_status === 'bidding' ? '#F59E0B' : Colors.secondary;

  return (
    <TouchableOpacity
      style={styles.chitCard}
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(tabs)/chits');
      }}
    >
      <View style={styles.chitCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.chitGroup} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.chitValue}>{formatPaise(group.value)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressLabel}>
            {item.current_month}/{group.duration_months} Months
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
        </View>
      </View>

      <View style={[styles.chitCardFooter, { alignItems: 'center' }]}>
        {item.next_payment ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextPayLabel}>
                Next Payment:{' '}
                <Text style={styles.nextPayDate}>{formatShortDate(item.next_payment.due_date)}</Text>
              </Text>
              <Text style={styles.nextPayAmt}>{formatPaise(item.next_payment.amount)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.dashPayBtn}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/(tabs)/chit/${item.membership_id}`);
              }}
            >
              <Text style={styles.dashPayBtnText}>PAY NOW</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.nextPayLabel}>All payments up to date ✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Chit Card ───────────────────────────────────────
function SkeletonChitCard() {
  return (
    <View style={[styles.chitCard, { gap: 16 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: 8 }}>
          <Skeleton w={120} h={10} />
          <Skeleton w={160} h={22} />
        </View>
        <Skeleton w={52} h={24} radius={8} />
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton w={60} h={10} />
          <Skeleton w={80} h={10} />
        </View>
        <Skeleton w="100%" h={6} radius={100} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC' }}>
        <Skeleton w={120} h={10} />
        <Skeleton w={60} h={10} />
      </View>
    </View>
  );
}

// ─── Auction Row ──────────────────────────────────────────────
function AuctionRow({ item }: { item: UpcomingAuction }) {
  const { mutate: toggleReminder, isPending } = useToggleReminder();

  return (
    <View style={styles.auctionRow}>
      <View style={styles.auctionIcon}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.primary}>
          <Path d="M7 2v11h3v9l7-12h-4l4-8z" />
        </Svg>
      </View>
      <View style={styles.auctionInfo}>
        <Text style={styles.auctionName}>{item.chit_group?.name ?? 'Auction'}</Text>
        <Text style={styles.auctionTime}>{formatAuctionTime(item.scheduled_at)}</Text>
      </View>
      <TouchableOpacity
        style={[
          styles.remindBtn,
          item.has_reminder && styles.remindBtnActive,
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          toggleReminder({ auctionId: item.id, hasReminder: item.has_reminder });
        }}
        disabled={isPending}
        activeOpacity={0.8}
      >
        {isPending
          ? <ActivityIndicator size="small" color={Colors.primary} />
          : <Text style={[styles.remindText, item.has_reminder && styles.remindTextActive]}>
            {item.has_reminder ? '✓ Set' : 'Remind'}
          </Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { memberId, memberProfile } = useMemberSession();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useDashboardStats(memberId);
  const { data: chits, isLoading: chitsLoading, error: chitsError } = useActiveChits(memberId);
  const { data: auctions, isLoading: auctionsLoading } = useUpcomingAuctions(memberId);

  const fallbackTotalValue = (chits ?? []).reduce((sum, chit) => sum + (chit.chit_group?.value ?? 0), 0);
  const totalPortfolioValue = stats?.total_portfolio_value ?? 0;
  const displayTotalValue = totalPortfolioValue > 0 ? totalPortfolioValue : fallbackTotalValue;

  useEffect(() => {
    if (!memberId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', memberId] });
      queryClient.invalidateQueries({ queryKey: ['active-chits', memberId] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-auctions', memberId] });
    };

    const channel = supabase
      .channel(`member-home-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members', filter: `customer_id=eq.${memberId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedules' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, queryClient]);

  // Use KYC logic to set credit score for demo
  let healthScore = 750;
  if (memberProfile?.kyc_status === 'verified') healthScore = 850;
  else if (memberProfile?.kyc_status === 'pending') healthScore = 650;
  else if (memberProfile?.kyc_status === 'rejected') healthScore = 400;

  const profileLoading = !memberProfile;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── App Bar ── */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <AppLogo size={40} />
          <View>
            <Text style={styles.appBarTitle}>VSYK CHITS</Text>
            {memberProfile?.full_name ? (
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 1 }}>
                Hi, {memberProfile.full_name.split(' ')[0]} 👋
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity style={styles.translateBtn} activeOpacity={0.7}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Bento Grid: Health + Stats ── */}
        <View style={styles.bentoGrid}>
          {/* Health Card */}
          <View style={styles.healthCard}>
            <View style={styles.healthLeft}>
              <Text style={styles.healthLabel}>PORTFOLIO HEALTH</Text>
              {profileLoading ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Skeleton w={140} h={28} radius={6} />
                  <Skeleton w={180} h={12} />
                </View>
              ) : (
                <>
                  <Text style={styles.healthTitle}>{getHealthLabel(healthScore)}</Text>
                  <Text style={styles.healthSub}>{getHealthSubtext(healthScore)}</Text>
                </>
              )}
            </View>
            {profileLoading
              ? <Skeleton w={96} h={96} radius={48} />
              : <HealthScoreRing score={healthScore} />
            }
          </View>

          {/* Total Value */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL VALUE</Text>
            {statsLoading ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Skeleton w={100} h={22} />
                <Skeleton w={60} h={12} />
              </View>
            ) : (
              <>
                <Text style={styles.statValue}>{formatPaise(displayTotalValue)}</Text>
                <View style={styles.statTrend}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill={Colors.secondary}>
                    <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                  </Svg>
                  <Text style={styles.statTrendText}>Active Chits</Text>
                </View>
              </>
            )}
          </View>

          {/* Earnings */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>EARNINGS</Text>
            {statsLoading ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Skeleton w={100} h={22} />
                <Skeleton w={60} h={12} />
              </View>
            ) : (
              <>
                <Text style={styles.statValue}>{formatPaise(stats?.total_earnings ?? 0)}</Text>
                <View style={styles.statTrend}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill={Colors.secondary}>
                    <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </Svg>
                  <Text style={styles.statTrendText}>Dividends</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Active Chits Carousel ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Chits</Text>
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/chits'); }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill={Colors.primary}>
                <Path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {chitsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chitCarousel}>
              <SkeletonChitCard />
              <SkeletonChitCard />
            </ScrollView>
          ) : chitsError ? (
            <EmptyState message="Failed to load chits. Pull to refresh." icon="⚠️" />
          ) : !chits || chits.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyChitCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/chits'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyChitIcon}>💰</Text>
              <Text style={styles.emptyChitTitle}>No Active Chits</Text>
              <Text style={styles.emptyChitSub}>Tap to join your first chit fund and start growing your wealth.</Text>
              <View style={styles.emptyChitBtn}>
                <Text style={styles.emptyChitBtnText}>Browse Chits →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chitCarousel}
              decelerationRate="fast"
              snapToInterval={SW - 60}
              snapToAlignment="start"
            >
              {chits.map((chit) => <ChitCard key={chit.membership_id} item={chit} />)}
            </ScrollView>
          )}
        </View>

        {/* ── Upcoming Auctions ── */}
        <View style={[styles.section, { paddingBottom: 110 }]}>
          <Text style={styles.sectionTitle}>Upcoming Auctions</Text>
          {auctionsLoading ? (
            <View style={styles.auctionList}>
              {[1, 2].map((i) => (
                <View key={i} style={[styles.auctionRow, { gap: 16 }]}>
                  <Skeleton w={44} h={44} radius={14} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton w={120} h={12} />
                    <Skeleton w={80} h={10} />
                  </View>
                  <Skeleton w={64} h={32} radius={10} />
                </View>
              ))}
            </View>
          ) : !auctions || auctions.length === 0 ? (
            <EmptyState message="Next auction will be held on the scheduled date for your active groups." icon="📅" />
          ) : (
            <View style={styles.auctionList}>
              {auctions.map((auction) => <AuctionRow key={auction.id} item={auction} />)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.push('/(tabs)/chits');
        }}
        activeOpacity={0.85}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="#FFFFFF">
          <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </Svg>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  appBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)',
    ...Shadows.subtle,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: '#FFFFFF' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary, letterSpacing: -0.5 },
  translateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },

  // Bento
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  healthCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  healthLeft: { flex: 1, gap: 4 },
  healthLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' },
  healthTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: Colors.primary, letterSpacing: -0.5 },
  healthSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6F787E' },
  ringContainer: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ringScore: { position: 'absolute', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.primary },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 4,
    borderWidth: 1, borderColor: '#F1F5F9', minHeight: 100, ...Shadows.subtle,
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  statValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: -0.5 },
  statTrend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statTrendText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.secondary },

  // Sections
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary, letterSpacing: -0.3 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary, letterSpacing: 0.3 },

  // Chit Card
  chitCarousel: { paddingRight: 20, gap: 12 },
  chitCard: {
    width: SW - 60, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 16,
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  chitCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  chitGroup: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginBottom: 4 },
  chitValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: Colors.primary, letterSpacing: -0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.primary, letterSpacing: 0.5 },
  progressSection: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#6F787E' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.secondary, borderRadius: 100 },
  chitCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC',
  },
  dashPayBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dashPayBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  nextPayLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B' },
  nextPayDate: { fontFamily: 'Inter_700Bold', color: '#0B1C30' },
  nextPayAmt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.primary },

  // Empty chit card
  emptyChitCard: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9', gap: 8, ...Shadows.subtle,
  },
  emptyChitIcon: { fontSize: 36, marginBottom: 4 },
  emptyChitTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: Colors.primary },
  emptyChitSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', textAlign: 'center', maxWidth: 260 },
  emptyChitBtn: {
    marginTop: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 100,
  },
  emptyChitBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },

  // Auction
  auctionList: { gap: 10 },
  auctionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18,
    borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle,
  },
  auctionIcon: {
    width: 44, height: 44, backgroundColor: 'rgba(1,120,158,0.08)',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  auctionInfo: { flex: 1, gap: 2 },
  auctionName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0B1C30' },
  auctionTime: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6F787E' },
  remindBtn: {
    borderWidth: 1, borderColor: 'rgba(1,120,158,0.25)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, minWidth: 64,
    alignItems: 'center',
  },
  remindBtnActive: {
    backgroundColor: 'rgba(1,120,158,0.08)',
    borderColor: Colors.primary,
  },
  remindText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary },
  remindTextActive: { color: Colors.primary },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  // Skeleton
  skeleton: { backgroundColor: '#E2E8F0' },

  // FAB
  fab: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 104 : 88, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
});
