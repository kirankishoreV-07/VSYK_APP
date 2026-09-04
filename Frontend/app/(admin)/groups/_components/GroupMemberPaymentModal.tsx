import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../../lib/supabase';
import { RecordCashCollectionModal } from '../../customers/_components/RecordCashCollectionModal';
import { getCycleDueAmount, getFullyCollectedMonths } from '../../../../lib/chitPayments';
import { isAuctionScheduledDisplay } from '../../../../lib/auctionUtils';
import { isMemberAuctionWinner, WINNER_HIGHLIGHT } from '../../../../lib/auctionWinner';
import { buildCsvDocument, paiseToCsvAmount, shareCsvFile } from '../../../../lib/csvExport';
import { generateCSVFilename } from '../../customers/_components/utils';
import type { ChitMember } from '../../customers/_components/types';
import { apiPostAdmin } from '../../../../lib/api';

function formatDate(value: any) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: any) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatRupees(value: number | null | undefined) {
  return `₹${Math.round(Number(value || 0) / 100).toLocaleString('en-IN')}`;
}

export interface GroupMemberWithTicket {
  id: string;
  customer_id: string;
  ticket_number?: string | number | null;
  current_month?: number;
  bid_status?: string;
  joined_at?: string;
  participation_type?: string;
  participation_share?: number;
  display_ticket: number;
  customers?: { full_name?: string | null; phone?: string | null; customer_id?: string | null };
}

export interface GroupMemberPaymentModalProps {
  visible: boolean;
  member: GroupMemberWithTicket | null;
  group: any;
  deduplicatedAuctions: any[];
  onClose: () => void;
  onMemberRemoved: () => void;
  onRequestSettlement: (monthNumber: number) => void;
}

