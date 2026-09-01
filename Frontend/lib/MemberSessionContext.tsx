import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLegacySupabaseAuthStorage, supabase } from './supabase';
import { registerForPushNotificationsAsync } from './notifications';

const SESSION_KEY = 'vsyk_member_id';

interface MemberProfile {
  id: string;
  customer_id?: string | null;
  customer_type?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  gstin_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
  credit_score?: number | null;
  kyc_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

/** Minimal shape of the Supabase session returned by the backend OTP verify. */
interface AuthSessionTokens {
  access_token: string;
  refresh_token: string;
}

interface MemberSessionContextType {
  memberId: string | null;
  memberProfile: MemberProfile | null;
  isLoading: boolean;
  /**
   * Establish an authenticated member session from the backend OTP-verify
   * response. Sets the real Supabase Auth session (so RLS/authorized queries
   * work) and records the resolved customer id.
   */
  loginWithSession: (session: AuthSessionTokens, customerId: string) => Promise<void>;
  setMember: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const MemberSessionContext = createContext<MemberSessionContextType>({
  memberId: null,
  memberProfile: null,
  isLoading: true,
  loginWithSession: async () => { },
  setMember: async () => { },
  logout: async () => { },
  refreshProfile: async () => { },
});

export function MemberSessionProvider({ children }: { children: React.ReactNode }) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async (id: string) => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, full_name, phone, email, age, gender, customer_type, address_line1, address_line2, city, state, postal_code, aadhar_number, pan_number, gstin_number, kyc_status, notes, created_at')
        .eq('id', id)
        .single();
      if (data) setMemberProfile(data);
    } catch (err) {
      console.error('Failed to load member profile:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        await clearLegacySupabaseAuthStorage();

        // Prefer the real authenticated Supabase session. The member's
        // customer id is carried in the auth user's metadata (set by the
        // backend OTP verify).
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // Supabase removes a non-retryable invalid refresh token from its
          // own storage. Clear our companion customer id as well so the app
          // cannot fall back into a half-authenticated member state.
          await AsyncStorage.removeItem(SESSION_KEY);
          if (mounted) {
            setMemberId(null);
            setMemberProfile(null);
          }
          return;
        }

        const metaCustomerId = (session?.user?.user_metadata as any)?.customer_id as string | undefined;
        if (session && metaCustomerId) {
          await AsyncStorage.setItem(SESSION_KEY, metaCustomerId);
          if (!mounted) return;
          setMemberId(metaCustomerId);
          await loadProfile(metaCustomerId);
          return;
        }

        // A customer id alone is not an authenticated session and cannot pass
        // the current RLS policies. Remove the old fallback instead of opening
        // member screens with a stale identity.
        await AsyncStorage.removeItem(SESSION_KEY);
        if (mounted) {
          setMemberId(null);
          setMemberProfile(null);
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_KEY);
        if (mounted) {
          setMemberId(null);
          setMemberProfile(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void restore();

    // Keep the app-level member identity synchronized with Supabase. This is
    // especially important when Auth automatically removes a revoked refresh
    // token and emits SIGNED_OUT.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event === 'INITIAL_SESSION')) {
        void AsyncStorage.removeItem(SESSION_KEY);
        if (mounted) {
          setMemberId(null);
          setMemberProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!memberId) return;
    registerForPushNotificationsAsync(memberId).catch((err) => {
      console.warn('Push registration failed:', err);
    });
    const channel = supabase
      .channel('member-profile-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${memberId}` }, () => {
        loadProfile(memberId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  const loginWithSession = async (session: AuthSessionTokens, customerId: string) => {
    // Install the real Supabase Auth session; all subsequent queries run as
    // this authenticated member (required for RLS in the next phase).
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw error;
    await AsyncStorage.setItem(SESSION_KEY, customerId);
    setMemberId(customerId);
    await loadProfile(customerId);
  };

  const setMember = async (id: string) => {
    await AsyncStorage.setItem(SESSION_KEY, id);
    setMemberId(id);
    await loadProfile(id);
  };

  const logout = async () => {
    try {
      // Local sign-out is sufficient for the device and still succeeds when
      // the server-side refresh token/session has already been revoked.
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      await AsyncStorage.removeItem(SESSION_KEY);
      setMemberId(null);
      setMemberProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (memberId) await loadProfile(memberId);
  };

  return (
    <MemberSessionContext.Provider value={{ memberId, memberProfile, isLoading, loginWithSession, setMember, logout, refreshProfile }}>
      {children}
    </MemberSessionContext.Provider>
  );
}

export function useMemberSession() {
  return useContext(MemberSessionContext);
}
