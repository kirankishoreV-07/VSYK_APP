import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Colors, Shadows, Spacing, Radii } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';
import { useMemberSession } from '../../lib/MemberSessionContext';

interface OtpVerifyResponse {
  ok: boolean;
  customerId: string;
  session: { access_token: string; refresh_token: string };
}

interface AdminLoginResponse {
  ok: boolean;
  session: { access_token: string; refresh_token: string };
}

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithSession } = useMemberSession();
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Member OTP flow
  const [memberStep, setMemberStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const adminEmailRef = useRef<TextInput>(null);
  const adminPasswordRef = useRef<TextInput>(null);

  // Countdown for the OTP resend cooldown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const cleanMemberPhone = () => phone.trim().replace(/\D/g, '').replace(/^91/, '').slice(-10);

  // Step 1 — request an OTP delivered over WhatsApp. The backend is the sole
  // authority on eligibility; we intentionally show a generic message so the
  // screen never reveals whether a number is registered.
  const handleRequestOtp = async () => {
    const cleanPhone = cleanMemberPhone();
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await apiPost('/api/auth/otp/request', { phone: cleanPhone });
      setOtp('');
      setMemberStep('otp');
      setResendIn(60);
    } catch (err: any) {
      Alert.alert('Could not send OTP', err?.message || 'Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify the OTP and install the real authenticated session.
  const handleVerifyOtp = async () => {
    const cleanPhone = cleanMemberPhone();
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit code sent to your WhatsApp.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await apiPost<OtpVerifyResponse>('/api/auth/otp/verify', {
        phone: cleanPhone,
        otp,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loginWithSession(res.session, res.customerId);
      router.replace('/(tabs)');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Verification Failed', err?.message || 'Invalid or expired OTP.');
      setLoading(false);
    }
  };

  const resetMemberFlow = () => {
    setMemberStep('phone');
    setOtp('');
    setResendIn(0);
  };

  // Real Supabase Auth sign-in, then confirm the resulting session actually
  // belongs to an admin (row in admin_users, checked via RLS: a non-admin
  // authenticated user simply gets zero rows back, never an error) before
  // allowing entry to the admin app. Signing in without this check would let
  // any valid Supabase Auth user (e.g. a member account) into /(admin)/* —
  // the route guard in the admin layout re-checks this on every load too.
  const handleAdminLogin = async () => {
    const identifier = username.normalize('NFKC').replace(/\s+/g, '');
    if (!identifier || !password) {
      Alert.alert('Error', 'Please enter both username/email and password.');
      return;
    }
    setUsername(identifier);

    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const authData = await apiPost<AdminLoginResponse>('/api/auth/admin/login', {
        identifier,
        password,
      });
      const { error: sessionError } = await supabase.auth.setSession(authData.session);
      if (sessionError) throw sessionError;

      const { data: adminRow, error: adminError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (adminError || !adminRow) {
        await supabase.auth.signOut({ scope: 'local' });
        Alert.alert('Not an Admin Account', 'This account does not have admin access.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(admin)/dashboard');
    } catch (err: any) {
      Alert.alert('Login Failed', err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M4 10h16v2H4v-2Zm0-4h16v2H4V6Zm0 8h16v2H4v-2Z" />
          </Svg>
          <Text style={styles.appBarTitle}>VSYK CHITS</Text>
        </View>
        <TouchableOpacity style={styles.translateBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#94a3b8">
            <Path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z" />
          </Svg>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {/* Hero Branding */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
                contentPosition="center"
                transition={200}
              />
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Access your chit funds and savings auctions securely.
            </Text>
          </View>

          {/* Role Selector */}
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                role === 'member' && styles.roleBtnActive,
              ]}
              onPress={() => {
                setRole('member');
                Haptics.selectionAsync();
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.roleBtnText,
                  role === 'member' && styles.roleBtnTextActive,
                ]}
              >
                Member
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                role === 'admin' && styles.roleBtnActive,
              ]}
              onPress={() => {
                setRole('admin');
                Haptics.selectionAsync();
                requestAnimationFrame(() => adminEmailRef.current?.focus());
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.roleBtnText,
                  role === 'admin' && styles.roleBtnTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Form Card */}
          <View style={styles.formCard}>
            {role === 'member' ? (
              memberStep === 'phone' ? (
                <>
                  {/* Phone Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>REGISTERED PHONE NUMBER</Text>
                    <View style={styles.phoneInputRow}>
                      <Text style={styles.phonePrefix}>+91</Text>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="98765 43210"
                        placeholderTextColor="#CBD5E1"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={phone}
                        onChangeText={setPhone}
                        editable={!loading}
                      />
                    </View>
                  </View>

                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', marginBottom: 8, textAlign: 'center' }}>
                    We'll send a one-time code to your WhatsApp number registered with VSYK Chits.
                  </Text>

                  {/* Send OTP Button */}
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleRequestOtp}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    <Text style={styles.submitBtnText}>
                      {loading ? 'Sending...' : 'Send OTP on WhatsApp'}
                    </Text>
                    {!loading && (
                      <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.onBackground}>
                        <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                      </Svg>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* OTP Input */}
                  <View style={styles.inputGroup}>
                    <View style={styles.otpHeaderRow}>
                      <Text style={styles.inputLabel}>ENTER 6-DIGIT OTP</Text>
                      <TouchableOpacity onPress={resetMemberFlow} disabled={loading}>
                        <Text style={styles.resendOtp}>CHANGE NUMBER</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.textInput, { textAlign: 'center', letterSpacing: 8, fontSize: 22 }]}
                      placeholder="______"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
                      editable={!loading}
                      autoFocus
                    />
                  </View>

                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#94A3B8', marginBottom: 8, textAlign: 'center' }}>
                    Sent to WhatsApp +91 {phone.slice(-10)}. Code expires in 10 minutes.
                  </Text>

                  {/* Verify Button */}
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleVerifyOtp}
                    activeOpacity={0.9}
                    disabled={loading}
                  >
                    <Text style={styles.submitBtnText}>
                      {loading ? 'Verifying...' : 'Verify & Login'}
                    </Text>
                    {!loading && (
                      <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.onBackground}>
                        <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                      </Svg>
                    )}
                  </TouchableOpacity>

                  {/* Resend */}
                  <TouchableOpacity
                    onPress={handleRequestOtp}
                    disabled={loading || resendIn > 0}
                    style={{ alignItems: 'center', paddingVertical: 8 }}
                  >
                    <Text style={[styles.resendOtp, (loading || resendIn > 0) && { color: '#CBD5E1' }]}>
                      {resendIn > 0 ? `RESEND OTP IN ${resendIn}s` : 'RESEND OTP'}
                    </Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              <>
                {/* Admin Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>USERNAME OR EMAIL</Text>
                  <TextInput
                    ref={adminEmailRef}
                    style={styles.textInput}
                    placeholder="Enter admin username or email"
                    placeholderTextColor="#CBD5E1"
                    value={username}
                    onChangeText={(value) => setUsername(value.replace(/\s/g, ''))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    keyboardType="default"
                    returnKeyType="next"
                    editable={!loading}
                    onSubmitEditing={() => adminPasswordRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  <Text style={styles.inputHint}>
                    Use your registered admin username or Supabase email.
                  </Text>
                </View>

                {/* Admin Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <TextInput
                    ref={adminPasswordRef}
                    style={styles.textInput}
                    placeholder="Enter admin password"
                    placeholderTextColor="#CBD5E1"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="done"
                    editable={!loading}
                    onSubmitEditing={handleAdminLogin}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleAdminLogin}
                  activeOpacity={0.9}
                  disabled={loading}
                >
                  <Text style={styles.submitBtnText}>
                    {loading ? 'Authenticating...' : 'Login to Admin Portal'}
                  </Text>
                  {!loading && (
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.onBackground}>
                      <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                    </Svg>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Biometric Toggle */}
          <View style={styles.biometricCard}>
            <View style={styles.biometricLeft}>
              <View style={styles.biometricIcon}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.secondary}>
                  <Path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.51 3.75-3.3C8.36 4.83 10.14 4.42 12 4.42c1.87 0 3.65.41 5.16 1.21 1.5.79 2.76 1.9 3.75 3.3.16.22.1.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.27-3.39-2.98-1.37-.72-2.97-1.1-4.7-1.1s-3.33.39-4.7 1.1c-1.35.71-2.49 1.72-3.39 2.98-.09.14-.25.21-.41.21zM9.75 21.79c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zM16.92 19.94c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94s3.08 1.32 3.08 2.94c0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.48.38z" />
                </Svg>
              </View>
              <View>
                <Text style={styles.biometricTitle}>Enable Biometric Login</Text>
                <Text style={styles.biometricSub}>FaceID or Fingerprint</Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(val) => {
                setBiometricEnabled(val);
                Haptics.selectionAsync();
              }}
              trackColor={{ false: '#E2E8F0', true: Colors.secondary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Support Link */}
          <View style={styles.supportRow}>
            <Text style={styles.supportText}>
              Need help logging in?{' '}
              <Text style={styles.supportLink}>Contact Support</Text>
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>Secured by VSYK Quantum Vault</Text>
            <Text style={styles.footerVersion}>v2.4.0 • Enterprise Grade Encryption</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  appBar: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241,245,249,0.5)',
    ...Shadows.premium,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBarTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: Colors.primary,
    letterSpacing: -1,
  },
  translateBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerPadding,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  logoContainer: {
    width: 148,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    padding: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  welcomeTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 32,
    lineHeight: 40,
    color: Colors.primary,
    letterSpacing: -0.32,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
  roleSelector: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: Radii.xl,
    marginBottom: Spacing.xl,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.subtle,
  },
  roleBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  roleBtnTextActive: {
    color: Colors.primary,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderRadius: Radii['2xl'],
    borderWidth: 1,
    borderColor: '#F8FAFC',
    marginBottom: Spacing.lg,
    ...Shadows.blueTint,
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  inputHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    marginHorizontal: 4,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    backgroundColor: '#FFFFFF',
  },
  phonePrefix: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#94A3B8',
    paddingLeft: 16,
    paddingRight: 4,
  },
  phoneInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.onSurface,
    paddingVertical: 16,
    paddingRight: 16,
  },
  textInput: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.onSurface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.xl,
    backgroundColor: '#FFFFFF',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginLeft: 4,
  },
  resendOtp: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.secondary,
    letterSpacing: 0.6,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
    color: Colors.onSurface,
  },
  otpBoxFilled: {
    borderColor: Colors.secondary,
    borderWidth: 2,
  },
  submitBtn: {
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.md,
    borderRadius: Radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    ...Shadows.premium,
  },
  submitBtnText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: Colors.onBackground,
  },
  biometricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: Spacing.md,
    ...Shadows.blueTint,
  },
  biometricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  biometricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16,215,205,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.onSurface,
  },
  biometricSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.onSurfaceVariant,
  },
  supportRow: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  supportText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  supportLink: {
    color: Colors.secondary,
    fontFamily: 'Inter_700Bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 4,
  },
  footerTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footerVersion: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#CBD5E1',
  },
});
