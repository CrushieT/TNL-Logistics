import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, spacing, radius } from '../../theme';
import { getReportSummary, PrintableReportDocument } from '../../features/reports';
import { normalizeReportPrintParams } from '../../features/reports/utils/reportPrintModel.mjs';

export default function ReportPrintScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const printParams = useMemo(
    () => normalizeReportPrintParams(params),
    [params.startDate, params.endDate],
  );
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const hasAutoPrinted = useRef(false);

  useEffect(() => {
    let isMounted = true;

    if (!printParams.isValid) {
      setReportData(null);
      setErrorMessage(printParams.error);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    async function loadReport() {
      try {
        setLoading(true);
        setErrorMessage(null);
        const data = await getReportSummary({
          startDate: printParams.startDate,
          endDate: printParams.endDate,
        });
        if (isMounted) setReportData(data);
      } catch (error) {
        if (isMounted) {
          setReportData(null);
          setErrorMessage(
            error?.response?.data?.message
              || error?.message
              || 'Failed to load the printable report.',
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    hasAutoPrinted.current = false;
    loadReport();
    return () => {
      isMounted = false;
    };
  }, [printParams.endDate, printParams.error, printParams.isValid, printParams.startDate]);

  useEffect(() => {
    if (
      loading
      || !reportData
      || hasAutoPrinted.current
      || Platform.OS !== 'web'
      || typeof window === 'undefined'
    ) {
      return undefined;
    }

    hasAutoPrinted.current = true;
    let printTimer;
    let animationFrame;
    let isCancelled = false;

    const openPrintDialog = async () => {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (isCancelled) return;

      animationFrame = window.requestAnimationFrame(() => {
        printTimer = window.setTimeout(() => window.print(), 200);
      });
    };

    openPrintDialog();
    return () => {
      isCancelled = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (printTimer) window.clearTimeout(printTimer);
    };
  }, [loading, reportData]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !printParams.isValid) {
      return undefined;
    }

    const originalTitle = document.title;
    document.title = `TNL Logistics Report ${printParams.startDate} to ${printParams.endDate}`;
    return () => {
      document.title = originalTitle;
    };
  }, [printParams.endDate, printParams.isValid, printParams.startDate]);

  const handlePrintNow = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.print();
  };

  const handleBack = () => {
    router.replace('/reports');
  };

  return (
    <View nativeID="report-print-screen" style={styles.screen}>
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              @media print {
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                html, body, #root, #__next,
                #report-print-screen,
                #report-print-scroll,
                #report-print-canvas,
                #printable-report-document {
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                  background: #FFFFFF !important;
                }
                #report-print-toolbar,
                div[id="report-print-toolbar"],
                button,
                div[style*="position: fixed"] {
                  display: none !important;
                  visibility: hidden !important;
                }
                div[id^="report-print-page-"] {
                  width: 210mm !important;
                  height: 297mm !important;
                  min-height: 297mm !important;
                  max-height: 297mm !important;
                  box-sizing: border-box !important;
                  padding: 12mm 14mm !important;
                  margin: 0 !important;
                  border: 0 !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                  overflow: hidden !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid-page !important;
                  background: #FFFFFF !important;
                }
                div[id^="report-print-page-"]:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                #report-footer-signatures,
                div[id="report-footer-signatures"] {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `,
          }}
        />
      )}

      <View nativeID="report-print-toolbar" style={styles.toolbar}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
          <Text style={styles.secondaryButtonText}>Back to Reports</Text>
        </TouchableOpacity>

        <View style={styles.toolbarTitleArea}>
          <Text style={styles.toolbarTitle}>PRINTABLE CONSOLIDATION REPORT</Text>
          {printParams.isValid ? (
            <Text style={styles.toolbarSubtitle}>
              {printParams.startDate} to {printParams.endDate}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!reportData || loading) && styles.disabledButton]}
          onPress={handlePrintNow}
          disabled={!reportData || loading}
        >
          <Text style={styles.primaryButtonText}>Print / Save as PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        nativeID="report-print-scroll"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewport}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator
      >
        <View nativeID="report-print-canvas" style={styles.scrollContent}>
          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={colors.ink} />
              <Text style={styles.stateText}>Preparing printable report...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Unable to prepare report</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
                <Text style={styles.secondaryButtonText}>Return to Reports</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <PrintableReportDocument
              reportData={reportData}
              startDate={printParams.startDate}
              endDate={printParams.endDate}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#E5E5E2',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: '#111110',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2B29',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  toolbarTitleArea: {
    alignItems: 'center',
  },
  toolbarTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  toolbarSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: '#A8A6A1',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  primaryButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#111110',
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: '#2A2927',
  },
  secondaryButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.45,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewport: {
    alignItems: 'center',
  },
  scrollContent: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  centeredState: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  stateText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 12,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    marginTop: 60,
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  errorTitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 18,
  },
});
