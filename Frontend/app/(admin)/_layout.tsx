import { useEffect, useRef, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform, View, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';

function parentPathForNestedAdminRoute(pathname: string): string | null {
  if (/^\/customers\/[^/]+\/(groups|payments|auctions|diagnostics|activity)$/.test(pathname)) {
    return pathname.replace(/\/(groups|payments|auctions|diagnostics|activity)$/, '');
  }
  if (/^\/customers\/[^/]+$/.test(pathname)) return '/customers';
  if (/^\/groups\/[^/]+\/members$/.test(pathname)) return pathname.replace(/\/members$/, '');
  if (/^\/groups\/[^/]+$/.test(pathname)) return '/groups';
  if (pathname === '/auctions/live') return '/auctions';
  if (pathname === '/reports') return '/settings';
  if (pathname === '/collections/followups') return '/dashboard';
  return null;
}

function useWebAdminHistoryGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = useRef(pathname);
  activePath.current = pathname;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handlePopState = () => {
      const parent = parentPathForNestedAdminRoute(activePath.current);
      if (parent && window.location.pathname !== parent) router.replace(parent as any);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router]);
}

// Guards every /(admin)/* screen: a Supabase Auth session alone is not
// enough (a logged-in member also has one) — admin status requires a row in
// admin_users, checked via RLS on every load so a revoked/never-admin
// session can never render admin screens even if the login screen was
// bypassed some other way.
function useAdminGuard() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) router.replace('/(auth)/login');
        return;
      }
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!adminRow) {
        if (!cancelled) router.replace('/(auth)/login');
        return;
      }
      if (!cancelled) setChecked(true);
    }
    check();
    return () => { cancelled = true; };
  }, [router]);

  return checked;
}

export default function AdminLayout() {
  const isAdmin = useAdminGuard();
  useWebAdminHistoryGuard();

  if (!isAdmin) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#005E7D" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#005E7D',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.97)' }]} />
          ),
      }}
    >
      {/* ── TAB 1: DASHBOARD ── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.pill : styles.noPill}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
                <Path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
              </Svg>
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />

      {/* ── TAB 2: CUSTOMERS ── */}
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.pill : styles.noPill}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
                <Path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </Svg>
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />

      {/* ── TAB 3: GROUPS (Chits) ── */}
      <Tabs.Screen
        name="groups/index"
        options={{
          title: 'Chits',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.pill : styles.noPill}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
                <Path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </Svg>
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />

      {/* ── TAB 4: AUCTIONS ── */}
      <Tabs.Screen
        name="auctions/index"
        options={{
          title: 'Auctions',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.pill : styles.noPill}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
                <Path d="M6.29 14.04L1 19.33 2.67 21 7.96 15.71l-1.67-1.67zM21 7l-3.54-3.54-2.83 2.83 1.41 1.42-7.07 7.07-1.42-1.41-2.83 2.83 3.54 3.53 1.41-1.41 7.07-7.07 1.42 1.42L21 7z" />
              </Svg>
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />

      {/* ── TAB 5: SETTINGS ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.pill : styles.noPill}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={color}>
                <Path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
              </Svg>
            </View>
          ),
        }}
        listeners={{ tabPress: () => Haptics.selectionAsync() }}
      />

      {/* ── HIDDEN ROUTES ── */}
      <Tabs.Screen
        name="reports"
        options={{ href: null, title: 'Reports' }}
      />
      <Tabs.Screen
        name="collections/followups"
        options={{ href: null, title: 'Collections Follow-ups' }}
      />
      <Tabs.Screen
        name="auctions/live"
        options={{ href: null, title: 'Live Auction' }}
      />
      <Tabs.Screen
        name="groups/[id]"
        options={{ href: null, title: 'Group Detail' }}
      />
      <Tabs.Screen
        name="customers/[id]"
        options={{ href: null, title: 'Customer Detail' }}
      />
      <Tabs.Screen
        name="customers/[id]/groups"
        options={{ href: null, title: 'Customer Groups' }}
      />
      <Tabs.Screen
        name="customers/[id]/payments"
        options={{ href: null, title: 'Customer Payments' }}
      />
      <Tabs.Screen
        name="customers/[id]/auctions"
        options={{ href: null, title: 'Customer Auctions' }}
      />
      <Tabs.Screen
        name="customers/[id]/diagnostics"
        options={{ href: null, title: 'Customer Diagnostics' }}
      />
      <Tabs.Screen
        name="customers/[id]/activity"
        options={{ href: null, title: 'Customer Activity' }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    elevation: 0,
    height: Platform.OS === 'ios' ? 90 : 72,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#01789E',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tabBarLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    marginTop: 2,
    marginBottom: Platform.OS === 'ios' ? 0 : 8,
    letterSpacing: 0.3,
  },
  pill: {
    backgroundColor: 'rgba(0, 94, 125, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  noPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
});
