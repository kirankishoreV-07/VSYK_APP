import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
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

interface MemberSessionContextType {
  memberId: string | null;
  memberProfile: MemberProfile | null;
  isLoading: boolean;
  setMember: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const MemberSessionContext = createContext<MemberSessionContextType>({
  memberId: null,
  memberProfile: null,
  isLoading: true,
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
    const restore = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_KEY);
        if (stored) {
          setMemberId(stored);
          await loadProfile(stored);
        }
      } finally {
        setIsLoading(false);
      }
    };
    restore();
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

  const setMember = async (id: string) => {
    await AsyncStorage.setItem(SESSION_KEY, id);
    setMemberId(id);
    await loadProfile(id);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setMemberId(null);
    setMemberProfile(null);
  };

  const refreshProfile = async () => {
    if (memberId) await loadProfile(memberId);
  };

  return (
    <MemberSessionContext.Provider value={{ memberId, memberProfile, isLoading, setMember, logout, refreshProfile }}>
      {children}
    </MemberSessionContext.Provider>
  );
}

export function useMemberSession() {
  return useContext(MemberSessionContext);
}
