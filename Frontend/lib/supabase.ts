import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Keep the auth storage namespace under our control. The app previously used
// Supabase's generated default key; sessions created before the OTP/admin-auth
// rework can contain refresh tokens that no longer exist server-side. Reading
// one of those tokens during client initialization causes AuthApiError:
// "Invalid Refresh Token: Refresh Token Not Found". Versioning the key makes
// that one-time auth migration explicit and prevents the stale token from
// being restored. Users with an old session will simply log in again.
const AUTH_STORAGE_KEY = 'vsyk-auth-session-v2';

/** Remove the pre-v2 Supabase storage entries after the auth-key migration. */
export async function clearLegacySupabaseAuthStorage(): Promise<void> {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    if (!projectRef) return;
    const legacyKey = `sb-${projectRef}-auth-token`;
    await AsyncStorage.multiRemove([
      legacyKey,
      `${legacyKey}-code-verifier`,
      `${legacyKey}-user`,
    ]);
  } catch {
    // A malformed/missing URL is handled by the Supabase client itself. Auth
    // cleanup should never prevent the app from rendering.
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // On mobile the websocket commonly drops with a transient close (code 1001
    // "Stream end encountered") when the app is backgrounded or the network
    // flaps. Reconnect quickly with a capped backoff so subscriptions recover
    // on their own instead of staying dead until a manual refresh.
    reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000),
    timeout: 20000,
  },
});
