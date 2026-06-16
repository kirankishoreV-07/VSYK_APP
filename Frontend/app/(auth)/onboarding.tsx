import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors, Spacing, Radii, Shadows } from '../../lib/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HORIZONTAL_PAD = 40;
const CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_PAD;
const MD_PHOTO_ASPECT = 1080 / 607;
const SLIDE1_PHOTO_HEIGHT = Math.min(CARD_WIDTH * MD_PHOTO_ASPECT, SCREEN_HEIGHT * 0.46);
const SLIDE1_PHOTO_WIDTH = SLIDE1_PHOTO_HEIGHT / MD_PHOTO_ASPECT;

// ─── Slide Data ──────────────────────────────────────────────
const SLIDES = [
  {
    key: 'slide1',
    step: '1 of 3',
    title: 'Leadership with Vision',
    subtitle: '', // Handled by rich text renderer
    cta: 'Get Started',
  },
  {
    key: 'slide2',
    step: '2 of 3',
    title: 'Savings for Life\'s\nPriorities',
    subtitle: 'A chit fund turns disciplined monthly savings into a flexible corpus for education, healthcare, emergencies, and major life goals — without market volatility.',
    cta: 'Next',
  },
  {
    key: 'slide3',
    step: '3 of 3',
    title: 'How Chit Fund\nWorks',
    subtitle: 'Members contribute monthly, bid in auctions, and one member receives the pooled amount early while others continue earning dividends until everyone benefits.',
    cta: 'Get Started',
  },
];

// ─── Slide Visualizations ─────────────────────────────────────

