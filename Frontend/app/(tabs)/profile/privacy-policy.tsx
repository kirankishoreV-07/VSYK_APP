import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../lib/constants';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.appBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>Privacy Policy</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.updated}>Last updated: August 2026</Text>

        <Section title="What we collect">
          To operate your chit fund membership, VSYK Chits collects your full name, phone number,
          email, postal address, KYC identity documents (Aadhaar and PAN numbers), and payment
          records related to your chit group memberships, auctions, bids, and installments.
        </Section>

        <Section title="WhatsApp messaging">
          We use WhatsApp (via Gupshup) to deliver OTP login codes and account notifications:
          installment due reminders, payment overdue reminders, partial payment confirmations, and
          auction scheduling notices. We never send marketing messages over WhatsApp, and you can
          opt out of notifications at any time by replying STOP.
        </Section>

        <Section title="How we use your data">
          Your data is used solely to operate your chit fund account: verifying your identity,
          recording auction bids and results, tracking installment payments, processing Razorpay
          payments, and sending you account-related notifications. We do not sell your data or
          share it with third parties for marketing purposes.
        </Section>

        <Section title="Payment processing">
          Payments are processed by Razorpay. We do not store your card, UPI, or bank credentials —
          Razorpay handles payment collection directly and we only record the resulting transaction
          confirmation.
        </Section>

        <Section title="Data retention">
          Financial and transaction records (payment schedules, transaction history, auction
          results) are retained as required for regulatory and audit purposes, even after an
          account deletion request is processed — only your personally identifying information
          (name, phone, KYC documents) is removed at that point.
        </Section>

        <Section title="Your rights">
          You may request deletion of your personal information at any time from Profile →
          Delete My Account. Because chit fund memberships involve ongoing financial obligations,
          deletion requests are reviewed before processing; your financial and audit records are
          preserved as required by law even after your personal details are removed.
        </Section>

        <Section title="Contact">
          For any privacy questions or to exercise your data rights, contact VSYK Chits support
          through the in-app Contact Support option.
        </Section>
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
