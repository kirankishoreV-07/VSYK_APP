import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type NotificationsModule = typeof import('expo-notifications');
export type NotificationResponse = import('expo-notifications').NotificationResponse;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let notificationsPromise: Promise<NotificationsModule | null> | null = null;
let handlerConfigured = false;

// Importing expo-notifications itself produces an SDK 53+ runtime error in
// Expo Go because remote push support was removed from the store client. Keep
// the native module lazy so Expo Go can still exercise the rest of the app;
// development, preview and production builds continue to load it normally.
function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return Promise.resolve(null);
  if (!notificationsPromise) notificationsPromise = import('expo-notifications');
  return notificationsPromise;
}

async function configureNotificationHandler() {
  const Notifications = await getNotifications();
  if (!Notifications || handlerConfigured) return Notifications;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
  return Notifications;
}

// Android requires an explicit channel for heads-up notifications.
export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = await configureNotificationHandler();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'VSYK Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#005E7D',
  });
}

export async function registerForPushNotificationsAsync(customerId: string) {
    if (!Device.isDevice) return;

    const Notifications = await configureNotificationHandler();
    if (!Notifications) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    await ensureAndroidNotificationChannel();

    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse?.data;
    if (!token) return;

    await supabase.from('member_device_tokens').upsert({
        customer_id: customerId,
        fcm_token: token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
    });
}

/**
 * Route notification taps in native development/preview/production builds.
 * Expo Go returns a harmless no-op unsubscribe function.
 */
export async function subscribeToNotificationResponses(
  listener: (response: NotificationResponse | null) => void,
): Promise<() => void> {
  const Notifications = await configureNotificationHandler();
  if (!Notifications) return () => {};

  Notifications.getLastNotificationResponseAsync().then(listener).catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(listener);
  return () => subscription.remove();
}

// Map a notification's data payload to an in-app destination. Auction-related
// alerts deep-link to the auctions tab; payment reminders to the wallet.
export function routeForNotificationData(data: any): string | null {
    const type = data?.type;
    switch (type) {
        case 'auction_starting_soon':
        case 'auction_live':
        case 'auction_completed':
        case 'auction_winner':
        case 'auction_closed':
        case 'auction_scheduled':
            return '/(tabs)/member-auctions';
        case 'payment_due':
        case 'installment_due':
            return '/(tabs)/wallet';
        default:
            return null;
    }
}