function Slide1Visual() {
  return (
    <View style={styles.slide1Outer}>
      <LinearGradient
        colors={['rgba(176, 212, 241, 0.95)', 'rgba(1, 120, 158, 0.5)', 'rgba(84, 250, 239, 0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slide1GradientBorder}
      >
        <View style={styles.slide1Inner}>
          <View style={[styles.slide1PhotoFrame, { height: SLIDE1_PHOTO_HEIGHT }]}>
            <Image
              source={require('../../assets/images/md_photo.png')}
              style={[styles.slide1Photo, { width: SLIDE1_PHOTO_WIDTH, height: SLIDE1_PHOTO_HEIGHT }]}
              contentFit="contain"
              contentPosition="center"
            />
          </View>
          <View style={styles.slide1TextBlock}>
            <Text style={styles.slide1Title}>Leadership with Vision</Text>
            <Text style={styles.slide1Body}>
              Guided by{' '}
              <Text style={styles.subtitleHighlight}>Managing Director MR VENKATESAN.R</Text>, who brings{' '}
              <Text style={styles.subtitleHighlight}>over 30 years of profound experience</Text> in the financial
              services and chit fund industry.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

type SavingsGoalItem = {
  label: string;
  sub: string;
  color: string;
  wide?: boolean;
};

const SAVINGS_GOALS: SavingsGoalItem[] = [
  { label: 'Education', sub: 'School & college', color: '#005E7D' },
  { label: 'Healthcare', sub: 'Hospitals & care', color: '#01789E' },
  { label: 'Business', sub: 'Invest & grow', color: '#0E7490' },
  { label: 'Emergencies', sub: 'Urgent needs', color: '#0891B2' },
  { label: 'Home & Marriage', sub: 'Life milestones', color: '#006A65', wide: true },
];

function GoalTile({
  label,
  sub,
  color,
  wide,
}: {
  label: string;
  sub: string;
  color: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.goalTile, wide && styles.goalTileWide]}>
      <View style={[styles.goalTileAccent, { backgroundColor: color }]} />
      <View style={styles.goalTileBody}>
        <View style={styles.goalTileHeader}>
          <View style={[styles.goalTileDot, { backgroundColor: color }]} />
          <Text style={styles.goalTileLabel}>{label}</Text>
        </View>
        <Text style={styles.goalTileSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Slide2Visual() {
  return (
    <View style={styles.slide2Outer}>
      <LinearGradient
        colors={['rgba(176, 212, 241, 0.95)', 'rgba(1, 120, 158, 0.5)', 'rgba(84, 250, 239, 0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slide2GradientBorder}
      >
        <View style={styles.slide2Card}>
          <Text style={styles.mapTitle}>YOUR SAVINGS ROADMAP</Text>
          <Text style={styles.mapSub}>Why chit funds are necessary for Indian families</Text>

          <View style={styles.corpusCard}>
            <LinearGradient
              colors={['#01789E', '#005E7D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.corpusGradient}
            >
              <View style={styles.corpusIconWrap}>
                <Text style={styles.corpusIconText}>₹</Text>
              </View>
              <View style={styles.corpusCopy}>
                <Text style={styles.corpusEyebrow}>CHIT SAVINGS</Text>
                <Text style={styles.corpusHeadline}>Flexible Corpus</Text>
                <Text style={styles.corpusMeta}>Built through disciplined monthly installments</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.flowBridge}>
            <View style={styles.flowBridgeLine} />
            <Text style={styles.flowBridgeLabel}>FUNDS YOUR GOALS</Text>
            <View style={styles.flowBridgeLine} />
          </View>

          <View style={styles.goalsGrid}>
            {SAVINGS_GOALS.map((goal) => (
              <GoalTile
                key={goal.label}
                label={goal.label}
                sub={goal.sub}
                color={goal.color}
                wide={goal.wide}
              />
            ))}
          </View>

          <View style={styles.projectionBar}>
            <View style={styles.projectionItem}>
              <Text style={styles.projectionLabel}>DISCIPLINE</Text>
              <Text style={styles.projectionVal}>Monthly</Text>
            </View>
            <View style={styles.projectionDivider} />
            <View style={styles.projectionItem}>
              <Text style={styles.projectionLabel}>LIQUIDITY</Text>
              <Text style={styles.projectionVal}>On demand</Text>
            </View>
            <View style={styles.projectionDivider} />
            <View style={styles.projectionItem}>
              <Text style={styles.projectionLabel}>COMMUNITY</Text>
              <Text style={styles.projectionVal}>Trusted pool</Text>
            </View>
          </View>

          <View style={styles.slide2TextBlock}>
            <Text style={styles.slide2Title}>{"Savings for Life's Priorities"}</Text>
            <Text style={styles.slide2Body}>
              A chit fund turns disciplined monthly savings into a flexible corpus for education,
              healthcare, emergencies, and major life goals — without market volatility.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const CHIT_STEPS = [
  {
    num: 1,
    title: 'Join a Chit Group',
    desc: 'Become a member in a trusted community savings pool with a fixed tenure.',
  },
  {
    num: 2,
    title: 'Pay Monthly Installments',
    desc: 'Contribute a fixed amount every month — building financial discipline.',
  },
  {
    num: 3,
    title: 'Bid in Monthly Auction',
    desc: 'Members bid for the pooled amount; highest bidder wins that cycle.',
  },
  {
    num: 4,
    title: 'Winner Gets Lump Sum',
    desc: 'The prize helps fund education, medical bills, or business needs early.',
  },
  {
    num: 5,
    title: 'Others Earn Dividends',
    desc: 'Non-winners receive a share of the discount — everyone benefits over time.',
  },
];

function Slide3Visual() {
  return (
    <View style={styles.visualCard}>
      <Text style={styles.flowTitle}>THE CHIT CYCLE</Text>
      <Text style={styles.flowSub}>Simple 5-step process every month</Text>

      <View style={styles.flowTimeline}>
        <View style={styles.flowLine} />
        {CHIT_STEPS.map((step, i) => (
          <View key={step.num} style={styles.flowStep}>
            <View style={[styles.flowNum, i === CHIT_STEPS.length - 1 && styles.flowNumFinal]}>
              <Text style={[styles.flowNumText, i === CHIT_STEPS.length - 1 && styles.flowNumTextFinal]}>{step.num}</Text>
            </View>
            <View style={styles.flowBody}>
              <Text style={styles.flowStepTitle}>{step.title}</Text>
              <Text style={styles.flowStepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.flowFooter}>
        <View style={styles.flowFooterIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </Svg>
        </View>
        <Text style={styles.flowFooterText}>
          Every member receives the full chit value once during the group tenure
        </Text>
      </View>
    </View>
  );
}

const VISUALS = [Slide1Visual, Slide2Visual, Slide3Visual];

// ─── Main Component ───────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(auth)/login');
    }
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1 });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const skip = () => {
    Haptics.selectionAsync();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        {currentIndex > 0 ? (
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
              <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </Svg>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        <Text style={styles.stepText}>{SLIDES[currentIndex].step}</Text>

        <TouchableOpacity onPress={skip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        style={styles.carousel}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        renderItem={({ item, index }) => {
          const Visual = VISUALS[index];
          return (
            <View style={styles.slide}>
              <ScrollView
                style={styles.slideScroll}
                contentContainerStyle={styles.slideScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Visual />
                {item.key === 'slide3' && (
                  <View style={styles.textSection}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        }}
      />

      {/* Bottom Section: CTA + Dots */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={goNext}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaBtnText}>{SLIDES[currentIndex].cta}</Text>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
          </Svg>
        </TouchableOpacity>

        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const isActive = i === currentIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  skipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slideScroll: {
    flex: 1,
  },
  slideScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },

  // ── Visualization Card ──
  visualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.3)',
    overflow: 'hidden',
    width: CARD_WIDTH,
    ...Shadows.blueTint,
  },
  slide2Outer: {
    width: CARD_WIDTH,
    alignItems: 'center',
    marginBottom: 12,
  },
  slide2GradientBorder: {
    width: CARD_WIDTH,
    borderRadius: 28,
    padding: 3,
    overflow: 'hidden',
    ...Shadows.blueTint,
  },
  slide2Card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  slide2TextBlock: {
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 22,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(190,200,206,0.25)',
    marginTop: 18,
  },
  slide2Title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#0B1C30',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slide2Body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 26,
    color: '#3F484E',
    textAlign: 'center',
  },

  // ── Slide 1: Leadership photo ──
  slide1Outer: {
    width: CARD_WIDTH,
    alignItems: 'center',
    marginBottom: 12,
  },
  slide1GradientBorder: {
    width: CARD_WIDTH,
    borderRadius: 28,
    padding: 3,
    overflow: 'hidden',
    ...Shadows.blueTint,
  },
  slide1Inner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    overflow: 'hidden',
  },
  slide1PhotoFrame: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(190,200,206,0.25)',
  },
  slide1Photo: {
    alignSelf: 'center',
  },
  slide1TextBlock: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
  },
  slide1Title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#0B1C30',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slide1Body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 26,
    color: '#3F484E',
    textAlign: 'center',
  },

  // ── Slide 2: Savings roadmap ──
  mapTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  mapSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  corpusCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadows.blueTint,
  },
  corpusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 16,
  },
  corpusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  corpusIconText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    color: '#FFFFFF',
  },
  corpusCopy: {
    flex: 1,
    gap: 3,
  },
  corpusEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.2,
  },
  corpusHeadline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  corpusMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
    marginTop: 2,
  },
  flowBridge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  flowBridgeLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(1,120,158,0.18)',
  },
  flowBridgeLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1.1,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    width: '100%',
    marginBottom: 18,
  },
  goalTile: {
    width: '48.5%',
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.35)',
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  goalTileWide: {
    width: '100%',
  },
  goalTileAccent: {
    width: 4,
  },
  goalTileBody: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 10,
    gap: 3,
  },
  goalTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  goalTileDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  goalTileLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#0B1C30',
    flex: 1,
  },
  goalTileSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    paddingLeft: 14,
  },
  projectionBar: {
    flexDirection: 'row',
    backgroundColor: '#EFF4FF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(1,120,158,0.12)',
    width: '100%',
  },
  projectionItem: {
    flex: 1,
    alignItems: 'center',
  },
  projectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  projectionVal: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  projectionDivider: {
    width: 1,
    backgroundColor: 'rgba(1,120,158,0.15)',
    marginHorizontal: 4,
  },

  // ── Slide 3: How chit works ──
  flowTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 4,
  },
  flowSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  flowTimeline: {
    position: 'relative',
    gap: 10,
    marginBottom: 12,
  },
  flowLine: {
    position: 'absolute',
    left: 15,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: 'rgba(1,120,158,0.15)',
    borderRadius: 1,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flowNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  flowNumFinal: {
    backgroundColor: '#54FAEF',
  },
  flowNumText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  flowNumTextFinal: {
    color: Colors.primary,
  },
  flowBody: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.3)',
  },
  flowStepTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#0B1C30',
    marginBottom: 2,
  },
  flowStepDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  flowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 12,
  },
  flowFooterIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowFooterText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#FFFFFF',
    lineHeight: 16,
  },

  // ── Legacy chart styles (unused, kept for reference) ──
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 140, // Reduced from 160
    gap: 8,
    marginBottom: 8,
  },
  bar: {
    width: 36,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barTooltip: {
    position: 'absolute',
    top: -52,
    left: '50%',
    transform: [{ translateX: -44 }],
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.4)',
    ...Shadows.subtle,
  },
  barTooltipLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  barTooltipValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: Colors.primary,
  },
  floatingCard: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...Shadows.subtle,
  },
  floatingCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#54FAEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
  },
  floatingCardValue: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    color: '#0B1C30',
  },

  // ── Slide 2 ──
  comparisonChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 180, // Reduced from 240
    gap: 24,
    paddingHorizontal: 16,
  },
  comparisonColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    height: '100%',
    justifyContent: 'flex-end',
  },
  comparisonBar: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  comparisonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  comparisonPct: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(190,200,206,0.5)',
    marginVertical: 12,
  },
  insightCard: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  insightSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  benefitsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.2)',
    gap: 4,
    ...Shadows.subtle,
  },
  benefitLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  benefitTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#0B1C30',
  },

  // ── Slide 3 ──
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  auctionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 6,
  },
  auctionPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10D7CD',
  },
  auctionBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  auctionTimer: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 16,
    color: '#94A3B8',
  },
  auctionProgressContainer: {
    marginBottom: 16,
  },
  auctionProgressTrack: {
    height: 8,
    backgroundColor: '#E5EEFF',
    borderRadius: 100,
    overflow: 'hidden',
  },
  auctionProgressFill: {
    height: '100%',
    backgroundColor: '#10D7CD',
    borderRadius: 100,
  },
  auctionProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  auctionProgressLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.3,
  },
  liquidityGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  liquidityCard: {
    flex: 1,
    backgroundColor: '#EFF4FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(190,200,206,0.2)',
    gap: 4,
  },
  liquidityLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  liquidityValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#0B1C30',
  },
  lastBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(190,200,206,0.4)',
  },
  lastBidAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastBidTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#0B1C30',
  },
  lastBidSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // ── Text Content ──
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 14,
    marginBottom: 8,
    width: CARD_WIDTH,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#0B1C30',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 26,
    color: '#3F484E',
    textAlign: 'center',
    maxWidth: CARD_WIDTH - 8,
  },
  subtitleHighlight: {
    fontFamily: 'Inter_700Bold',
    color: '#005E7D',
  },

  // ── Bottom Section ──
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 24, // Safe area space
    gap: 16, // Space between button and dots
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 100,
  },
  dotActive: {
    width: 32,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Shadows.premium,
  },
  ctaBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#BEC8CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.primary,
  },
});
