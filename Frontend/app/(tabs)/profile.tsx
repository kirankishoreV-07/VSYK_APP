import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Colors, Shadows } from '../../lib/constants';
import { useMemberSession } from '../../lib/MemberSessionContext';
import { useActiveChits, useDashboardStats, formatPaise } from '../../lib/hooks/useDashboard';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Puducherry',
];

const KYC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  verified:  { bg: '#DCFCE7', text: '#15803D', label: '✓ KYC Verified' },
  pending:   { bg: '#FEF9C3', text: '#A16207', label: '⏳ KYC Pending' },
  rejected:  { bg: '#FEE2E2', text: '#B91C1C', label: '✗ KYC Rejected' },
};

function InfoRow({ label, value, dimmed = false }: { label: string; value?: string | null; dimmed?: boolean }) {
  return (
    <View style={r.row}>
      <Text style={r.rowLabel}>{label}</Text>
      <Text style={[r.rowValue, dimmed && { color: '#94A3B8' }]}>
        {value || '—'}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { memberId, memberProfile, refreshProfile, logout } = useMemberSession();
  const { data: chits } = useActiveChits(memberId);
  const { data: stats } = useDashboardStats(memberId);
  const { t, i18n } = useTranslation();

  const isTamil = i18n.language === 'ta';
  const isEnglish = !isTamil;

  const switchLanguage = (lng: string) => {
    Haptics.selectionAsync();
    i18n.changeLanguage(lng);
  };

  // Editable fields (mirroring admin form)
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateForm, setStateForm] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [showStateDD, setShowStateDD] = useState(false);

  // Seed editable state from profile
  useEffect(() => {
    if (memberProfile) {
      setFullName(memberProfile.full_name ?? '');
      setEmail(memberProfile.email ?? '');
      setAddressLine1(memberProfile.address_line1 ?? '');
      setAddressLine2(memberProfile.address_line2 ?? '');
      setCity(memberProfile.city ?? '');
      setStateForm(memberProfile.state ?? '');
      setPostalCode(memberProfile.postal_code ?? '');
      setNotes(memberProfile.notes ?? '');
    }
  }, [memberProfile]);

  // Real-time: if admin updates customer record → refresh profile
  useEffect(() => {
    if (!memberId) return;
    const channel = supabase
      .channel(`profile-rt-${memberId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'customers',
        filter: `id=eq.${memberId}`,
      }, () => refreshProfile())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [memberId]);

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').update({
        full_name: fullName.trim() || memberProfile?.full_name,
        email: email.trim() || null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: stateForm.trim() || null,
        postal_code: postalCode.trim() || null,
        notes: notes.trim() || null,
      }).eq('id', memberId);

      if (error) throw error;
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditMode(false);
      Alert.alert('Saved ✓', 'Your profile has been updated.');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (!memberProfile) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const kyc = KYC_COLORS[memberProfile.kyc_status ?? 'pending'] ?? KYC_COLORS.pending;
  const initial = memberProfile.full_name?.charAt(0).toUpperCase() ?? 'V';
  const joinedDate = memberProfile.created_at
    ? new Date(memberProfile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* App Bar */}
        <View style={s.appBar}>
          <Text style={s.appBarTitle}>My Profile</Text>
          <TouchableOpacity
            style={[s.editBtn, editMode && { backgroundColor: Colors.primary }]}
            onPress={() => {
              Haptics.selectionAsync();
              if (editMode) handleSave();
              else setEditMode(true);
            }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={[s.editBtnText, editMode && { color: '#FFF' }]}>
                {editMode ? 'Save' : 'Edit'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={s.heroCard}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
            <Text style={s.heroName}>{memberProfile.full_name}</Text>
            <Text style={s.heroPhone}>+91 {memberProfile.phone}</Text>
            <View style={[s.kycBadge, { backgroundColor: kyc.bg }]}>
              <Text style={[s.kycText, { color: kyc.text }]}>{kyc.label}</Text>
            </View>
            {joinedDate && (
              <Text style={s.joinedText}>Member since {joinedDate}</Text>
            )}
          </View>

          {/* Quick Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>ACTIVE GROUPS</Text>
              <Text style={s.statVal}>{chits?.length ?? 0}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>TOTAL VALUE</Text>
              <Text style={s.statVal}>{formatPaise(stats?.total_portfolio_value ?? 0)}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>CUSTOMER TYPE</Text>
              <Text style={s.statVal}>{memberProfile.customer_type ?? 'Individual'}</Text>
            </View>
          </View>

          {/* ── PERSONAL INFORMATION ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Personal Information</Text>
            <View style={s.card}>
              {editMode ? (
                <>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>FULL NAME</Text>
                    <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="Full name" />
                  </View>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>EMAIL ADDRESS</Text>
                    <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" autoCapitalize="none" />
                  </View>
                </>
              ) : (
                <>
                  <InfoRow label="Full Name" value={memberProfile.full_name} />
                  <View style={s.divider} />
                  <InfoRow label="Email" value={memberProfile.email} dimmed={!memberProfile.email} />
                </>
              )}
              <View style={s.divider} />
              <InfoRow label="Phone" value={`+91 ${memberProfile.phone}`} />
              <View style={s.divider} />
              <InfoRow label="Age" value={memberProfile.age ? `${memberProfile.age} years` : null} />
              {memberProfile.customer_type === 'Individual' && (
                <>
                  <View style={s.divider} />
                  <InfoRow label="Gender" value={memberProfile.gender} />
                </>
              )}
              {memberProfile.customer_type === 'Company' && memberProfile.gstin_number && (
                <>
                  <View style={s.divider} />
                  <InfoRow label="GSTIN" value={memberProfile.gstin_number} />
                </>
              )}
            </View>
          </View>

          {/* ── ADDRESS DETAILS ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Address Details</Text>
            <View style={s.card}>
              {editMode ? (
                <>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>ADDRESS LINE 1</Text>
                    <TextInput style={s.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="Flat/House No, Building" />
                  </View>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>ADDRESS LINE 2</Text>
                    <TextInput style={s.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Street, Area" />
                  </View>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>CITY</Text>
                    <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="City" />
                  </View>
                  <View style={[s.fieldGroup, { zIndex: 100 }]}>
                    <Text style={s.fieldLabel}>STATE</Text>
                    <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowStateDD(!showStateDD)}>
                      <Text style={stateForm ? s.dropdownVal : s.dropdownPlaceholder}>
                        {stateForm || 'Select State'}
                      </Text>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="#94A3B8">
                        <Path d="M7 10l5 5 5-5z" />
                      </Svg>
                    </TouchableOpacity>
                    {showStateDD && (
                      <ScrollView style={s.dropdown} nestedScrollEnabled>
                        {INDIAN_STATES.filter(st => st.toLowerCase().includes(stateForm.toLowerCase())).map(st => (
                          <TouchableOpacity key={st} style={s.dropdownItem} onPress={() => { setStateForm(st); setShowStateDD(false); }}>
                            <Text style={s.dropdownItemText}>{st}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>POSTAL CODE</Text>
                    <TextInput style={s.input} value={postalCode} onChangeText={setPostalCode} placeholder="000000" keyboardType="number-pad" maxLength={6} />
                  </View>
                </>
              ) : (
                <>
                  <InfoRow label="Address Line 1" value={memberProfile.address_line1} />
                  <View style={s.divider} />
                  <InfoRow label="Address Line 2" value={memberProfile.address_line2} dimmed={!memberProfile.address_line2} />
                  <View style={s.divider} />
                  <InfoRow label="City" value={memberProfile.city} />
                  <View style={s.divider} />
                  <InfoRow label="State" value={memberProfile.state} />
                  <View style={s.divider} />
                  <InfoRow label="Postal Code" value={memberProfile.postal_code} />
                </>
              )}
            </View>
          </View>

          {/* ── KYC DOCUMENTS ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>KYC Documents</Text>
            <View style={s.card}>
              <InfoRow
                label="PAN Number"
                value={memberProfile.pan_number
                  ? `${memberProfile.pan_number.slice(0, 3)}••••${memberProfile.pan_number.slice(-1)}`
                  : null}
                dimmed={!memberProfile.pan_number}
              />
              <View style={s.divider} />
              <InfoRow
                label="Aadhaar"
                value={memberProfile.aadhar_number
                  ? `XXXX XXXX ${memberProfile.aadhar_number.slice(-4)}`
                  : null}
                dimmed={!memberProfile.aadhar_number}
              />
              <View style={s.divider} />
              <InfoRow label="KYC Status" value={kyc.label} />
            </View>
            <Text style={s.secureNote}>
              🔒 KYC documents can only be updated by the admin. Contact your chit group admin for any KYC changes.
            </Text>
          </View>

          {/* ── NOTES ── */}
          {(memberProfile.notes || editMode) && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Notes</Text>
              <View style={s.card}>
                {editMode ? (
                  <View style={s.fieldGroup}>
                    <TextInput
                      style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Any additional notes..."
                      multiline
                    />
                  </View>
                ) : (
                  <InfoRow label="Notes" value={memberProfile.notes} dimmed={!memberProfile.notes} />
                )}
              </View>
            </View>
          )}

          {/* ── LANGUAGE SWITCHER ── */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, isTamil && { fontFamily: 'HindMadurai_700Bold' }]}>
              {t('profile.preferred_language')}
            </Text>
            <View style={s.langRow}>
              <TouchableOpacity
                style={[s.langBtn, isEnglish && s.langBtnActive]}
                activeOpacity={0.8}
                onPress={() => switchLanguage('en')}
              >
                <Text style={[s.langBtnText, isEnglish && s.langBtnTextActive]}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.langBtn, isTamil && s.langBtnActive]}
                activeOpacity={0.8}
                onPress={() => switchLanguage('ta')}
              >
                <Text style={[s.langBtnText, isTamil && s.langBtnTextActive, { fontFamily: 'HindMadurai_700Bold' }]}>
                  தமிழ்
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cancel Edit */}
          {editMode && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setEditMode(false);
                // Reset to profile values
                setFullName(memberProfile.full_name ?? '');
                setEmail(memberProfile.email ?? '');
                setAddressLine1(memberProfile.address_line1 ?? '');
                setAddressLine2(memberProfile.address_line2 ?? '');
                setCity(memberProfile.city ?? '');
                setStateForm(memberProfile.state ?? '');
                setPostalCode(memberProfile.postal_code ?? '');
                setNotes(memberProfile.notes ?? '');
              }}
            >
              <Text style={s.cancelBtnText}>Cancel Changes</Text>
            </TouchableOpacity>
          )}

          {/* Logout */}
          {!editMode && (
            <TouchableOpacity style={s.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="#EF4444">
                <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </Svg>
              <Text style={s.logoutTxt}>Sign Out</Text>
            </TouchableOpacity>
          )}

          <Text style={s.version}>VSYK CHITS · App v4.2.0</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared Info Row ───────────────────────────────────────────
const r = StyleSheet.create({
  row: { paddingVertical: 14, paddingHorizontal: 4 },
  rowLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  rowValue: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#0B1C30' },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  appBar: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)', ...Shadows.subtle,
  },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#0B1C30' },
  editBtn: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  editBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.primary },

  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },

  heroCard: {
    backgroundColor: Colors.primary, borderRadius: 28, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  avatarInitial: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#FFF' },
  heroName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#FFF', letterSpacing: -0.5 },
  heroPhone: { fontFamily: 'Inter_500Medium', fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  kycBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  kycText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  joinedText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 14,
    gap: 6, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', ...Shadows.subtle,
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#94A3B8', letterSpacing: 0.5, textAlign: 'center' },
  statVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: Colors.primary, textAlign: 'center' },

  section: { gap: 8 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#0B1C30', marginLeft: 4 },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.3)', ...Shadows.subtle,
  },
  divider: { height: 1, backgroundColor: '#F1F5F9' },

  // Edit mode
  fieldGroup: { paddingVertical: 10 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    fontFamily: 'Inter_500Medium', fontSize: 15, color: '#0B1C30',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F8FAFC',
  },

  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F8FAFC',
  },
  dropdownVal: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#0B1C30' },
  dropdownPlaceholder: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#94A3B8' },
  dropdown: {
    position: 'absolute', top: 52, left: 0, right: 0, zIndex: 200,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    maxHeight: 180, ...Shadows.subtle,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#0B1C30' },

  secureNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', marginLeft: 4, lineHeight: 18 },

  cancelBtn: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#F8FAFC',
  },
  cancelBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#64748B' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  logoutTxt: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#EF4444' },

  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', textAlign: 'center' },

  // Language switcher
  langRow: {
    flexDirection: 'row', backgroundColor: '#F1F5F9',
    borderRadius: 14, padding: 4, gap: 4,
  },
  langBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  langBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  langBtnTextActive: { color: '#FFF' },
});
