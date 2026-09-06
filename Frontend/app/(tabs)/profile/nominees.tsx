import { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocalizedText as Text } from '../../../components/LocalizedText';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Shadows } from '../../../lib/constants';

const { width } = Dimensions.get('window');

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useParentBack } from '../../../lib/hooks/useParentBack';
import { useTranslation } from 'react-i18next';

type NomineeRow = {
  id: string;
  nominee_name: string;
  relationship: string;
  phone_number: string;
  allocation_percentage: number;
};

function useNominees() {
  return useQuery<NomineeRow[]>({
    queryKey: ['nominees'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return [];

      const { data, error } = await supabase
        .from('nominees')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as NomineeRow[];
    },
  });
}

export default function NomineesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const handleBack = useParentBack('/(tabs)/profile');
  const { data: nominees, isLoading, isRefetching, refetch } = useNominees();
  const queryClient = useQueryClient();

  const totalAllocation = nominees?.reduce((acc, curr) => acc + curr.allocation_percentage, 0) || 0;

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['nominees'] });
    };

    const channel = supabase
      .channel('member-nominees-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nominees' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* App Bar */}
      <View style={s.appBar}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} accessibilityRole="button" accessibilityLabel={t('common.backToProfile')}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={Colors.primary}>
            <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.appBarTitle}>{t('nominees.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
      >
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('nominees.header')}</Text>
          <Text style={s.headerSub}>{t('nominees.headerHelp')}</Text>
        </View>

        {/* Allocation Progress */}
        <View style={s.allocationCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={s.allocTitle}>{t('nominees.totalAllocation')}</Text>
            <Text style={s.allocVal}>{totalAllocation}%</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${totalAllocation}%` as any }]} />
          </View>
          <Text style={s.allocSub}>
            {totalAllocation === 100 ? t('nominees.fullyAllocated') : t('nominees.needsAllocation', { percent: 100 - totalAllocation })}
          </Text>
        </View>

        {/* Nominees List */}
        <View style={s.list}>
          {isLoading ? (
            <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 20 }}>{t('nominees.loading')}</Text>
          ) : nominees?.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 20 }}>{t('nominees.empty')}</Text>
          ) : (
            nominees?.map((nominee) => (
              <View key={nominee.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={s.avatar}>
                      <Text style={s.avatarTxt}>{nominee.nominee_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={s.name}>{nominee.nominee_name}</Text>
                      <Text style={s.relation}>{nominee.relationship}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => Haptics.selectionAsync()}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#94A3B8">
                      <Path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </Svg>
                  </TouchableOpacity>
                </View>

                <View style={s.cardBottom}>
                  <View style={s.detailItem}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="#64748B">
                      <Path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </Svg>
                    <Text style={s.detailTxt}>{nominee.phone_number}</Text>
                  </View>
                  <View style={s.allocBadge}>
                    <Text style={s.allocBadgeTxt}>{t('nominees.share', { percent: nominee.allocation_percentage })}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} activeOpacity={0.9} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}>
        <Text style={s.fabTxt}>{t('nominees.add')}</Text>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
          <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </Svg>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  appBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },

  scroll: { padding: 20, gap: 24 },

  header: { gap: 8 },
  headerTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: Colors.primary },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#64748B', lineHeight: 22 },

  allocationCard: { backgroundColor: Colors.primary, borderRadius: 20, padding: 24, ...Shadows.subtle },
  allocTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  allocVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: Colors.secondary },
  allocSub: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.secondary },

  list: { gap: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', ...Shadows.subtle },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${Colors.secondary}15`, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: Colors.primary },
  name: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.primary },
  relation: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B', marginTop: 2 },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#64748B' },
  allocBadge: { backgroundColor: `${Colors.primary}10`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  allocBadgeTxt: { fontFamily: 'Inter_700Bold', fontSize: 12, color: Colors.primary },

  fab: { position: 'absolute', bottom: 32, left: 24, right: 24, height: 56, backgroundColor: Colors.secondary, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  fabTxt: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#0B1C30' },
});
