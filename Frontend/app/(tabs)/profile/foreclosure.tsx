import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '../../../components/LocalizedText';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../../lib/constants';
import { apiPostAuthed } from '../../../lib/api';
import { useMemberSession } from '../../../lib/MemberSessionContext';
import { formatPaise, useActiveChits } from '../../../lib/hooks/useDashboard';
import { useParentBack } from '../../../lib/hooks/useParentBack';
import { useTranslation } from 'react-i18next';

export default function ForeclosureScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = useParentBack('/(tabs)/profile');
  const { memberId } = useMemberSession();
  const { data: activeChits = [], isLoading: loadingChits, error: chitsError } = useActiveChits(memberId);
  const [reason, setReason] = useState('');
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedMembershipId && activeChits.length > 0) {
      setSelectedMembershipId(activeChits[0].membership_id);
    }
  }, [activeChits, selectedMembershipId]);

  const selectedChit = activeChits.find((chit) => chit.membership_id === selectedMembershipId);

  const handleSubmit = () => {
    if (!selectedMembershipId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('foreclosure.noActive'), t('foreclosure.selectBeforeSubmit'));
      return;
    }
    if (reason.trim().length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('foreclosure.reasonRequired'), t('foreclosure.reasonRequiredHelp'));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t('foreclosure.confirmTitle'),
      t('foreclosure.confirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.submit'),
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await apiPostAuthed<{ ok: boolean; alreadyRequested: boolean }>(
                '/api/account/foreclosure-request',
                { chitMemberId: selectedMembershipId, reason: reason.trim() },
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                result.alreadyRequested ? t('foreclosure.alreadySubmitted') : t('profile.requestSubmitted'),
                result.alreadyRequested
                  ? t('foreclosure.pendingReview')
                  : t('foreclosure.recorded'),
                [{ text: t('common.ok'), onPress: handleBack }],
              );
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t('foreclosure.submissionFailed'), error?.message || t('foreclosure.submissionFailedHelp'));
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel={t('common.backToProfile')}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{t('foreclosure.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Warning Banner */}
        <View style={s.warningBanner}>
          <View style={s.warningIcon}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#B91C1C">
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.warningTitle}>{t('foreclosure.highImpact')}</Text>
            <Text style={s.warningSub}>{t('foreclosure.highImpactHelp')}</Text>
          </View>
        </View>

        {/* Eligible memberships */}
        <View style={s.card}>
          <Text style={s.cardLabel}>{t('foreclosure.selectGroup')}</Text>
          {loadingChits ? (
            <ActivityIndicator color={Colors.secondary} style={s.loader} />
          ) : chitsError ? (
            <Text style={s.errorText}>{t('foreclosure.loadFailed')}</Text>
          ) : activeChits.length === 0 ? (
            <Text style={s.cardSub}>{t('foreclosure.noEligible')}</Text>
          ) : (
            <>
              <View style={s.chitOptions}>
                {activeChits.map((chit) => {
                  const selected = chit.membership_id === selectedMembershipId;
                  return (
                    <TouchableOpacity
                      key={chit.membership_id}
                      style={[s.chitOption, selected && s.chitOptionSelected]}
                      onPress={() => setSelectedMembershipId(chit.membership_id)}
                    >
                      <View style={[s.radio, selected && s.radioSelected]}>
                        {selected && <View style={s.radioDot} />}
                      </View>
                      <View style={s.chitText}>
                        <Text style={s.chitName}>{chit.chit_group.name}</Text>
                        <Text style={s.chitMeta}>
                          {t('common.monthOf', { current: chit.current_month, total: chit.chit_group.duration_months })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedChit && (
                <>
                  <Text style={s.cardTitle}>{t('foreclosure.eligiblePenalty')}</Text>
                  <Text style={s.cardSub}>
                    {t('foreclosure.completedMonths', { completed: Math.max(0, selectedChit.current_month - 1), total: selectedChit.chit_group.duration_months })}
                  </Text>
                  <View style={s.feeBox}>
                    <Text style={s.feeLabel}>{t('foreclosure.estimatedFee')}</Text>
                    <Text style={s.feeVal}>~{formatPaise(selectedChit.chit_group.value * 0.02)}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Request Form */}
        <View style={s.form}>
          <Text style={s.formLabel}>{t('foreclosure.reason')}</Text>
          <TextInput
            style={s.input}
            placeholder={t('foreclosure.reasonPlaceholder')}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />
          <Text style={s.formHint}>{t('foreclosure.reasonHint')}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, (submitting || loadingChits || !selectedMembershipId) && s.submitBtnDisabled]}
          activeOpacity={0.9}
          onPress={handleSubmit}
          disabled={submitting || loadingChits || !selectedMembershipId}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitTxt}>{t('foreclosure.submitRequest')}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },
  
  scroll: { padding: 20, gap: 24 },
  
  warningBanner: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: '#FECACA' },
  warningIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  warningTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#B91C1C', marginBottom: 4 },
  warningSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#7F1D1D', lineHeight: 20 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle },
  cardLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  cardTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: Colors.primary, marginBottom: 4 },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 20 },
  loader: { paddingVertical: 24 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#B91C1C', lineHeight: 20 },
  chitOptions: { gap: 10, marginBottom: 20 },
  chitOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  chitOptionSelected: { borderColor: Colors.secondary, backgroundColor: '#ECFEFF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioSelected: { borderColor: Colors.secondary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.secondary },
  chitText: { flex: 1 },
  chitName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary },
  chitMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  feeBox: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  feeLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  feeVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#EF4444' },

  form: { gap: 8 },
  formLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary, marginLeft: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, minHeight: 120, fontFamily: 'Inter_400Regular', fontSize: 15, color: Colors.primary, ...Shadows.subtle },
  formHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#94A3B8', marginLeft: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(248,250,252,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)' },
  submitBtn: { backgroundColor: '#EF4444', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { opacity: 0.5 },
  submitTxt: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF', letterSpacing: 1 },
});
