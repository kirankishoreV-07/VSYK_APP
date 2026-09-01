import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
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
