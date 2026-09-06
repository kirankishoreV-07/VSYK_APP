import { ScrollView, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '../../../components/LocalizedText';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../lib/constants';
import { useParentBack } from '../../../lib/hooks/useParentBack';
import { useTranslation } from 'react-i18next';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = useParentBack('/(tabs)/profile');

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.appBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Haptics.selectionAsync(); handleBack(); }}
          accessibilityRole="button"
          accessibilityLabel={t('common.backToProfile')}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{t('privacy.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>{t('privacy.updated')}</Text>

        <Section title={t('privacy.collectTitle')}>{t('privacy.collectBody')}</Section>

        <Section title={t('privacy.whatsappTitle')}>{t('privacy.whatsappBody')}</Section>

        <Section title={t('privacy.useTitle')}>{t('privacy.useBody')}</Section>

        <Section title={t('privacy.paymentTitle')}>{t('privacy.paymentBody')}</Section>

        <Section title={t('privacy.retentionTitle')}>{t('privacy.retentionBody')}</Section>

        <Section title={t('privacy.rightsTitle')}>{t('privacy.rightsBody')}</Section>

        <Section title={t('privacy.contactTitle')}>{t('privacy.contactBody')}</Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  backBtn: { padding: 4 },
  appBarTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0F172A' },
  content: { padding: 20, paddingBottom: 60 },
  updated: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#0F172A', marginBottom: 6 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#475569' },
});