export function GroupMemberPaymentModal({
  visible,
  member,
  group,
  deduplicatedAuctions,
  onClose,
  onMemberRemoved,
  onRequestSettlement,
}: GroupMemberPaymentModalProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [memberCashCollections, setMemberCashCollections] = useState<any[]>([]);
  const [showLogPayment, setShowLogPayment] = useState(false);
  const [showRecordCash, setShowRecordCash] = useState(false);
  const [editingCashCollection, setEditingCashCollection] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedAuctionId, setSelectedAuctionId] = useState('');
  const [loggingPayment, setLoggingPayment] = useState(false);

  const isUnaccountedGroup = group?.accounting_type === 'unaccounted';

  const resetSubViews = useCallback(() => {
    setShowLogPayment(false);
    setShowRecordCash(false);
    setEditingCashCollection(null);
    setPaymentAmount('');
    setSelectedAuctionId('');
  }, []);

  const handleClose = useCallback(() => {
    resetSubViews();
    onClose();
  }, [onClose, resetSubViews]);

  const fetchCashCollections = useCallback(async (chitMemberId: string) => {
    try {
      const { data } = await supabase
        .from('cash_collections')
        .select('*')
        .eq('chit_member_id', chitMemberId)
        .order('month_number', { ascending: true });
      setMemberCashCollections(data || []);
    } catch (err) {
      console.error('Error fetching cash collections:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async (chitMemberId: string) => {
    try {
      const { data } = await supabase
        .from('chit_member_transactions')
        .select('*, auctions(auction_number)')
        .eq('chit_member_id', chitMemberId)
        .order('transaction_date', { ascending: false });
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching tx:', err);
    }
  }, []);

  useEffect(() => {
    if (!visible || !member?.id) return;
    resetSubViews();
    if (isUnaccountedGroup) {
      fetchCashCollections(member.id);
    } else {
      fetchTransactions(member.id);
    }
  }, [visible, member?.id, isUnaccountedGroup, fetchCashCollections, fetchTransactions, resetSubViews]);

  const buildCashMembership = (m: GroupMemberWithTicket): ChitMember => ({
    id: m.id,
    chit_group_id: group.id,
    customer_id: m.customer_id,
    ticket_number: m.ticket_number ? String(m.ticket_number) : null,
    current_month: m.current_month || 1,
    bid_status: (m.bid_status as ChitMember['bid_status']) || 'active',
    joined_at: m.joined_at || new Date().toISOString(),
    chit_groups: {
      id: group.id,
      name: group.name,
      value: group.value,
      duration_months: group.duration_months,
      monthly_installment: group.monthly_installment,
      status: group.status,
      start_date: group.start_date ?? null,
      accounting_type: group.accounting_type || 'unaccounted',
    },
  });

  const handleRemoveMember = () => {
    if (!member?.id) return;
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member?.customers?.full_name || 'this member'}? All their transaction history will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('chit_members').delete().eq('id', member.id);
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              handleClose();
              onMemberRemoved();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  };

  const handleLogPayment = async () => {
    if (!member || !selectedAuctionId || !paymentAmount) {
      Alert.alert('Error', 'Please enter amount and select an auction.');
      return;
    }

    const amountInPaise = Math.round(parseFloat(paymentAmount) * 100);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      Alert.alert('Error', 'Invalid amount.');
      return;
    }

    setLoggingPayment(true);
    try {
      const result = await apiPostAdmin<{
        ok: boolean;
        fully_paid: boolean;
        paid_amount: number;
        remaining: number;
      }>('/api/payments/admin/record', {
        chitMemberId: member.id,
        auctionId: selectedAuctionId,
        amount: amountInPaise,
        paymentMethod: 'manual',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        result.fully_paid ? 'Payment Completed' : 'Partial Payment Recorded',
        result.fully_paid
          ? 'The installment is fully paid and the schedule has been updated.'
          : `Remaining balance: ${formatRupees(result.remaining)}`,
      );
      setPaymentAmount('');
      setSelectedAuctionId('');
      setShowLogPayment(false);
      fetchTransactions(member.id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoggingPayment(false);
    }
  };

  const handleRequestSettlement = (monthNumber: number) => {
    setShowRecordCash(false);
    setShowLogPayment(false);
    setEditingCashCollection(null);
    onRequestSettlement(monthNumber);
  };

  const handleExportCsv = async () => {
    if (!member || !group) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const customerName = member.customers?.full_name ?? 'Member';
    const exportedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const customerRef = member.customers?.customer_id ?? member.customer_id ?? member.id;

    try {
      const csv = isUnaccountedGroup
        ? buildCsvDocument(
            [
              ['Customer', customerName],
              ['Group', group.name ?? ''],
              ['Ticket', String(member.display_ticket)],
              ['Type', 'Cash Only (Unaccounted)'],
              ['Exported At (IST)', exportedAt],
            ],
            ['Month', 'Collected Amount (INR)', 'Payable Amount (INR)', 'Remaining (INR)', 'Status', 'Recorded At', 'Notes'],
            memberCashCollections.map((cc) => {
              const cycleDue = getCycleDueAmount(
                cc.month_number,
                group?.monthly_installment || 0,
                deduplicatedAuctions,
              );
              const status =
                cycleDue == null ? 'Recorded' : cc.amount >= cycleDue ? 'Full' : cc.amount > 0 ? 'Partial' : 'Unpaid';
              const remaining = cycleDue != null ? Math.max(0, cycleDue - cc.amount) : 0;
              return [
                cc.month_number,
                paiseToCsvAmount(cc.amount),
                cycleDue != null ? paiseToCsvAmount(cycleDue) : '',
                paiseToCsvAmount(remaining),
                status,
                `${formatDate(cc.recorded_at)} ${formatTime(cc.recorded_at)}`,
                cc.notes ?? '',
              ];
            }),
          )
        : buildCsvDocument(
            [
              ['Customer', customerName],
              ['Group', group.name ?? ''],
              ['Ticket', String(member.display_ticket)],
              ['Type', 'Accounted'],
              ['Exported At (IST)', exportedAt],
            ],
            ['Auction', 'Amount (INR)', 'Transaction Date', 'Status', 'Notes'],
            transactions.map((tx) => [
              tx.auctions?.auction_number ?? '',
              paiseToCsvAmount(tx.amount),
              `${formatDate(tx.transaction_date)} ${formatTime(tx.transaction_date)}`,
              tx.status ?? 'completed',
              tx.notes ?? '',
            ]),
          );

      await shareCsvFile({
        filename: generateCSVFilename(customerRef, group.name ?? 'group'),
        content: csv,
        dialogTitle: `${customerName} — ${group.name} payment history`,
      });
    } catch {
      Alert.alert('Export failed', 'Could not export payment history file.');
    }
  };

  if (!member) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="#64748B">
              <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.modalTitle}>Payment History</Text>
            <Text style={styles.modalSubtitle}>
              {member.customers?.full_name} • Ticket #{member.display_ticket}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleExportCsv} style={styles.closeBtn}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#01789E">
                <Path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRemoveMember} style={[styles.closeBtn, styles.removeBtn]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#EF4444">
                <Path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>

        {showRecordCash && isUnaccountedGroup ? (
          <RecordCashCollectionModal
            embedded
            visible={showRecordCash}
            onClose={() => { setShowRecordCash(false); setEditingCashCollection(null); }}
            onBack={() => { setShowRecordCash(false); setEditingCashCollection(null); }}
            membership={buildCashMembership(member)}
            auctions={deduplicatedAuctions}
            cashCollections={memberCashCollections}
            coveredMonths={getFullyCollectedMonths(
              memberCashCollections,
              group?.monthly_installment || 0,
              deduplicatedAuctions,
              editingCashCollection?.id,
            )}
            existingCollection={editingCashCollection}
            onRequestSettlement={handleRequestSettlement}
            onSuccess={() => {
              if (member.id) fetchCashCollections(member.id);
              setShowRecordCash(false);
              setEditingCashCollection(null);
            }}
          />
        ) : !showLogPayment ? (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.txSummaryCard}>
                <Text style={styles.txSummaryLabel}>Total Amount Paid</Text>
                <Text style={styles.txSummaryValue}>
                  ₹{(
                    (isUnaccountedGroup
                      ? memberCashCollections.reduce((sum, cc) => sum + (cc.amount || 0), 0)
                      : transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)) / 100
                  ).toLocaleString('en-IN')}
                </Text>
                <View style={styles.txSummaryDivider} />
                <View style={styles.txSummaryRow}>
                  <Text style={styles.txSummarySubText}>
                    {isUnaccountedGroup
                      ? `${memberCashCollections.length} Cash Collections`
                      : `${transactions.length} Transactions`}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={[styles.statusText, { color: isUnaccountedGroup ? '#01789E' : '#10B981' }]}>
                      {isUnaccountedGroup ? 'CASH ONLY' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>
                {isUnaccountedGroup ? 'Cash Collections' : 'Recent Transactions'}
              </Text>

              {isUnaccountedGroup ? (
                memberCashCollections.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No Cash Collections Yet</Text>
                    <Text style={styles.emptySubtext}>
                      Record the first cash collection with denomination breakdown.
                    </Text>
                  </View>
                ) : (
                  memberCashCollections.map((cc) => {
                    const cycleDue = getCycleDueAmount(
                      cc.month_number,
                      group?.monthly_installment || 0,
                      deduplicatedAuctions,
                    );
                    const monthAuction = deduplicatedAuctions.find(
                      (a) => a.auction_number === cc.month_number,
                    );
                    const memberWon = isMemberAuctionWinner(monthAuction, member.id);
                    const status = cycleDue == null
                      ? 'Recorded'
                      : cc.amount >= cycleDue ? 'Full' : cc.amount > 0 ? 'Partial' : 'Unpaid';
                    const remaining = cycleDue != null ? Math.max(0, cycleDue - cc.amount) : 0;
                    return (
                      <TouchableOpacity
                        key={cc.id}
                        style={[styles.txRow, memberWon && styles.txRowWinner]}
                        activeOpacity={0.7}
                        onPress={() => { setEditingCashCollection(cc); setShowRecordCash(true); }}
                      >
                        <View style={[styles.txIconBox, { backgroundColor: '#F0F9FF' }]}>
                          <Text style={styles.cashEmoji}>💵</Text>
                        </View>
                        <View style={styles.txBody}>
                          <View style={styles.txTitleRow}>
                            <Text style={styles.txTitle}>Month {cc.month_number} · {status}</Text>
                            {memberWon && (
                              <View style={styles.winnerPill}>
                                <Text style={styles.winnerPillText}>WINNER</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.txDate}>
                            {formatDate(new Date(cc.recorded_at))} • {formatTime(new Date(cc.recorded_at))}
                          </Text>
                          {status === 'Partial' && (
                            <Text style={styles.partialRemaining}>
                              ₹{(remaining / 100).toLocaleString('en-IN')} remaining
                            </Text>
                          )}
                        </View>
                        <View style={styles.txRight}>
                          <Text style={styles.txAmount}>₹{(cc.amount / 100).toLocaleString('en-IN')}</Text>
                          <Text style={styles.txStatus}>Cash</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )
              ) : transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Svg width={48} height={48} viewBox="0 0 24 24" fill="#CBD5E1" style={{ marginBottom: 16 }}>
                    <Path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  </Svg>
                  <Text style={styles.emptyTitle}>No Payments Yet</Text>
                  <Text style={styles.emptySubtext}>
                    This member hasn't made any payments for this group yet.
                  </Text>
                </View>
              ) : (
                transactions.map((tx) => {
                  const txAuction = deduplicatedAuctions.find((a) => a.id === tx.auction_id);
                  const memberWon = isMemberAuctionWinner(txAuction, member.id);
                  return (
                  <View key={tx.id} style={[styles.txRow, memberWon && styles.txRowWinner]}>
                    <View style={styles.txIconBox}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="#005E7D">
                        <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                      </Svg>
                    </View>
                    <View style={styles.txBody}>
                      <View style={styles.txTitleRow}>
                        <Text style={styles.txTitle}>Auction #{tx.auctions?.auction_number || '?'}</Text>
                        {memberWon && (
                          <View style={styles.winnerPill}>
                            <Text style={styles.winnerPillText}>WINNER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.txDate}>
                        {formatDate(new Date(tx.transaction_date))} • {formatTime(new Date(tx.transaction_date))}
                      </Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={styles.txAmountPositive}>+ ₹{(tx.amount / 100).toLocaleString('en-IN')}</Text>
                      <Text style={styles.txStatus}>Success</Text>
                    </View>
                  </View>
                );
                })
              )}
            </ScrollView>

            <View style={styles.footer}>
              {isUnaccountedGroup ? (
                <TouchableOpacity
                  style={styles.executeBtn}
                  onPress={() => { setEditingCashCollection(null); setShowRecordCash(true); }}
                >
                  <Text style={styles.executeBtnText}>RECORD CASH COLLECTION</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.executeBtn} onPress={() => setShowLogPayment(true)}>
                  <Text style={styles.executeBtnText}>LOG NEW PAYMENT</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.logPaymentContent}>
            <TouchableOpacity onPress={() => setShowLogPayment(false)} style={styles.backLink}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#64748B">
                <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </Svg>
              <Text style={styles.backLinkText}>Back to History</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Select Auction Cycle</Text>
            {deduplicatedAuctions.length === 0 ? (
              <Text style={styles.noAuctionsText}>No auctions exist for this group yet.</Text>
            ) : (
              <View style={styles.auctionList}>
                {deduplicatedAuctions.map((a) => {
                  const cycleDue = getCycleDueAmount(
                    a.auction_number || 0,
                    group?.monthly_installment || 0,
                    deduplicatedAuctions,
                  );
                  const isPending = cycleDue == null;
                  const memberWon = isMemberAuctionWinner(a, member.id);
                  return (
                    <TouchableOpacity
                      key={`log-pay-${a.auction_number}`}
                      style={[
                        styles.auctionCycleRow,
                        memberWon && styles.auctionCycleRowWinner,
                        selectedAuctionId === a.id && styles.auctionCycleRowActive,
                        isPending && styles.auctionCycleRowPending,
                      ]}
                      disabled={isPending}
                      onPress={() => {
                        if (cycleDue == null) return;
                        if (a.id) setSelectedAuctionId(a.id);
                        setPaymentAmount(String(cycleDue / 100));
                      }}
                    >
                      <View style={styles.auctionCycleBody}>
                        <View style={styles.auctionCycleTitleRow}>
                          <Text style={[
                            styles.auctionCycleTitle,
                            selectedAuctionId === a.id && styles.auctionCycleTitleActive,
                            memberWon && { color: WINNER_HIGHLIGHT.text },
                          ]}>
                            Auction #{a.auction_number}
                          </Text>
                          {memberWon && (
                            <View style={styles.winnerPill}>
                              <Text style={styles.winnerPillText}>WINNER</Text>
                            </View>
                          )}
                        </View>
                        {isAuctionScheduledDisplay(a) && a.scheduled_at && (
                          <Text style={styles.auctionCycleDate}>{formatDate(new Date(a.scheduled_at))}</Text>
                        )}
                        {cycleDue != null ? (
                          <Text style={styles.auctionCyclePayable}>Payable: {formatRupees(cycleDue)}</Text>
                        ) : (
                          <View style={styles.pendingBlock}>
                            <Text style={styles.auctionCyclePending}>
                              Awaiting Auction #{a.auction_number} settlement
                            </Text>
                            <TouchableOpacity onPress={() => handleRequestSettlement(a.auction_number || 0)}>
                              <Text style={styles.settlementLink}>Set settlement →</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      <Text style={styles.auctionCycleStatus}>{(a.status || 'upcoming').toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedAuctionId && (() => {
              const selected = deduplicatedAuctions.find((a) => a.id === selectedAuctionId);
              if (!selected) return null;
              const due = getCycleDueAmount(
                selected.auction_number || 0,
                group?.monthly_installment || 0,
                deduplicatedAuctions,
              );
              if (due == null) return null;
              return (
                <View style={styles.payableBar}>
                  <Text style={styles.payableLabel}>Payable Installment</Text>
                  <Text style={styles.payableValue}>{formatRupees(due)}</Text>
                </View>
              );
            })()}

            <Text style={styles.sectionTitle}>Payment Amount (₹)</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Enter partial or full payment amount"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            <Text style={styles.amountHint}>
              Enter partial or full amount paid by the member.
            </Text>

            <TouchableOpacity
              style={[styles.executeBtn, (!selectedAuctionId || !paymentAmount) && styles.executeBtnDisabled]}
              onPress={handleLogPayment}
              disabled={loggingPayment || !selectedAuctionId || !paymentAmount}
            >
              {loggingPayment ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.executeBtnText}>SAVE PAYMENT</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#0B1C30' },
  modalSubtitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#64748B' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: { backgroundColor: '#FEF2F2' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  logPaymentContent: { padding: 20 },
  txSummaryCard: {
    backgroundColor: '#0F172A',
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#00D1C1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  txSummaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#94A3B8', marginBottom: 8 },
  txSummaryValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: '#FFFFFF' },
  txSummaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  txSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txSummarySubText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#94A3B8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 16,
    color: '#164E63',
    marginBottom: 16,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: { fontFamily: 'SpaceGrotesk_600SemiBold', color: '#0F172A', fontSize: 16, marginBottom: 8 },
  emptySubtext: { fontFamily: 'Inter_400Regular', color: '#64748B', fontSize: 13, textAlign: 'center' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txRowWinner: {
    backgroundColor: WINNER_HIGHLIGHT.bg,
    borderColor: WINNER_HIGHLIGHT.borderStrong,
    borderWidth: 2,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  winnerPill: {
    backgroundColor: WINNER_HIGHLIGHT.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: WINNER_HIGHLIGHT.border,
  },
  winnerPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: WINNER_HIGHLIGHT.badgeText,
    letterSpacing: 0.6,
  },
  txIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cashEmoji: { fontSize: 18 },
  txBody: { flex: 1 },
  txTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#0F172A' },
  txDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B' },
  partialRemaining: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#D97706', marginTop: 4 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#01789E', marginBottom: 4 },
  txAmountPositive: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#10B981', marginBottom: 4 },
  txStatus: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B' },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  executeBtn: {
    backgroundColor: '#00D1C1',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  executeBtnDisabled: { opacity: 0.5 },
  executeBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#0F172A', letterSpacing: 0.5 },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backLinkText: { fontFamily: 'Inter_500Medium', color: '#64748B', marginLeft: 8 },
  noAuctionsText: { fontFamily: 'Inter_400Regular', color: '#94A3B8', marginBottom: 20 },
  auctionList: { gap: 10, marginBottom: 24 },
  auctionCycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  auctionCycleRowActive: { borderColor: '#005E7D', backgroundColor: '#F0F9FF' },
  auctionCycleRowWinner: {
    backgroundColor: WINNER_HIGHLIGHT.bg,
    borderColor: WINNER_HIGHLIGHT.borderStrong,
    borderWidth: 2,
  },
  auctionCycleRowPending: { opacity: 0.55 },
  auctionCycleBody: { flex: 1 },
  auctionCycleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  auctionCycleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#0F172A' },
  auctionCycleTitleActive: { color: '#005E7D' },
  auctionCycleDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 2 },
  auctionCyclePayable: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#01789E', marginTop: 4 },
  pendingBlock: { gap: 4 },
  auctionCyclePending: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#94A3B8', marginTop: 4, fontStyle: 'italic' },
  settlementLink: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#01789E' },
  auctionCycleStatus: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#64748B', letterSpacing: 0.3 },
  payableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  payableLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#005E7D', letterSpacing: 0.4 },
  payableValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#01789E' },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: '#0B1C30',
  },
  amountHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 32,
  },
});
