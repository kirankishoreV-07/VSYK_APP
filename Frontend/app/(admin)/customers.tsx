import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Animated, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../../components/AppLogo';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

type CustomerType = 'Individual' | 'Company';

let persistedCustomerSearch = '';
let persistedCustomerScrollY = 0;

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Puducherry"
];

const TOP_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune",
  "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad",
  "Patna", "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot",
  "Kalyan-Dombivli", "Vasai-Virar", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar",
  "Navi Mumbai", "Allahabad", "Ranchi", "Howrah", "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada",
  "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati", "Chandigarh", "Solapur", "Hubballi-Dharwad"
];

export default function AdminCustomers() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(persistedCustomerSearch);
  const [activeFilter, setActiveFilter] = useState('All Customers');
  const [isModalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const listRef = React.useRef<ScrollView>(null);

  // New Customer Form State
  const [customerType, setCustomerType] = useState<CustomerType>('Individual');
  const [fullName, setFullName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [gstin, setGstin] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [stateForm, setStateForm] = useState('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const isFormDirty = [
    fullName, panNumber, aadhaar, mobile, email, age, gstin,
    addressLine1, addressLine2, city, stateForm, postalCode, notes,
  ].some((value) => value.trim().length > 0);

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const closeModal = (discardChanges = false) => {
    if (isFormDirty && !discardChanges) {
      Alert.alert(
        'Discard customer details?',
        'You have unsaved changes. Leave this form and discard them?',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => closeModal(true) },
        ],
      );
      return;
    }
    Animated.timing(slideAnim, {
      toValue: 800,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: persistedCustomerScrollY, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-customers-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateCustomer = async () => {
    const normalizedName = fullName.trim();
    const normalizedMobile = mobile.replace(/\D/g, '');
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAge = age.trim() ? Number(age) : null;

    if (!normalizedName || !normalizedMobile) {
      Alert.alert('Validation Error', 'Full Name and Mobile Number are required.');
      return;
    }
    if (!/^\d{10}$/.test(normalizedMobile)) {
      Alert.alert('Validation Error', 'Mobile Number must contain exactly 10 digits.');
      return;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (normalizedAge !== null && (!Number.isInteger(normalizedAge) || normalizedAge < 18 || normalizedAge > 120)) {
      Alert.alert('Validation Error', 'Age must be a whole number between 18 and 120.');
      return;
    }

    // Strict KYC Validations
    if (customerType === 'Individual' && aadhaar) {
      if (!/^\d{12}$/.test(aadhaar)) {
        Alert.alert('Validation Error', 'Aadhaar must be exactly 12 digits.');
        return;
      }
    }
    if (panNumber) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNumber)) {
        Alert.alert('Validation Error', 'Invalid PAN format. Must be like ABCDE1234F.');
        return;
      }
    }
    if (customerType === 'Company' && gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(gstin.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 15-character GSTIN.');
      return;
    }
    if (postalCode && !/^\d{6}$/.test(postalCode)) {
      Alert.alert('Validation Error', 'Postal Code must be exactly 6 digits.');
      return;
    }
    if (!city || !stateForm) {
      Alert.alert('Validation Error', 'City and State are required.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('customers').insert([{
        customer_type: customerType,
        full_name: normalizedName,
        phone: normalizedMobile,
        email: normalizedEmail || null,
        age: normalizedAge,
        gender: customerType === 'Individual' ? gender : null,
        gstin_number: customerType === 'Company' ? gstin.trim().toUpperCase() || null : null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: stateForm.trim() || null,
        postal_code: postalCode.trim() || null,
        aadhar_number: aadhaar.trim() || null,
        pan_number: panNumber.trim().toUpperCase() || null,
        notes: notes.trim() || null,
        kyc_status: 'pending',
      }]);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Customer created successfully.');

      // Reset form
      setFullName(''); setMobile(''); setEmail(''); setAge(''); setGstin('');
      setAddressLine1(''); setAddressLine2(''); setCity(''); setStateForm('');
      setPostalCode(''); setAadhaar(''); setPanNumber(''); setNotes('');

      fetchCustomers();
      closeModal(true);
    } catch (err: any) {
      if (err?.code === '23505') {
        Alert.alert('Customer Already Exists', 'A customer with this mobile number already exists.');
      } else {
        Alert.alert('Error', err.message || 'Failed to create customer');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.trim().toLowerCase();
    return c.full_name?.toLowerCase().includes(query) ||
      c.customer_id?.toLowerCase().includes(query) ||
      c.phone?.replace(/\D/g, '').includes(query.replace(/\D/g, ''));
  });

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
        ref={listRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => { persistedCustomerScrollY = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
      >

        {/* Search & Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#94A3B8" style={styles.searchIcon}>
              <Path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, customer ID, or mobile number"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={(value) => { persistedCustomerSearch = value; setSearchQuery(value); }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
            {['All Customers'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]}
                onPress={() => {
                  setActiveFilter(filter);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.filterBtnText, activeFilter === filter && styles.filterBtnTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bento Grid - Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL CUSTOMERS</Text>
            <Text style={styles.statHeadline}>{customers.length}</Text>
            <View style={styles.statTrendRow}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="#22C55E">
                <Path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
              </Svg>
              <Text style={styles.statTrendText}>Live DB Count</Text>
            </View>
          </View>
        </View>

        {/* Customer List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Customers</Text>

          {filteredCustomers.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_500Medium', color: '#64748B', textAlign: 'center', marginTop: 20 }}>No customers found matching your criteria.</Text>
          ) : (
            filteredCustomers.map((c, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.customerCard} 
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.history.pushState(window.history.state, '', window.location.href);
                  }
                  router.push(`/(admin)/customers/${c.id}`);
                }}
              >
                <View style={styles.customerInfo}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.customerInitials}>{c.full_name?.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.customerName}>{c.full_name}</Text>
                    <Text style={styles.customerDetails}>ID: {c.customer_id} • {c.customer_type}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* FAB to open Add Customer */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openModal}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Add new customer"
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="#FFFFFF">
          <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </Svg>
      </TouchableOpacity>

      {/* Add New Customer Modal */}
      <Modal transparent visible={isModalVisible} animationType="fade" onRequestClose={() => closeModal()}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => closeModal()} activeOpacity={1} accessibilityLabel="Close customer form" />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContentWrapper}>
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Customer</Text>
                <TouchableOpacity onPress={() => closeModal()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close customer form">
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="#64748B">
                    <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </Svg>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 24 }} showsVerticalScrollIndicator={false}>
                {/* Type Selector */}
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeBtn, customerType === 'Individual' && styles.typeBtnActive]}
                    onPress={() => setCustomerType('Individual')}
                  >
                    <Text style={[styles.typeBtnText, customerType === 'Individual' && styles.typeBtnTextActive]}>Individual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, customerType === 'Company' && styles.typeBtnActive]}
                    onPress={() => setCustomerType('Company')}
                  >
                    <Text style={[styles.typeBtnText, customerType === 'Company' && styles.typeBtnTextActive]}>Company</Text>
                  </TouchableOpacity>
                </View>

                {/* Primary Info */}
                <Text style={styles.formSectionTitle}>Primary Information</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{customerType === 'Company' ? 'COMPANY NAME *' : 'FULL NAME (AS PER PAN) *'}</Text>
                  <TextInput style={styles.input} placeholder="Enter customer name" value={fullName} onChangeText={setFullName} />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                    <View style={styles.phoneInputRow}>
                      <Text style={styles.phonePrefix}>+91</Text>
                      <TextInput style={styles.phoneInput} placeholder="Enter 10-digit mobile number" keyboardType="phone-pad" maxLength={10} value={mobile} onChangeText={(value) => setMobile(value.replace(/\D/g, ''))} />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput style={styles.input} placeholder="Enter email address (optional)" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
                </View>

                {customerType === 'Individual' ? (
                  <View style={styles.rowInputs}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>AGE</Text>
                      <TextInput style={styles.input} placeholder="Enter age in years" keyboardType="number-pad" maxLength={3} value={age} onChangeText={(value) => setAge(value.replace(/\D/g, ''))} />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>GENDER</Text>
                      <TextInput style={styles.input} placeholder="Enter gender" value={gender} onChangeText={setGender} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>GSTIN NUMBER</Text>
                    <TextInput style={[styles.input, { textTransform: 'uppercase' }]} placeholder="Enter 15-character GSTIN" maxLength={15} value={gstin} onChangeText={(value) => setGstin(value.toUpperCase())} autoCapitalize="characters" />
                  </View>
                )}

                {/* Documents */}
                <Text style={styles.formSectionTitle}>KYC Documents</Text>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>PAN NUMBER</Text>
                    <TextInput style={[styles.input, { textTransform: 'uppercase' }]} placeholder="Enter 10-character PAN" maxLength={10} value={panNumber} onChangeText={(value) => setPanNumber(value.toUpperCase())} autoCapitalize="characters" />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>AADHAAR</Text>
                    <TextInput style={styles.input} placeholder="Enter 12-digit Aadhaar number" keyboardType="number-pad" maxLength={12} value={aadhaar} onChangeText={(value) => setAadhaar(value.replace(/\D/g, ''))} />
                  </View>
                </View>

                {/* Address */}
                <Text style={styles.formSectionTitle}>Address Details</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ADDRESS LINE 1</Text>
                  <TextInput style={styles.input} placeholder="Enter house number and building" value={addressLine1} onChangeText={setAddressLine1} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ADDRESS LINE 2</Text>
                  <TextInput style={styles.input} placeholder="Enter street and area (optional)" value={addressLine2} onChangeText={setAddressLine2} />
                </View>

                <View style={[styles.rowInputs, { zIndex: 100 }]}>
                  <View style={[styles.inputGroup, { flex: 1, zIndex: 100 }]}>
                    <Text style={styles.inputLabel}>CITY *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter city"
                      value={city}
                      onChangeText={(t) => { setCity(t); setShowCityDropdown(true); }}
                      onFocus={() => { setShowCityDropdown(true); setShowStateDropdown(false); }}
                    />
                    {showCityDropdown && city.length > 0 && (
                      <View style={styles.autocompleteDropdown}>
                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                          {TOP_CITIES.filter(c => c.toLowerCase().includes(city.toLowerCase())).slice(0, 5).map(c => (
                            <TouchableOpacity key={c} style={styles.autocompleteItem} onPress={() => { setCity(c); setShowCityDropdown(false); }}>
                              <Text style={styles.autocompleteText}>{c}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={[styles.inputGroup, { flex: 1, zIndex: 90 }]}>
                    <Text style={styles.inputLabel}>STATE *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter state"
                      value={stateForm}
                      onChangeText={(t) => { setStateForm(t); setShowStateDropdown(true); }}
                      onFocus={() => { setShowStateDropdown(true); setShowCityDropdown(false); }}
                    />
                    {showStateDropdown && stateForm.length > 0 && (
                      <View style={styles.autocompleteDropdown}>
                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                          {INDIAN_STATES.filter(s => s.toLowerCase().includes(stateForm.toLowerCase())).slice(0, 5).map(s => (
                            <TouchableOpacity key={s} style={styles.autocompleteItem} onPress={() => { setStateForm(s); setShowStateDropdown(false); }}>
                              <Text style={styles.autocompleteText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>POSTAL CODE</Text>
                  <TextInput style={styles.input} placeholder="Enter 6-digit postal code" keyboardType="number-pad" maxLength={6} value={postalCode} onChangeText={(value) => setPostalCode(value.replace(/\D/g, ''))} />
                </View>

                {/* Additional */}
                <Text style={styles.formSectionTitle}>Additional</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOTES</Text>
                  <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Enter additional notes (optional)" multiline value={notes} onChangeText={setNotes} />
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateCustomer} disabled={loading}>
                  <Text style={styles.submitBtnText}>{loading ? 'Creating...' : 'Create Customer Profile'}</Text>
                  {!loading && (
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
                      <Path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
                    </Svg>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 40,
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
  iconButton: { padding: 8, borderRadius: 20, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 120 },

  searchSection: { marginBottom: 24 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, height: 56,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30' },
  filtersScroll: { marginTop: 16 },
  filtersContent: { gap: 8 },
  filterBtn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 100, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  filterBtnActive: { backgroundColor: '#01789E', borderColor: '#01789E' },
  filterBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  filterBtnTextActive: { color: '#FFFFFF' },
  customerTypeBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#64748B' },
  customerTypeBtnTextActive: { color: '#01789E' },
  stateChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  stateChipActive: { backgroundColor: '#F0F9FF', borderColor: '#005E7D' },
  stateChipText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#64748B' },
  stateChipTextActive: { color: '#005E7D', fontFamily: 'Inter_600SemiBold' },

  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20,
    borderWidth: 1, borderColor: '#F8FAFC',
    shadowColor: '#01789E', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.06, shadowRadius: 40, elevation: 4,
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  statHeadline: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 24, color: '#0B1C30' },
  statTrendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  statTrendText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#22C55E' },
  statActionReqText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#01789E', marginTop: 8 },

  listContainer: { marginBottom: 40 },
  sectionTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#164E63', marginBottom: 16, marginLeft: 4 },
  customerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9',
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  customerInitials: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#01789E' },
  customerName: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0B1C30' },
  customerDetails: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  statusVerified: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  statusVerifiedText: { color: '#16A34A' },
  statusPendingText: { color: '#D97706' },

  fab: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#54FAEF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#10D7CD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 28, 48, 0.4)', justifyContent: 'flex-end' },
  modalContentWrapper: { width: '100%', flex: 1, justifyContent: 'flex-end', paddingTop: 60 },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    flex: 1, // Let it fill available space in wrapper
    shadowColor: '#01789E', shadowOffset: { width: 0, height: -20 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 20,
  },
  modalHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginTop: 16, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: '#164E63' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

  formContainer: { gap: 24 },
  typeSelector: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  typeBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  typeBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#94A3B8' },
  typeBtnTextActive: { color: '#005E7D' },

  formSectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0F172A', marginTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },

  inputGroup: { gap: 6 },
  rowInputs: { flexDirection: 'row', gap: 16 },
  inputLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#64748B', marginLeft: 4 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30',
  },
  phoneInputRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  phonePrefix: { paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_500Medium', fontSize: 16, color: '#94A3B8', backgroundColor: '#F8FAFC', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  phoneInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Inter_400Regular', fontSize: 16, color: '#0B1C30' },

  submitBtn: {
    backgroundColor: '#01789E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, marginTop: 16,
    shadowColor: '#01789E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  submitBtnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },
  autocompleteDropdown: { position: 'absolute', top: 76, left: 0, right: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10, zIndex: 1000 },
  autocompleteItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  autocompleteText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#0F172A' },
});
