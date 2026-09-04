import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
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
  getRecentThursdays,
  generateThursdayCycleOptions,
  getActiveCollectionCycles,
  formatCurrency,
} from '../features/collections';
import { colors, fonts, spacing, radius } from '../theme';

export default function StatementsScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.clientId || null);

  const [cycleOptions, setCycleOptions] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(searchParams.cycle || '');

  // Load only active cycles containing registered shipments
  useEffect(() => {
    let mounted = true;
    async function loadCycles() {
      const activeCycles = await getActiveCollectionCycles();
      if (!mounted) return;
      if (activeCycles.length > 0) {
        setCycleOptions(activeCycles);
        setSelectedCycle((prev) => {
          if (searchParams.cycle && activeCycles.some((c) => c.isoDate === searchParams.cycle)) {
            return searchParams.cycle;
          }
          if (prev && activeCycles.some((c) => c.isoDate === prev)) {
            return prev;
          }
          return activeCycles[0].isoDate;
        });
      } else {
        const fallback = getRecentThursdays(1);
        setCycleOptions(fallback);
        setSelectedCycle(fallback[0]?.isoDate || '');
      }
    }
    loadCycles();
    return () => {
      mounted = false;
    };
  }, [searchParams.cycle]);

  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Deductions & Collector form state
  const [deductionAmount, setDeductionAmount] = useState('0');
  const [deductionNote, setDeductionNote] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [collectors, setCollectors] = useState([]);

  // Load generated clients for the selected cycle
  useEffect(() => {
    async function loadCycleClients() {
      try {
        const [collectionsData, collectorsData] = await Promise.all([
          getWeeklyCollections(selectedCycle).catch(() => ({ items: [] })),
          getAuthorizedCollectors().catch(() => []),
        ]);

        setCollectors(collectorsData || []);

        const allCycleItems = collectionsData?.items || collectionsData?.collections || [];
        // Filter strictly for clients whose SOA has been generated
        const generatedList = allCycleItems
          .filter(
            (item) =>
              Boolean(item.statementId) &&
              (item.status === 'SOA_GENERATED' || item.status === 'SETTLED')
          )
          .map((item) => ({
            clientId: item.clientId || item.clientCode,
            id: item.clientId || item.clientCode,
            name: item.clientName || item.name,
            soaNo: item.statementId,
            outstanding: item.netAmountDue ?? item.balance ?? 0,
          }));

        setClients(generatedList);

        // If query param clientId matches one of the generated clients, select it
        if (searchParams.clientId && generatedList.some((c) => c.clientId === searchParams.clientId)) {
          setSelectedClientId(searchParams.clientId);
        } else if (generatedList.length > 0) {
          // Otherwise pick the first generated client if none currently selected or current not in list
          if (!selectedClientId || !generatedList.some((c) => c.clientId === selectedClientId)) {
            setSelectedClientId(generatedList[0].clientId);
          }
        } else {
          setSelectedClientId(null);
          setStatementData(null);
        }
      } catch (err) {
        console.warn('Failed to load generated clients for cycle:', err);
      }
    }

    if (selectedCycle) {
      loadCycleClients();
    }
  }, [selectedCycle, searchParams.clientId]);

  // Update selectedClientId if query param changes
  useEffect(() => {
    if (searchParams.clientId) {
      setSelectedClientId(searchParams.clientId);
    }
    if (searchParams.cycle) {
      setSelectedCycle(searchParams.cycle);
    }
  }, [searchParams.clientId, searchParams.cycle]);

  // Load statement preview whenever selected client or cycle changes
  const fetchStatement = useCallback(async () => {
    if (!selectedClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await getStatementPreview(selectedClientId, selectedCycle);
      setStatementData(data);
      setDeductionAmount(String(data.deductionAmount ?? 0));
      setDeductionNote(data.deductionNote || '');
      setCollectedBy(data.collectedBy || '');
    } catch (err) {
      console.error('Failed to load statement preview:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to load statement details.');
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedCycle]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  // Handle Save deduction and collector
  const handleSaveDeductions = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessToast(null);

    try {
      const payload = {
        clientId: selectedClientId,
        targetDate: selectedCycle,
        deductionAmount: Number(deductionAmount) || 0,
        deductionNote: deductionNote.trim(),
        collectedBy: collectedBy.trim(),
      };

      const updated = await saveStatement(payload);
      setStatementData(updated);
      setSuccessToast('Statement of Account deductions and collector saved.');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to save statement:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save statement deductions.');
    } finally {
      setSaving(false);
    }
  };

  // Open dedicated printable view
  const handleDirectPrint = () => {
    if (!selectedClientId) return;
    const printUrl = `/statements/print?clientId=${encodeURIComponent(selectedClientId)}&cycle=${encodeURIComponent(selectedCycle || '')}&deduction=${encodeURIComponent(deductionAmount || 0)}&note=${encodeURIComponent(deductionNote || '')}&collector=${encodeURIComponent(collectedBy || '')}`;
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
            <Text style={styles.eyebrow}>CONSOLIDATED · ONE PER CLIENT</Text>
            <Text style={styles.pageTitle}>STATEMENT OF ACCOUNT</Text>
          </View>

          <View style={styles.actionButtonsRow}>
            {/* Return to Weekly Collections */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/weekly-collections')}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>← Weekly List</Text>
            </TouchableOpacity>

            {/* Print / Export PDF */}
            <TouchableOpacity
              style={[
                styles.printButton,
                (!statementData || statementData.items?.length === 0) && styles.printButtonDisabled,
              ]}
              onPress={handleDirectPrint}
              disabled={!statementData || statementData.items?.length === 0}
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
              selectedClientId={selectedClientId}
              onSelectClient={(client) => {
                const id = client.clientId || client.id;
                setSelectedClientId(id);
              }}
              placeholder={clients.length === 0 ? "No generated SOAs for this cycle" : "Select client with generated SOA..."}
            />
          </View>

          {/* Thursday Cycle Dropdown */}
          <View style={styles.cycleDropdownWrap}>
            <Text style={styles.selectorLabel}>COLLECTION CYCLE</Text>
            <CycleDropdown
              cycles={cycleOptions}
              selectedCycle={selectedCycle}
              onSelectCycle={setSelectedCycle}
            />
          </View>
        </View>

        {/* Notifications & Error Feedback */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}
        {successToast && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>✓ {successToast}</Text>
          </View>
        )}

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
            disabled={loading || !statementData}
          />
        </View>

        {/* A4 Paper Statement Card Canvas */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.ink} />
            <Text style={styles.loadingText}>Loading Statement of Account preview...</Text>
          </View>
        ) : clients.length === 0 ? (
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
              <Text style={styles.gotoCollectionsBtnText}>Go to Weekly Collections →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <StatementPaperCard
            data={statementData}
            currentUser={{ name: 'Maria Santos', role: 'Administrator' }}
            liveDeduction={Number(deductionAmount) || 0}
            liveDeductionNote={deductionNote}
            liveCollectedBy={collectedBy}
          />
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
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
