import PreviewStatus from '../components/common/PreviewStatus';
import Button from '../components/common/Button';
import { TableRowSkeleton } from '../components/common/Skeleton';
import { useCachedPreview } from '../services/api/useCachedPreview';
import { CACHE_SLOTS, isResponseAcceptable } from '../services/api/responseCache.mjs';
import { getSessionAuthContext } from '../services/api/client';
import CheckIcon from '../components/common/CheckIcon';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import {
  SearchableClientDropdown,
  CycleDropdown,
  DeductionsInputCard,
  StatementPaperCard,
  getWeeklyCollections,
  getStatementPreview,
  saveStatement,
  getAuthorizedCollectors,
  getActiveCollectionCycles,
} from '../features/collections';
import { colors, fonts, spacing, radius } from '../theme';
import {
  buildStatementPrintUrl,
  getStatementPrintBlockReason,
  hasUnsavedStatementAdjustments,
} from '../features/collections/utils/statementPrintModel.mjs';

export default function StatementsScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const [selectedStatement, setSelectedStatement] = useState(() => ({
    clientId: searchParams.clientId || null,
    cycle: searchParams.cycle || '',
    isClientExplicit: Boolean(searchParams.clientId),
  }));
  const selectedClientId = selectedStatement.clientId;
  const selectedCycle = selectedStatement.cycle;
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [deductionAmount, setDeductionAmount] = useState('0');
  const [deductionNote, setDeductionNote] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [review, setReview] = useState(null);
  const baselineRef = useRef(null);
  const cycles = useCachedPreview({ slot: CACHE_SLOTS.COLLECTION_CYCLES, cache: false,
    fetcher: signal => getActiveCollectionCycles({ signal, strict: true }) });
  const cycleOptions = cycles.data || [];
  const metadata = useCachedPreview({ slot: CACHE_SLOTS.WEEKLY_COLLECTIONS, cache: false,
    query: { targetDate: selectedCycle }, enabled: Boolean(selectedCycle),
    fetcher: async signal => {
      const data = await getWeeklyCollections(selectedCycle, { signal });
      if (!Array.isArray(data?.items ?? data?.collections)) throw new Error('Invalid collection metadata.');
      return data;
    } });
  const collectorResource = useCachedPreview({ slot: 'statement_collectors', cache: false,
    fetcher: async signal => {
      const data = await getAuthorizedCollectors({ signal });
      if (!Array.isArray(data)) throw new Error('Invalid collector directory.');
      return data;
    } });
  const collectors = collectorResource.data || [];
  const clients = (metadata.data?.items || metadata.data?.collections || [])
    .filter(item => Boolean(item.statementId) && ['SOA_GENERATED', 'SETTLED'].includes(item.status))
    .map(item => ({ clientId: item.clientId || item.clientCode, id: item.clientId || item.clientCode,
      name: item.clientName || item.name, soaNumber: item.statementId, clientCode: item.clientCode,
      contactNumber: item.contactNumber, outstanding: item.netAmountDue ?? item.balance ?? 0 }));
  const isRequestedClientUnavailable = selectedStatement.isClientExplicit && metadata.data !== null
    && !clients.some(client => client.clientId === selectedClientId);
  const query = { clientId: selectedClientId, targetDate: selectedCycle };
  const resource = useCachedPreview({ slot: CACHE_SLOTS.STATEMENTS, query,
    enabled: Boolean(selectedClientId && selectedCycle && !isRequestedClientUnavailable),
    fetcher: async signal => {
      const data = await getStatementPreview(selectedClientId, selectedCycle, { signal });
      if (!data || !Array.isArray(data.items) || !Number.isFinite(Number(data.totalCharges))) throw new Error('Invalid statement preview.');
      return data;
    } });
  const statementData = resource.data;
  const loading = Boolean(selectedClientId && selectedCycle && !isRequestedClientUnavailable && resource.loading);
  const draft = { deductionAmount, deductionNote, collectedBy };
  const hasUnsavedAdjustments = baselineRef.current ? hasUnsavedStatementAdjustments({ ...baselineRef.current.data, deductionAmount: baselineRef.current.data.deductionAmount ?? 0 }, draft) : false;
  const persistedPrintBlockReason = statementData ? getStatementPrintBlockReason(statementData) : null;
  const printBlockReason = hasUnsavedAdjustments ? 'Save statement adjustments before printing.' : persistedPrintBlockReason;
  const isPrintDisabled = !resource.isFresh || !statementData || statementData.items?.length === 0 || saving || Boolean(review) || Boolean(printBlockReason);
  const selectionRef = useRef(null);
  const selection = JSON.stringify([getSessionAuthContext().userId, getSessionAuthContext().sessionGeneration, selectedClientId, selectedCycle]);
  selectionRef.current = selection;
  const applyServerValues = data => {
    setDeductionAmount(String(data?.deductionAmount ?? 0));
    setDeductionNote(data?.deductionNote || '');
    setCollectedBy(data?.collectedBy || '');
  };
  useEffect(() => {
    if (!selectedCycle && cycles.isFresh && cycleOptions.length) {
      setSelectedStatement(previous => ({ ...previous, cycle: cycleOptions[0].isoDate }));
    }
  }, [cycles.data, cycles.isFresh, selectedCycle]);
  useEffect(() => {
    if (!selectedStatement.isClientExplicit && !selectedClientId && metadata.isFresh && clients.length) {
      setSelectedStatement(previous => ({ ...previous, clientId: clients[0].clientId }));
    }
  }, [metadata.data, metadata.isFresh, selectedClientId, selectedStatement.isClientExplicit]);
  useEffect(() => {
    if (baselineRef.current?.selection !== selection) {
      baselineRef.current = null;
      setReview(null);
      applyServerValues(null);
    }
    if (!statementData) return;
    const previous = baselineRef.current?.data;
    const isDirty = previous && hasUnsavedStatementAdjustments({ ...previous, deductionAmount: previous.deductionAmount ?? 0 }, draft);
    const persistedValues = data => JSON.stringify({ totalCharges: data.totalCharges, totalPaid: data.totalPaid,
      deductionAmount: data.deductionAmount, deductionNote: data.deductionNote, collectedBy: data.collectedBy,
      status: data.status, items: data.items, previousBalance: data.previousBalance });
    if (isDirty) {
      if (persistedValues(previous) !== persistedValues(statementData)) setReview({ previous, current: statementData });
    } else {
      applyServerValues(statementData);
      baselineRef.current = { selection, data: statementData };
      setReview(null);
    }
  }, [statementData, selection]);
  const confirmDiscard = () => !hasUnsavedAdjustments || (typeof window !== 'undefined' && window.confirm('Discard unsaved statement adjustments?'));
  const selectClient = id => {
    if (id !== selectedClientId && !saving && confirmDiscard()) {
      setSelectedStatement(previous => ({ ...previous, clientId: id, isClientExplicit: false }));
    }
  };
  const selectCycle = cycle => {
    if (cycle !== selectedCycle && !saving && confirmDiscard()) {
      setSelectedStatement({ clientId: null, cycle, isClientExplicit: false });
    }
  };
  useEffect(() => {
    const requestedCycle = searchParams.cycle || selectedCycle;
    const requestedClientId = searchParams.clientId || (requestedCycle === selectedCycle ? selectedClientId : null);
    if (requestedCycle === selectedCycle && requestedClientId === selectedClientId) return;
    if (saving || !confirmDiscard()) return;
    setSelectedStatement({ clientId: requestedClientId, cycle: requestedCycle, isClientExplicit: Boolean(searchParams.clientId) });
  }, [searchParams.clientId, searchParams.cycle]);
  const resolveReview = useServer => {
    if (useServer) applyServerValues(statementData);
    baselineRef.current = { selection, data: statementData };
    setReview(null);
  };
  const isDraftValid = Number.isFinite(Number(deductionAmount)) && Number(deductionAmount) >= 0
    && Number(deductionAmount) <= Math.max(0, Number(statementData?.totalCharges || 0) - Number(statementData?.totalPaid || 0))
    && /^\d+(\.\d{1,2})?$/.test(deductionAmount) && deductionNote.trim().length <= 255 && collectedBy.trim().length <= 150;

  // Handle Save deduction and collector
  const handleSaveDeductions = async () => {
    if (!resource.isCurrent() || !metadata.isCurrent() || !collectorResource.isCurrent() || review || !isDraftValid || saving) return;
    const requestSelection = selection;
    const requestAuth = getSessionAuthContext();
    if (!selectedClientId) {
      setErrorMessage('Please select a client before saving statement adjustments.');
      return;
    }
    if (!selectedCycle) {
      setErrorMessage('Please select an active collection cycle.');
      return;
    }

    const numDeduction = Number(deductionAmount) || 0;
    if (isNaN(numDeduction) || numDeduction < 0) {
      setErrorMessage('Deduction amount must be zero or positive.');
      return;
    }

    const totalCharges = Number(statementData?.totalCharges || 0);
    const totalPaid = Number(statementData?.totalPaid || 0);
    const remainingBeforeDeduction = Math.max(0, totalCharges - totalPaid);
    if (numDeduction > remainingBeforeDeduction) {
      setErrorMessage(`Deduction amount cannot exceed the remaining statement balance (₱${remainingBeforeDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`);
      return;
    }

    const decimalParts = String(deductionAmount || '').split('.');
    if (decimalParts.length > 1 && decimalParts[1].length > 2) {
      setErrorMessage('Deduction amount must have at most 2 decimal places.');
      return;
    }

    const trimmedNote = (deductionNote || '').trim();
    if (trimmedNote.length > 255) {
      setErrorMessage('Deduction note must not exceed 255 characters.');
      return;
    }

    const trimmedCollector = (collectedBy || '').trim();
    if (trimmedCollector.length > 150) {
      setErrorMessage('Collected by must not exceed 150 characters.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessToast(null);

    try {
      const payload = {
        clientId: selectedClientId,
        targetDate: selectedCycle,
        deductionAmount: numDeduction,
        deductionNote: trimmedNote,
        collectedBy: trimmedCollector,
      };

      const updated = await saveStatement(payload);
      if (selectionRef.current !== requestSelection || !isResponseAcceptable({ requestAuth, currentAuth: getSessionAuthContext(), requestQuery: {}, activeQuery: {} })) return;
      baselineRef.current = { selection, data: updated };
      applyServerValues(updated);
      setReview(null);
      setSuccessToast(updated?.status === 'SETTLED'
        ? 'Statement of Account saved and settled.'
        : 'Statement of Account deductions and collector saved.');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      if (selectionRef.current !== requestSelection) return;
      console.error('Failed to save statement:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save statement deductions.');
    } finally {
      setSaving(false);
    }
  };

  // Open dedicated printable view
  const handleDirectPrint = () => {
    if (isPrintDisabled || !resource.isCurrent()) return;
    if (!selectedClientId) return;
    if (hasUnsavedAdjustments) {
      setErrorMessage('Save statement adjustments before printing. Print output only uses persisted values.');
      return;
    }
    const blockReason = getStatementPrintBlockReason(statementData);
    if (blockReason) {
      setErrorMessage(blockReason);
      return;
    }

    const printUrl = buildStatementPrintUrl(selectedClientId, selectedCycle);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(printUrl, '_blank');
    } else {
      router.push(printUrl);
    }
  };

  return (
    <AppShell>
      {/* Print Media CSS Injection for pristine A4 document export */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body, html {
                  background-color: #FFFFFF !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                /* Hide sidebar, navigation bar, controls, and buttons during print */
                header, nav, [role="navigation"], .no-print,
                button, [data-testid="sidebar"], div[class*="sidebar"] {
                  display: none !important;
                }
                /* Force stacked A4 paper sheets to print 1-to-1 cleanly */
                .soa-paper-sheet, div[class*="soa-paper-sheet"] {
                  box-shadow: none !important;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 auto !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  page-break-after: always !important;
                  break-after: page !important;
                }
                .soa-paper-sheet:last-child, div[class*="soa-paper-sheet"]:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 12mm 12mm 15mm 12mm;
                }
              }
            `,
          }}
        />
      )}

      <View style={styles.container}>
        {/* Top Header & Actions Row (no-print) */}
        <View style={styles.headerBar}>
          <View style={styles.titleArea}>
            <Text style={styles.eyebrow}>CONSOLIDATED: ONE PER CLIENT</Text>
            <Text style={styles.pageTitle}>STATEMENT OF ACCOUNT</Text>
          </View>

          <View style={styles.actionButtonsRow}>
            {/* Return to Weekly Collections */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/weekly-collections')}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>Weekly List</Text>
            </TouchableOpacity>

            {/* Print / Export PDF */}
            <TouchableOpacity
              style={[
                styles.printButton,
                isPrintDisabled && styles.printButtonDisabled,
              ]}
              onPress={handleDirectPrint}
              disabled={isPrintDisabled}
              activeOpacity={0.8}
            >
              <Text style={styles.printButtonText}>Print / Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selectors Bar: Client Dropdown + Thursday Cycle Dropdown (no-print) */}
        <View style={styles.selectorsBar}>
          {/* Client Combobox Dropdown */}
          <View style={styles.clientDropdownWrap}>
            <Text style={styles.selectorLabel}>CLIENT</Text>
            <SearchableClientDropdown
              clients={clients}
              showSoaNumber
              selectedClientId={selectedClientId}
              onSelectClient={(client) => {
                const id = client.clientId || client.id;
                selectClient(id);
              }}
              placeholder={!metadata.isFresh ? "Generated clients unavailable or refreshing" : clients.length === 0 ? "No generated SOAs for this cycle" : "Search by SOA number, client name, code, or contact..."}
            />
          </View>

          {/* Thursday Cycle Dropdown */}
          <View style={styles.cycleDropdownWrap}>
            <Text style={styles.selectorLabel}>COLLECTION CYCLE</Text>
            <CycleDropdown
              cycles={cycleOptions}
              selectedCycle={selectedCycle}
              onSelectCycle={selectCycle}
            />
          </View>
        </View>

        <PreviewStatus resource={cycles} label="Collection cycles" />
        {isRequestedClientUnavailable && metadata.isFresh ? (
          <Text style={styles.errorBannerText}>Requested client {selectedClientId} is unavailable for collection cycle {selectedCycle}. Select another client or cycle.</Text>
        ) : null}
        {selectedCycle ? <PreviewStatus resource={metadata} label="Generated clients" /> : null}
        <PreviewStatus resource={collectorResource} label="Authorized collectors" />
        {selectedClientId && selectedCycle && !isRequestedClientUnavailable ? <PreviewStatus resource={resource} label="Statement preview" /> : null}
        {cycles.isFresh && cycleOptions.length === 0 ? <Text>No active collection cycles.</Text> : null}
        {review ? <View style={styles.printGuardBanner}>
          <Text style={styles.printGuardText}>Persisted statement values changed. Review before saving.</Text>
          {['totalCharges', 'totalPaid', 'previousBalance', 'deductionAmount', 'deductionNote', 'collectedBy', 'status'].map(field =>
            <Text key={field}>{field}: previous {String(review.previous[field] ?? '')}; current {String(review.current[field] ?? '')}</Text>)}
          <Text>Shipment items: previous {review.previous.items?.length}; current {review.current.items?.length}. Review the current statement below.</Text>
          <Button label="Keep my adjustments" onPress={() => resolveReview(false)} />
          <Button label="Use server values" onPress={() => resolveReview(true)} />
        </View> : null}
        {/* Notifications & Error Feedback */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}
        {successToast && (
          <View style={styles.successBanner}>
            <CheckIcon size={14} color="#166534" /><Text style={styles.successBannerText}>{successToast}</Text>
          </View>
        )}
        {printBlockReason && statementData ? (
          <View style={styles.printGuardBanner}>
            <Text style={styles.printGuardText}>{printBlockReason}</Text>
            {persistedPrintBlockReason?.includes('System Settings') ? (
              <TouchableOpacity onPress={() => router.push('/settings')}>
                <Text style={styles.printGuardLink}>Open System Settings</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Deductions & Collector Input Card (no-print) */}
        <View style={styles.deductionsBarWrap}>
          <DeductionsInputCard
            deductionAmount={deductionAmount}
            onDeductionAmountChange={setDeductionAmount}
            deductionNote={deductionNote}
            onDeductionNoteChange={setDeductionNote}
            collectedBy={collectedBy}
            onCollectedByChange={setCollectedBy}
            collectors={collectors}
            onSave={handleSaveDeductions}
            saving={saving}
            disabled={!statementData || saving}
            saveDisabled={!resource.isFresh || !metadata.isFresh || !collectorResource.isFresh || Boolean(review) || !isDraftValid}
            maxDeduction={statementData ? Math.max(0, Number(statementData.totalCharges) - Number(statementData.totalPaid || 0)) : null}
          />
        </View>

        {/* A4 Paper Statement Card Canvas */}
        {loading ? (
          <TableRowSkeleton rows={8} />
        ) : !metadata.isFresh && !statementData ? null : metadata.isFresh && clients.length === 0 && !statementData ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Statements Generated for this Cycle</Text>
            <Text style={styles.emptySubtitle}>
              Clients will appear here once their breakdown has been reviewed and generated from Weekly Collections.
            </Text>
            <TouchableOpacity
              style={styles.gotoCollectionsBtn}
              onPress={() => router.push(`/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.gotoCollectionsBtnText}>Go to Weekly Collections</Text>
            </TouchableOpacity>
          </View>
        ) : statementData ? (
          <StatementPaperCard
            data={statementData}
            currentUser={{ name: 'Maria Santos', role: 'Administrator' }}
            liveDeduction={Number(deductionAmount) || 0}
            liveDeductionNote={deductionNote}
            liveCollectedBy={collectedBy}
          />
        ) : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  titleArea: {
    flex: 1,
    minWidth: 260,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D0C9',
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  printButton: {
    backgroundColor: '#111110',
    borderRadius: radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printButtonDisabled: {
    opacity: 0.4,
  },
  printButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  selectorsBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
    zIndex: 40,
    flexWrap: 'wrap',
  },
  clientDropdownWrap: {
    flex: 2,
    minWidth: 320,
    zIndex: 50,
  },
  cycleDropdownWrap: {
    flex: 1.2,
    minWidth: 260,
    zIndex: 45,
  },
  selectorLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  deductionsBarWrap: {
    marginBottom: spacing.md,
    zIndex: 20,
  },

  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },

  errorBanner: {
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#991B1B',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  successBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  printGuardBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  printGuardText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  printGuardLink: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '800',
    textDecorationLine: 'underline',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  gotoCollectionsBtn: {
    backgroundColor: '#111110',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
  },
  gotoCollectionsBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
