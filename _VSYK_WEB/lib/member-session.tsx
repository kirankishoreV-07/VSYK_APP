"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/lib/types";

const SESSION_KEY = "vsyk_member_id";

const PROFILE_COLUMNS =
  "id, full_name, phone, email, age, gender, customer_type, address_line1, address_line2, city, state, postal_code, aadhar_number, pan_number, gstin_number, kyc_status, notes, created_at";

interface MemberSessionValue {
  memberId: string | null;
  memberProfile: Customer | null;
  isLoading: boolean;
  setMember: (id: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const MemberSessionContext = createContext<MemberSessionValue>({
  memberId: null,
  memberProfile: null,
  isLoading: true,
  setMember: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export function MemberSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("customers")
      .select(PROFILE_COLUMNS)
      .eq("id", id)
      .single();
    if (data) setMemberProfile(data as Customer);
  }, []);

  // Restore session from localStorage on mount.
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SESSION_KEY)
        : null;
    if (stored) {
      setMemberId(stored);
      loadProfile(stored).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadProfile]);

  // Live profile updates (mobile parity).
  useEffect(() => {
    if (!memberId) return;
    const channel = supabase
      .channel("member-profile-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `id=eq.${memberId}`,
        },
        () => loadProfile(memberId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, loadProfile]);

  const setMember = useCallback(
    async (id: string) => {
      window.localStorage.setItem(SESSION_KEY, id);
      setMemberId(id);
      await loadProfile(id);
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setMemberId(null);
    setMemberProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (memberId) await loadProfile(memberId);
  }, [memberId, loadProfile]);

  return (
    <MemberSessionContext.Provider
      value={{
        memberId,
        memberProfile,
        isLoading,
        setMember,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </MemberSessionContext.Provider>
  );
}

export function useMemberSession() {
  return useContext(MemberSessionContext);
}
