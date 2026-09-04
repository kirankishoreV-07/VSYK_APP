import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AdminGroups() {
  const router = useRouter();
  const [isModalVisible, setModalVisible] = useState(false);

  // Group Form State
  // Group Form State - Basics
  const [groupCode, setGroupCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [agentInCharge, setAgentInCharge] = useState('');
  const [foremanName, setForemanName] = useState('');
  const [description, setDescription] = useState('');

  // Regulatory & Dates
  const [agrNumber, setAgrNumber] = useState('');
  const [agrDate, setAgrDate] = useState('');
  const [psoNumber, setPsoNumber] = useState('');
  const [psoDate, setPsoDate] = useState('');
  const [fdNumber, setFdNumber] = useState('');
  const [fdDate, setFdDate] = useState('');
  const [cdraNumber, setCdraNumber] = useState('');
  const [fdClosingDate, setFdClosingDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bankName, setBankName] = useState('');

  // Financials & Installments
  const [chitAmount, setChitAmount] = useState('');
  const [depositedAmount, setDepositedAmount] = useState('');
  const [installments, setInstallments] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [agentCommission, setAgentCommission] = useState('');
  const [foremanCommission, setForemanCommission] = useState('');

  // Auction & Terms
  const [biddingDate, setBiddingDate] = useState('');
  const [biddingTime, setBiddingTime] = useState('');
  const [capacity, setCapacity] = useState(50);
  const [terms, setTerms] = useState('');

  // Accounting Type
  const [accountingType, setAccountingType] = useState<'accounted' | 'unaccounted'>('accounted');
  const [showAccountingOptions, setShowAccountingOptions] = useState(false);

  // Live Data State
  const [groups, setGroups] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState('');
  const [currentDateValue, setCurrentDateValue] = useState(new Date());
  const [pendingDateValue, setPendingDateValue] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentTimeValue, setCurrentTimeValue] = useState(new Date());
  const [pendingTimeValue, setPendingTimeValue] = useState(new Date());
  const [showFrequencyOptions, setShowFrequencyOptions] = useState(false);

  const frequencyOptions = ['Monthly', 'Weekly'];

  const openPicker = (field: string, currentVal: string) => {
    setCurrentDateField(field);
    const parsed = parsePickerDate(currentVal);
    if (parsed) {
      const nextDate = new Date(parsed);
      setCurrentDateValue(nextDate);
      setPendingDateValue(nextDate);
    } else {
      const nextDate = new Date();
      setCurrentDateValue(nextDate);
      setPendingDateValue(nextDate);
    }
    setShowDatePicker(true);
  };

  const applyDateValue = (selectedDate: Date) => {
    setCurrentDateValue(selectedDate);
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    const formattedFull = `${day}/${month}/${year}`;
    const formattedDayMonth = `${day}/${month}`;

    switch (currentDateField) {
      case 'agrDate': setAgrDate(formattedFull); break;
      case 'psoDate': setPsoDate(formattedFull); break;
      case 'fdDate': setFdDate(formattedFull); break;
      case 'fdClosingDate': setFdClosingDate(formattedFull); break;
      case 'startDate': setStartDate(formattedFull); break;
      case 'endDate': setEndDate(formattedFull); break;
      case 'biddingDate': setBiddingDate(formattedDayMonth); break;
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS === 'android') setShowDatePicker(false);
      return;
    }

    setPendingDateValue(selectedDate);
    if (Platform.OS === 'android') {
      applyDateValue(selectedDate);
      setShowDatePicker(false);
    }
  };

  const openTimePicker = (currentVal: string) => {
    if (currentVal) {
      const now = new Date();
      const parsed = new Date(`${now.toDateString()} ${currentVal}`);
      if (!Number.isNaN(parsed.getTime())) {
        setCurrentTimeValue(parsed);
        setPendingTimeValue(parsed);
      } else {
        const nextTime = new Date();
        setCurrentTimeValue(nextTime);
        setPendingTimeValue(nextTime);
      }
    } else {
      const nextTime = new Date();
      setCurrentTimeValue(nextTime);
      setPendingTimeValue(nextTime);
    }
    setShowTimePicker(true);
  };

  const applyTimeValue = (selectedTime: Date) => {
    setCurrentTimeValue(selectedTime);
    const formatted = selectedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setBiddingTime(formatted);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (!selectedTime) {
      if (Platform.OS === 'android') setShowTimePicker(false);
      return;
    }
    setPendingTimeValue(selectedTime);
    if (Platform.OS === 'android') {
      applyTimeValue(selectedTime);
      setShowTimePicker(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('chit_groups')
        .select('*, chit_members(id, participation_share)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setGroups(data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-groups-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, fetchGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_members' }, fetchGroups)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  };

  const getGroupShares = (group: any) =>
    (group.chit_members || []).reduce(
      (sum: number, m: any) => sum + (Number(m.participation_share) || 1),
      0,
    );

  const { accountedGroups, unaccountedGroups } = useMemo(() => {
    const accounted: any[] = [];
    const unaccounted: any[] = [];
    groups.forEach((group) => {
      if (group.accounting_type === 'unaccounted') unaccounted.push(group);
      else accounted.push(group);
    });
    return { accountedGroups: accounted, unaccountedGroups: unaccounted };
  }, [groups]);

  const renderGroupCard = (group: any, isUnaccounted = false) => {
    const filledShares = getGroupShares(group);
    const groupCapacity = group.capacity || 50;
    const fillPct = Math.min(100, (filledShares / groupCapacity) * 100);

    return (
      <TouchableOpacity
        key={group.id}
        style={[styles.groupCard, isUnaccounted && styles.groupCardUnaccounted]}
        activeOpacity={0.9}
        onPress={() => router.push(`/(admin)/groups/${group.group_code || group.id}`)}
      >
        <View style={styles.cardTop}>
          <View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={[styles.badge, { backgroundColor: group.status === 'active' ? 'rgba(84, 250, 239, 0.3)' : 'rgba(241, 245, 249, 1)' }]}>
                <Text style={[styles.badgeText, { color: group.status === 'active' ? '#00716b' : '#64748B' }]}>{group.status?.toUpperCase() || 'ACTIVE'}</Text>
              </View>
              {isUnaccounted && (
                <View style={[styles.badge, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={[styles.badgeText, { color: '#005E7D' }]}>💵 CASH ONLY</Text>
                </View>
              )}
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.labelSmall}>Group ID</Text>
            <Text style={styles.idText}>#{group.group_code || 'PENDING'}</Text>
          </View>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.valueText}>₹{(Number(group.value) / 100).toLocaleString('en-IN')}</Text>
          <Text style={styles.labelSmall}>Total Value</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.labelSmall}>Enrollment</Text>
            <Text style={styles.labelSmall}>{group.duration_months} Months</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${fillPct}%`,
                  backgroundColor: '#01789E',
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>START DATE</Text>
            <Text style={styles.footerVal}>{group.start_date || 'TBD'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerLabel}>SHARES</Text>
            <Text style={styles.footerVal}>{filledShares} / {groupCapacity}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const parsePickerDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (parts.length === 2) {
      const year = new Date().getFullYear();
      return `${year}-${parts[1]}-${parts[0]}`;
    }
    return null;
  };

  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return null;
  };

  const handleSaveGroup = async () => {
    const normalizedCode = groupCode.trim();
    const normalizedName = groupName.trim();
    const chitValue = Number(chitAmount);
    const installmentCount = Number(installments);
    const monthlyAmount = Number(emiAmount);
    const depositValue = depositedAmount ? Number(depositedAmount) : 0;
    const commissionRate = agentCommission ? Number(agentCommission) : 0;
    const annualInterestRate = interestRate ? Number(interestRate) : 0;

    if (!normalizedCode || !normalizedName || !chitAmount || !installments || !emiAmount) {
      Alert.alert('Validation Error', 'Group Code, Group Name, Chit Value, Number of Months, and Monthly Installment are required.');
      return;
    }
    if (!Number.isFinite(chitValue) || chitValue <= 0) {
      Alert.alert('Validation Error', 'Chit Value must be greater than zero.');
      return;
    }
    if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 120) {
      Alert.alert('Validation Error', 'Number of Months must be a whole number between 1 and 120.');
      return;
    }
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > chitValue) {
      Alert.alert('Validation Error', 'Monthly Installment must be greater than zero and cannot exceed the Chit Value.');
      return;
    }
    if (!Number.isFinite(depositValue) || depositValue < 0 || depositValue > chitValue) {
      Alert.alert('Validation Error', 'Deposited Amount must be between zero and the Chit Value.');
      return;
    }
    if (![commissionRate, annualInterestRate].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      Alert.alert('Validation Error', 'Commission and Interest rates must be between 0 and 100.');
      return;
    }

    // Regulatory validation only for accounted groups
    if (accountingType === 'accounted') {
      if (!agrNumber || agrNumber.length < 3) {
        Alert.alert('Validation Error', 'Please enter a valid Agreement Number');
        return;
      }
      if (!psoNumber || psoNumber.length < 3) {
        Alert.alert('Validation Error', 'Please enter a valid PSO Number');
        return;
      }
      if (!fdNumber || fdNumber.length < 3) {
        Alert.alert('Validation Error', 'Please enter a valid FD Number');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        name: normalizedName,
        value: Math.round(chitValue * 100),
        duration_months: installmentCount,
        monthly_installment: Math.round(monthlyAmount * 100),
        group_code: normalizedCode,
        agent_in_charge: agentInCharge.trim() || null,
        foreman_name: foremanName.trim() || null,
        description: description.trim() || null,
        // Regulatory fields only for accounted groups
        agr_number: accountingType === 'accounted' ? agrNumber : null,
        agr_date: accountingType === 'accounted' ? parseDateStr(agrDate) : null,
        pso_number: accountingType === 'accounted' ? psoNumber : null,
        pso_date: accountingType === 'accounted' ? parseDateStr(psoDate) : null,
        fd_number: accountingType === 'accounted' ? fdNumber : null,
        fd_date: accountingType === 'accounted' ? parseDateStr(fdDate) : null,
        cdra_number: accountingType === 'accounted' ? cdraNumber : null,
        fd_closing_date: accountingType === 'accounted' ? parseDateStr(fdClosingDate) : null,
        start_date: accountingType === 'accounted' ? parseDateStr(startDate) : null,
        end_date: accountingType === 'accounted' ? parseDateStr(endDate) : null,
        bank_name: accountingType === 'accounted' ? bankName.trim() || null : null,
        deposited_amount: Math.round(depositValue * 100),
        interest_rate: annualInterestRate,
        no_of_installments: installmentCount,
        emi_amount: Math.round(monthlyAmount * 100),
        agent_commission_rate: commissionRate,
        foreman_commission_amount: 0,
        frequency,
        bidding_day: biddingDate,
        bidding_time: biddingTime,
        capacity,
        terms_conditions: terms.trim() || null,
        accounting_type: accountingType, // NEW: Add accounting type
        // New groups stay private until every share is enrolled and an admin
        // explicitly activates them from the group detail screen.
        status: 'draft'
      };

      const { error } = await supabase.from('chit_groups').insert([payload]);

      if (error) {
        console.error('Insert Error:', error);
        if (error.code === '23505') {
          Alert.alert('Group Already Exists', 'A chit group with this Group Code already exists.');
        } else {
          Alert.alert('Unable to Create Group', error.message || 'The group could not be saved.');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGroupCode(''); setGroupName(''); setAgentInCharge(''); setForemanName(''); setDescription('');
        setAgrNumber(''); setAgrDate(''); setPsoNumber(''); setPsoDate(''); setFdNumber(''); setFdDate('');
        setCdraNumber(''); setFdClosingDate(''); setStartDate(''); setEndDate(''); setBankName('');
        setChitAmount(''); setDepositedAmount(''); setInstallments(''); setEmiAmount(''); setInterestRate('');
        setAgentCommission(''); setForemanCommission(''); setFrequency('Monthly'); setBiddingDate('');
        setBiddingTime(''); setCapacity(50); setTerms(''); setAccountingType('accounted');

        closeModal(true);
        fetchGroups();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Unable to Create Group', err?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(true);
  };

  const isFormDirty = [
    groupCode, groupName, agentInCharge, description, agrNumber, agrDate, psoNumber, psoDate,
    fdNumber, fdDate, cdraNumber, fdClosingDate, startDate, endDate, bankName, chitAmount,
    depositedAmount, installments, emiAmount, interestRate, agentCommission, biddingDate,
    biddingTime, terms,
  ].some((value) => value.trim().length > 0);

  const closeModal = (discardChanges = false) => {
    if (isFormDirty && !discardChanges) {
      Alert.alert(
        'Discard group details?',
        'You have unsaved changes. Leave this form and discard them?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => closeModal(true) },
        ],
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <AppLogo size={36} />
          <Text style={styles.appBarTitle}>VSYK CHITS</Text>
        </View>
        <View style={styles.iconButton} accessibilityElementsHidden>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="#00789E">
            <Path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </Svg>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005E7D" />}
      >

        <View style={styles.headerArea}>
          <Text style={styles.pageTitle}>Active Chit Groups</Text>
          <Text style={styles.pageSubtitle}>Manage and monitor your ongoing auction cycles.</Text>
        </View>

        <View style={styles.grid}>
          {/* Add New Group Action Card */}
          <TouchableOpacity style={styles.addCard} onPress={openModal} activeOpacity={0.7}>
            <View style={styles.addIconBox}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="#005E7D">
                <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </Svg>
            </View>
            <Text style={styles.addTitle}>Initialize New Group</Text>
            <Text style={styles.addSubtitle}>Configure Duration & Slots</Text>
          </TouchableOpacity>

          {groups.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontFamily: 'Inter_400Regular', color: '#64748B' }}>No active groups initialized yet.</Text>
            </View>
          ) : (
            <>
              {accountedGroups.length > 0 && (
                <View style={styles.listSectionBlock}>
                  <Text style={styles.listSectionTitle}>💳 Accounted Chits</Text>
                  <Text style={styles.listSectionSubtitle}>Digital payments via Razorpay</Text>
                  {accountedGroups.map((group) => renderGroupCard(group, false))}
                </View>
              )}

              {unaccountedGroups.length > 0 && (
                <View style={styles.listSectionBlock}>
                  <Text style={styles.listSectionTitle}>💵 Unaccounted Chits (Cash Only)</Text>
                  <Text style={styles.listSectionSubtitle}>Physical cash collections with denomination tracking</Text>
                  {unaccountedGroups.map((group) => renderGroupCard(group, true))}
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* Full Screen Modal */}
      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => closeModal()}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Initialize New Group</Text>
              <Text style={styles.modalSubtitle}>Configure the parameters for the new chit cycle</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close group form">
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
                <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>

            {/* Section 1: BASICS */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D"><Path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" /></Svg>
                <Text style={styles.sectionTitle}>01. BASICS</Text>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>GROUP CODE</Text>
                  <TextInput style={styles.input} placeholder="Enter unique group code" value={groupCode} onChangeText={setGroupCode} autoCapitalize="characters" />
                </View>
                <View style={[styles.inputGroup, { flex: 2 }]}>
                  <Text style={styles.inputLabel}>GROUP NAME</Text>
                  <TextInput style={styles.input} placeholder="Enter chit group name" value={groupName} onChangeText={setGroupName} />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IN-CHARGE NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter foreman or agent name"
                  value={agentInCharge}
                  onChangeText={(val) => { setAgentInCharge(val); setForemanName(val); }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DESCRIPTION</Text>
                <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Enter group description (optional)" multiline value={description} onChangeText={setDescription} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ACCOUNTING TYPE</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setShowAccountingOptions((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#0F172A' }}>
                      {accountingType === 'accounted' ? '💳 Accounted (Digital Payments)' : '💵 Unaccounted (Cash Only)'}
                    </Text>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="#64748B">
                      <Path d="M7 10l5 5 5-5z" />
                    </Svg>
                  </View>
                </TouchableOpacity>
                {showAccountingOptions && (
                  <View style={styles.dropdownList}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownOption,
                        accountingType === 'accounted' ? styles.dropdownOptionActive : null
                      ]}
                      onPress={() => {
                        setAccountingType('accounted');
                        setShowAccountingOptions(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>💳 Accounted (Digital Payments)</Text>
                      <Text style={styles.dropdownOptionSubtext}>Online payments tracked automatically</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dropdownOption,
                        accountingType === 'unaccounted' ? styles.dropdownOptionActive : null
                      ]}
                      onPress={() => {
                        setAccountingType('unaccounted');
                        setShowAccountingOptions(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>💵 Unaccounted (Cash Only)</Text>
                      <Text style={styles.dropdownOptionSubtext}>Manual cash recording by staff</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.helpText}>
                  {accountingType === 'accounted'
                    ? 'Members pay online via Razorpay. Payments are tracked automatically.'
                    : 'Members pay cash in person. Staff manually records collections with denomination breakdown.'}
                </Text>
              </View>
            </View>

            {/* Section 2: REGULATORY & DATES - Only for Accounted Groups */}
            {accountingType === 'accounted' && (
              <View style={styles.formSection}>
                <View style={styles.sectionHeader}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D"><Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /></Svg>
                  <Text style={styles.sectionTitle}>02. REGULATORY & DATES</Text>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>AGR NUMBER *</Text>
                    <TextInput style={styles.input} placeholder="Enter agreement number" value={agrNumber} onChangeText={setAgrNumber} />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>AGR DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('agrDate', agrDate)}>
                      <Text style={{ color: agrDate ? '#0F172A' : '#94A3B8' }}>{agrDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>PSO NUMBER *</Text>
                    <TextInput style={styles.input} placeholder="Enter PSO number" value={psoNumber} onChangeText={setPsoNumber} />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>PSO DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('psoDate', psoDate)}>
                      <Text style={{ color: psoDate ? '#0F172A' : '#94A3B8' }}>{psoDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>FD NUMBER *</Text>
                    <TextInput style={styles.input} placeholder="Enter fixed-deposit number" value={fdNumber} onChangeText={setFdNumber} />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>FD DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('fdDate', fdDate)}>
                      <Text style={{ color: fdDate ? '#0F172A' : '#94A3B8' }}>{fdDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>CDRA NUMBER</Text>
                    <TextInput style={styles.input} placeholder="Enter CDRA number (optional)" value={cdraNumber} onChangeText={setCdraNumber} />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>FD CLOSING DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('fdClosingDate', fdClosingDate)}>
                      <Text style={{ color: fdClosingDate ? '#0F172A' : '#94A3B8' }}>{fdClosingDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>START DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('startDate', startDate)}>
                      <Text style={{ color: startDate ? '#0F172A' : '#94A3B8' }}>{startDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>END DATE</Text>
                    <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('endDate', endDate)}>
                      <Text style={{ color: endDate ? '#0F172A' : '#94A3B8' }}>{endDate || 'Select Date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

              </View>
            )}

            {/* Section 3: FINANCIALS */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D"><Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" /></Svg>
                <Text style={styles.sectionTitle}>03. FINANCIALS & INSTALLMENTS</Text>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>CHIT VALUE (₹)</Text>
                  <TextInput style={styles.input} placeholder="Enter total chit amount" keyboardType="decimal-pad" value={chitAmount} onChangeText={setChitAmount} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>NO. OF MONTHS</Text>
                  <TextInput style={styles.input} placeholder="Enter number of months" keyboardType="number-pad" value={installments} onChangeText={setInstallments} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>MONTHLY INSTALLMENT (₹)</Text>
                  <TextInput style={styles.input} placeholder="Enter monthly instalment amount" keyboardType="decimal-pad" value={emiAmount} onChangeText={setEmiAmount} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>DEPOSITED AMOUNT (₹)</Text>
                  <TextInput style={styles.input} placeholder="Enter deposited amount (optional)" keyboardType="decimal-pad" value={depositedAmount} onChangeText={setDepositedAmount} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>COMMISSION RATE (%)</Text>
                  <TextInput style={styles.input} placeholder="Enter commission percentage" keyboardType="decimal-pad" value={agentCommission} onChangeText={setAgentCommission} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>INTEREST RATE (%)</Text>
                  <TextInput style={styles.input} placeholder="Enter annual interest percentage" keyboardType="decimal-pad" value={interestRate} onChangeText={setInterestRate} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>FREQUENCY</Text>
                  <TouchableOpacity
                    style={[styles.input, { justifyContent: 'center' }]}
                    onPress={() => setShowFrequencyOptions((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: frequency ? '#0F172A' : '#94A3B8' }}>{frequency || 'Select Frequency'}</Text>
                  </TouchableOpacity>
                  {showFrequencyOptions && (
                    <View style={styles.dropdownList}>
                      {frequencyOptions.map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.dropdownOption,
                            option === frequency ? styles.dropdownOptionActive : null
                          ]}
                          onPress={() => {
                            setFrequency(option);
                            setShowFrequencyOptions(false);
                          }}
                        >
                          <Text style={styles.dropdownOptionText}>{option}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>BANK NAME</Text>
                  <TextInput style={styles.input} placeholder="Enter bank name (optional)" value={bankName} onChangeText={setBankName} />
                </View>
              </View>
            </View>

            {/* Section 4: AUCTION & TERMS */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D"><Path d="M14 11c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-1h11v1zm8.28-4.71l-1.41-1.41L10.34 14l-1.41 1.41 2.83 2.83L13.17 16.83l9.11-9.11z" /></Svg>
                <Text style={styles.sectionTitle}>04. AUCTION & TERMS</Text>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>BIDDING DATE (DAY + MONTH)</Text>
                  <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openPicker('biddingDate', biddingDate)}>
                    <Text style={{ color: biddingDate ? '#0F172A' : '#94A3B8' }}>{biddingDate || 'Select Date'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>BIDDING TIME</Text>
                  <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => openTimePicker(biddingTime)}>
                    <Text style={{ color: biddingTime ? '#0F172A' : '#94A3B8' }}>{biddingTime || 'Select Time'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.slotsBox}>
                <View>
                  <Text style={styles.slotsMain}>Subscriber Slots (Capacity)</Text>
                  <Text style={styles.slotsSub}>Total members in group</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setCapacity(Math.max(5, capacity - 1))}>
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{capacity}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setCapacity(capacity + 1)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TERMS & CONDITIONS</Text>
                <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Enter terms and conditions (optional)" multiline value={terms} onChangeText={setTerms} />
              </View>
            </View>

          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => closeModal()} disabled={isSaving}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGroup} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>INITIALIZE GROUP</Text>
              )}
            </TouchableOpacity>
          </View>

          {showDatePicker && Platform.OS === 'ios' && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerSheet}>
                <View style={{ height: 216, justifyContent: 'center' }}>
                  <DateTimePicker
                    value={pendingDateValue}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    textColor="#0B1C30"
                    themeVariant="light"
                    style={{ height: 216, alignSelf: 'stretch', backgroundColor: '#FFFFFF' }}
                  />
                </View>
                <View style={styles.pickerActions}>
                  <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { flex: 1 }]}
                    onPress={() => {
                      applyDateValue(pendingDateValue);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.saveBtnText}>DONE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {showTimePicker && Platform.OS === 'ios' && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerSheet}>
                <View style={{ height: 216, justifyContent: 'center' }}>
                  <DateTimePicker
                    value={pendingTimeValue}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    textColor="#0B1C30"
                    themeVariant="light"
                    style={{ height: 216, alignSelf: 'stretch', backgroundColor: '#FFFFFF' }}
                  />
                </View>
                <View style={styles.pickerActions}>
                  <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { flex: 1 }]}
                    onPress={() => {
                      applyTimeValue(pendingTimeValue);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={styles.saveBtnText}>DONE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={currentDateValue}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={currentTimeValue}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}

        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  appBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, height: 64, backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', zIndex: 40,
    shadowColor: '#01789E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  appBarTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#155E75', letterSpacing: -0.5 },
  iconButton: { padding: 8, borderRadius: 20 },

  scrollContent: { padding: 20, paddingBottom: 120 },
  headerArea: { marginBottom: 24 },
  pageTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 32, color: '#005E7D', letterSpacing: -0.5 },
  pageSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#64748B', marginTop: 4 },

  grid: { gap: 24 },

  addCard: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0, 94, 125, 0.2)',
    borderRadius: 20, padding: 32,
  },
  addIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0, 94, 125, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  addTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 24, color: '#005E7D' },
  addSubtitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginTop: 4 },

  groupCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#01789E', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.06, shadowRadius: 40, elevation: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, marginBottom: 8 },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  groupName: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 24, color: '#0B1C30' },
  labelSmall: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  idText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#005E7D', marginTop: 2 },

  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  valueText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: '#005E7D' },

  progressSection: { marginBottom: 24 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressBarBg: { width: '100%', height: 8, backgroundColor: '#E5EEFF', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  footerLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#94A3B8', letterSpacing: 0.5 },
  footerVal: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0B1C30', marginTop: 4 },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 24, color: '#0B1C30' },
  modalSubtitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginTop: 4 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },

  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 24, gap: 32 },

  formSection: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#005E7D', letterSpacing: 1 },

  inputGroup: { gap: 8 },
  rowInputs: { flexDirection: 'row', gap: 16 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B' },
  helpText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 4,
  },
  dropdownOptionSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30',
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownOptionActive: {
    backgroundColor: '#F1F5F9',
  },
  dropdownOptionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#0B1C30',
  },

  infoBox: { flexDirection: 'row', backgroundColor: '#EFF4FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#D3E4FE' },
  infoCol: { flex: 1, alignItems: 'center' },
  infoDivider: { width: 1, backgroundColor: '#D3E4FE', marginHorizontal: 16 },
  infoLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', marginBottom: 4 },
  infoVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#005E7D' },

  slotsBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16 },
  slotsMain: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0B1C30' },
  slotsSub: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 18, color: '#0B1C30' },
  stepVal: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: '#0B1C30' },

  modalFooter: { flexDirection: 'row', padding: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 16, backgroundColor: '#FFFFFF' },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#64748B', letterSpacing: 1 },
  saveBtn: { flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: '#005E7D', alignItems: 'center', justifyContent: 'center', shadowColor: '#005E7D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 8 },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF', letterSpacing: 1 },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerActions: { flexDirection: 'row', gap: 12, marginTop: 12 },

  listSectionBlock: { width: '100%', marginBottom: 8 },
  listSectionTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#0B1C30', marginBottom: 4 },
  listSectionSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#64748B', marginBottom: 16 },
  groupCardUnaccounted: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
});
