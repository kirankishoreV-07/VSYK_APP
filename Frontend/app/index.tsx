import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Colors, Shadows } from '../lib/constants';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';

export default function SplashScreen() {
  const router = useRouter();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Spinner animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Fade in + scale up the logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Restore authenticated users to the correct role-specific home instead
    // of sending every cold start back through onboarding.
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace('/(auth)/onboarding');
        return;
      }

      const customerId = (session.user.user_metadata as any)?.customer_id;
      if (customerId) {
        router.replace('/(tabs)');
        return;
      }

      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      router.replace(admin ? '/(admin)/dashboard' : '/(auth)/login');
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#008B9C', '#00D1C1']} // Brighter teal contrast matching screenshot
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={styles.container}
    >
      {/* Abstract light beams to match the screenshot background */}
      <View style={[styles.beam, { top: '-10%', left: '-20%', transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.beam, { bottom: '-20%', right: '-10%', transform: [{ rotate: '45deg' }], width: 300 }]} />
      <View style={[styles.beam, { top: '30%', right: '-30%', transform: [{ rotate: '-45deg' }], width: 400 }]} />

      {/* Logo + Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Render the user's provided logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            contentFit="contain"
            contentPosition="center"
            transition={500}
          />
        </View>

        {/* Brand Text */}
        <Text style={styles.headline}>VSYK CHITS</Text>
        <Text style={styles.subheadline}>Your Trusted Financial Partner</Text>
      </Animated.View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Spinner matching screenshot's simple ring */}
        <Animated.View
          style={[
            styles.spinner,
            { transform: [{ rotate: spinInterpolation }] },
          ]}
        />

        {/* Secure Banking Grade */}
        <View style={styles.secureRow}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="#FFFFFF">
            <Path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </Svg>
          <Text style={styles.secureText}>SECURE BANKING GRADE</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  beam: {
    position: 'absolute',
    width: 200,
    height: '150%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  contentContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginTop: -40,
  },
  logoContainer: {
    width: 180,
    height: 180,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subheadline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 24,
  },
  spinner: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: 14,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.8,
  },
  secureText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
});
