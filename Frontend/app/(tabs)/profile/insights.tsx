import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../../lib/constants';
import { useParentBack } from '../../../lib/hooks/useParentBack';

const { width } = Dimensions.get('window');
const SW = width - 40;

export default function AIInsightsScreen() {
  const router = useRouter();
  const handleBack = useParentBack('/(tabs)/profile');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back to profile">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Insights</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.secondary}>
              <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" />
            </Svg>
            <Text style={s.headerLabel}>AI MONTHLY INSIGHTS</Text>
          </View>
          <Text style={s.headerTitle}>Your September Review</Text>
          <Text style={s.headerSub}>Smart analytics derived from your chit performance and savings behavior.</Text>
        </View>

        {/* Dividend Yield Analysis */}
        <View style={s.card}>
          <View style={{ position: 'absolute', right: -40, top: -40, width: 150, height: 150, backgroundColor: `${Colors.secondary}15`, borderRadius: 75 }} />
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <Text style={s.cardTitle}>Dividend Yield Analysis</Text>
              <Text style={s.cardSub}>Profitability across active chits</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeTxt}>+12.4% APR</Text>
            </View>
          </View>

          {/* Bar Chart Mock */}
          <View style={s.chartBox}>
            {[40, 60, 85, 95, 70, 55].map((h, i) => (
              <View key={i} style={[s.bar, { height: `${h}%`, backgroundColor: i === 3 ? Colors.secondary : '#F8FAFC' }]} />
            ))}
          </View>

          <View style={s.cardFooter}>
            <Text style={s.footerLabel}>LATEST DIVIDEND</Text>
            <Text style={s.footerVal}>₹4,250.00</Text>
          </View>
        </View>

        {/* Bento Grid */}
        <View style={s.bentoGrid}>
          {/* Auction Trends */}
          <View style={s.bentoBox}>
            <View>
              <View style={[s.iconBox, { backgroundColor: '#F8FAFC' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.primary}>
                  <Path d="M14 11c1.66 0 2.99-1.34 2.99-3S15.66 5 14 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </Svg>
              </View>
              <Text style={s.bentoTitle}>Auction Trends</Text>
            </View>
            <View>
              <Text style={s.bentoSub}>Next bid suggested</Text>
              <Text style={s.bentoVal}>₹18,500</Text>
            </View>
          </View>

          {/* Market Highs */}
          <View style={[s.bentoBox, { backgroundColor: Colors.primary }]}>
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 40 }} />
            <View>
              <View style={[s.iconBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.secondary}>
                  <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                </Svg>
              </View>
              <Text style={[s.bentoTitle, { color: '#FFF' }]}>Market Highs</Text>
            </View>
            <View>
              <Text style={[s.bentoSub, { color: 'rgba(255,255,255,0.7)' }]}>Volume peak</Text>
              <Text style={s.bentoVal}>8.2% UP</Text>
            </View>
          </View>
        </View>

        {/* Savings Milestone */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={s.cardTitle}>Savings Milestone</Text>
              <Text style={s.cardSub}>Target: Family Home Fund</Text>
            </View>
            <View style={s.ringContainer}>
              <Svg width={60} height={60} viewBox="0 0 60 60" style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx="30" cy="30" r="24" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                <Circle cx="30" cy="30" r="24" fill="none" stroke={Colors.secondary} strokeWidth="6" strokeDasharray="150" strokeDashoffset="37.5" strokeLinecap="round" />
              </Svg>
              <Text style={s.ringText}>75%</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View style={s.listItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={s.listIconBox}><Text style={{ fontSize: 16 }}>💰</Text></View>
                <Text style={s.listTitle}>Chit #802 (Group A)</Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.secondary}>
                <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </Svg>
            </View>
            <View style={[s.listItem, { backgroundColor: '#FFFFFF' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.listIconBox, { backgroundColor: '#F8FAFC' }]}><Text style={{ fontSize: 16 }}>⏳</Text></View>
                <Text style={[s.listTitle, { color: '#64748B' }]}>Pending Verification</Text>
              </View>
              <Text style={s.listMeta}>IN 2 DAYS</Text>
            </View>
          </View>
        </View>

        {/* Boost Potential CTA */}
        <View style={s.ctaCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 24 }}>🚀</Text>
            <Text style={s.ctaTitle}>Boost Potential</Text>
          </View>
          <Text style={s.ctaSub}>Participate in the upcoming 'Mega 50' chit to increase your projected dividends by 18% this quarter.</Text>
          <TouchableOpacity style={s.ctaBtn} activeOpacity={0.9} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}>
            <Text style={s.ctaBtnTxt}>EXPLORE NEW GROUPS</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },
  
  scroll: { padding: 20, gap: 24 },
  
  header: { marginBottom: 8 },
  headerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.secondary, letterSpacing: 1.5 },
  headerTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: Colors.primary, marginBottom: 8 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#64748B', lineHeight: 22 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle, overflow: 'hidden' },
  cardTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', marginTop: 4 },
  badge: { backgroundColor: '#E0FDFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  badgeTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#006B65' },
  
  chartBox: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 24 },
  bar: { flex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  footerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', letterSpacing: 1 },
  footerVal: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.primary },

  bentoGrid: { flexDirection: 'row', gap: 16, height: 180 },
  bentoBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle, overflow: 'hidden' },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bentoTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary, lineHeight: 24 },
  bentoSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginBottom: 4 },
  bentoVal: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.secondary },

  ringContainer: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: Colors.primary },

  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  listIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...Shadows.subtle },
  listTitle: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.primary },
  listMeta: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', letterSpacing: 1 },

  ctaCard: { backgroundColor: Colors.primary, borderRadius: 24, padding: 24, marginTop: 16 },
  ctaTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#FFFFFF' },
  ctaSub: { fontFamily: 'Inter_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 22, marginBottom: 24 },
  ctaBtn: { backgroundColor: Colors.secondary, width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  ctaBtnTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.primary, letterSpacing: 1 },
});
