import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, spacing, radius } from '../../theme';
import { getStatementPreview } from '../../features/collections/services/collectionsApi';
import StatementPaperCard from '../../features/collections/components/StatementPaperCard';

export default function StatementPrintScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const clientId = params.clientId || '';
  const cycle = params.cycle || '';
  const liveDeduction = params.deduction ? Number(params.deduction) : 0;
  const liveDeductionNote = params.note || '';
  const liveCollectedBy = params.collector || '';

  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!clientId) {
        setErrorMessage('Missing client identifier for statement printable sheet.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getStatementPreview(clientId, cycle || null);
        if (isMounted) {
          setStatementData(data);
          setErrorMessage(null);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to load statement details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [clientId, cycle]);

  // Trigger browser print once data is loaded and rendered
  useEffect(() => {
    if (!loading && statementData && Platform.OS === 'web' && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, statementData]);

  const handlePrintNow = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleBack = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/statements');
    }
  };

  return (
    <View nativeID="print-screen-root" style={styles.screenContainer}>
      {/* High-Specificity Print Stylesheet: Guaranteed Zero Toolbar or Overflow Leakage */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @page {
                size: A4 portrait;
                margin: 0 !important; /* Suppresses browser headers/footers (timestamp, title, URL) */
              }
              @media print {
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                /* 1. Hide the top toolbar, buttons, and Expo dev overlays */
                #print-toolbar,
                div[id="print-toolbar"],
                button,
                div[style*="position: fixed"],
                div[class*="toast"],
                div[class*="banner"],
                div[id*="toast"],
                div[id*="banner"] {
                  display: none !important;
                  visibility: hidden !important;
                }

                /* 2. Unconstrain all containers so browser can paginate across multiple A4 pages */
                html, body, #root, #__next,
                #print-screen-root,
                #print-scroll-container,
                div[style*="overflow"],
                div[class*="r-overflow"],
                div[class*="r-flex"] {
                  overflow: visible !important;
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  background-color: #FFFFFF !important;
                  background: #FFFFFF !important;
                }

                /* 3. Strip outer wrapper padding and margins */
                #print-canvas-wrap,
                div[id="print-canvas-wrap"] {
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                }

                /* 4. Format each sheet with internal margins, stripping borders/shadows */
                div[id^="soa-printable-sheet-"] {
                  box-shadow: none !important;
                  border: none !important;
                  margin: 0 auto !important;
                  padding: 12mm 14mm 12mm 14mm !important;
                  box-sizing: border-box !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  background-color: #FFFFFF !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }

                div[id^="soa-printable-sheet-"]:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
              }
            `,
          }}
        />
      )}

      {/* Floating Action Bar (Hidden during Print via nativeID) */}
      <View nativeID="print-toolbar" style={styles.topToolbar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>← Back to Statements</Text>
        </TouchableOpacity>

        <View style={styles.toolbarCenter}>
          <Text style={styles.toolbarTitle}>
            PRINTABLE STATEMENT OF ACCOUNT
          </Text>
          {statementData ? (
            <Text style={styles.toolbarSubtext}>
              {statementData.clientName} · {statementData.cycleRangeLabel || 'Current Cycle'}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.printBtn} onPress={handlePrintNow}>
          <Text style={styles.printBtnText}>Print / Save as PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Main Canvas */}
      <ScrollView
        nativeID="print-scroll-container"
        contentContainerStyle={styles.canvasScroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color={colors.ink} />
            <Text style={styles.loadingText}>Preparing printable statement...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleBack}>
              <Text style={styles.retryBtnText}>Return to Statements</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View nativeID="print-canvas-wrap" style={styles.paperWrap}>
            <StatementPaperCard
              data={statementData}
              liveDeduction={liveDeduction}
              liveDeductionNote={liveDeductionNote}
              liveCollectedBy={liveCollectedBy}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#EEEDE8',
    minHeight: '100vh',
  },
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111110',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2B29',
    gap: spacing.md,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: '#262523',
  },
  backBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#F4F4F0',
  },
  toolbarCenter: {
    alignItems: 'center',
  },
  toolbarTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  toolbarSubtext: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#A8A6A1',
    marginTop: 2,
  },
  printBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  printBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#111110',
  },
  canvasScroll: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  paperWrap: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  centeredBox: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 12,
  },
  errorBox: {
    padding: spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: 60,
    maxWidth: 400,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#111110',
    borderRadius: radius.sm,
  },
  retryBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
