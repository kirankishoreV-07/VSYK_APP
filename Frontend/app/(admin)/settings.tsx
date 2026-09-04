import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppLogo } from '../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { Colors, Shadows } from '../../lib/constants';

export default function AdminSettings() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('Administrator');

  useEffect(() => {
    let active = true;
    const loadAdminIdentity = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (active && data?.full_name) setAdminName(data.full_name);
    };
    loadAdminIdentity();
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Logout",
      "Are you sure you want to log out of the Admin portal?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <AppLogo size={36} />
          <Text style={styles.appBarTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile / Admin Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{adminName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.adminName}>{adminName}</Text>
            <Text style={styles.adminRole}>Administrator</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Management</Text>

        <TouchableOpacity 
          style={styles.menuItem} 
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/(admin)/reports');
          }}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#01789E">
                <Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
              </Svg>
            </View>
            <Text style={styles.menuText}>Reports & Analytics</Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
            <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/(admin)/collections/followups');
          }}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#16A34A">
                <Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zM6 10h8v2H6zm0 4h5v2H6z" />
              </Svg>
            </View>
            <Text style={styles.menuText}>Collections Follow-ups</Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8">
            <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>System</Text>

        <TouchableOpacity 
          style={styles.menuItem} 
          activeOpacity={0.7}
          onPress={handleLogout}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#DC2626">
                <Path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </Svg>
            </View>
            <Text style={[styles.menuText, { color: '#DC2626' }]}>Logout</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  appBar: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarContainerHeader: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHeader: { width: '100%', height: '100%' },
  appBarTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: '#0B1C30',
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.subtle,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#01789E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
  },
  adminName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#0B1C30',
  },
  adminRole: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#0B1C30',
  },
});
