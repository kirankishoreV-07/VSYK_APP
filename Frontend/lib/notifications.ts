import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show notifications even when the app is in the foreground (banner + sound).
// Without this, push messages received while the app is open are silently
// dropped, so members never see auction/payment alerts while using the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android requires an explicit channel for heads-up notifications.
export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'VSYK Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#005E7D',
  });
}

export async function registerForPushNotificationsAsync(customerId: string) {
    if (!Device.isDevice) return;

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
