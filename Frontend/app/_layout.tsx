import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { MemberSessionProvider } from '../lib/MemberSessionContext';
import { routeForNotificationData } from '../lib/notifications';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  HindMadurai_400Regular,
  HindMadurai_500Medium,
  HindMadurai_600SemiBold,
  HindMadurai_700Bold,
} from '@expo-google-fonts/hind-madurai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../lib/constants';
import '../lib/i18n';
import { installWebAlertAdapter } from '../lib/webAlertAdapter';

installWebAlertAdapter();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Handles taps on push notifications (cold start + warm), routing the user to
// the relevant screen. Rendered inside the router tree so useRouter is valid.
function NotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const go = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data;
      const path = routeForNotificationData(data);
      if (path && mounted) router.push(path as any);
    };

    // App opened from a tap while killed (cold start).
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});

    // App already running / backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    HindMadurai_400Regular,
    HindMadurai_500Medium,
    HindMadurai_600SemiBold,
    HindMadurai_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <MemberSessionProvider>
          <StatusBar style="light" />
          <NotificationRouter />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          </Stack>
        </MemberSessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
