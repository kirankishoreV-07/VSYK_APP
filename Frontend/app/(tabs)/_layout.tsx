import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../lib/constants';
import { useTranslation } from 'react-i18next';
import { useMemberSession } from '../../lib/MemberSessionContext';

// ─── Tab Item Component ───────────────────────────────────────
type TabIconProps = { focused: boolean; label: string; children: React.ReactNode };

function TabItem({ focused, label, children }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      {children}
      <Text
        style={[styles.tabLabel, { color: focused ? Colors.primary : '#94A3B8' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Icons ────────────────────────────────────────────────────
const HomeIcon = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={c}>
    <Path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </Svg>
);
const ChitsIcon = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={c}>
    <Path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </Svg>
);
const AuctionsIcon = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={c}>
    <Path d="M7 2v11h3v9l7-12h-4l4-8z" />
  </Svg>
);
const WalletIcon = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={c}>
    <Path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </Svg>
);
const ProfileIcon = ({ c }: { c: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill={c}>
    <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </Svg>
);

// ─── Layout ───────────────────────────────────────────────────
export default function TabLayout() {
  const { t, i18n } = useTranslation();
  const { memberId, isLoading } = useMemberSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !memberId) router.replace('/(auth)/login');
  }, [isLoading, memberId, router]);

  if (isLoading || !memberId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  // Use a simple key to force re-render of Tabs when language changes
  const langKey = i18n.language;

  return (
    <Tabs
      key={langKey}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} label={t('nav.home')}>
              <HomeIcon c={focused ? Colors.primary : '#94A3B8'} />
            </TabItem>
          ),
        }}
      />
      <Tabs.Screen
        name="chits"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} label={t('nav.chits')}>
              <ChitsIcon c={focused ? Colors.primary : '#94A3B8'} />
            </TabItem>
          ),
        }}
      />
      <Tabs.Screen
        name="member-auctions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} label={t('nav.auctions')}>
              <AuctionsIcon c={focused ? Colors.primary : '#94A3B8'} />
            </TabItem>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} label={t('nav.wallet')}>
              <WalletIcon c={focused ? Colors.primary : '#94A3B8'} />
            </TabItem>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem focused={focused} label={t('nav.profile')}>
              <ProfileIcon c={focused ? Colors.primary : '#94A3B8'} />
            </TabItem>
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
      <Tabs.Screen name="join" options={{ href: null }} />
      <Tabs.Screen name="chit/[id]" options={{ href: null }} />
      <Tabs.Screen name="history/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/insights" options={{ href: null }} />
      <Tabs.Screen name="profile/nominees" options={{ href: null }} />
      <Tabs.Screen name="profile/foreclosure" options={{ href: null }} />
      <Tabs.Screen name="profile/privacy-policy" options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  tabBar: {
    height: Platform.OS === 'ios' ? 82 : 66,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.6)',
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 6,
  },
  tabBarItem: {
    // Give each item enough room so the label never wraps
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,         // Fixed width — wide enough for "Auctions"
    gap: 3,
  },
  tabLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false, // Android fix — removes extra padding
  },
});
