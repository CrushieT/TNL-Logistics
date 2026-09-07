import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, ActivityIndicator } from 'react-native';
import AppShell from '../components/layout/AppShell';
import {
  getReportSummary,
  ReportsHeader,
  ReportsKpiBar,
  ChargesVsCollectedChart,
  CollectionCycleSummaryCard,
  ReportsTabNav,
  FinancialRevenueTab,
  OperationalVolumeTab,
  ReceivablesAgingTab,
  PrintableReportModal,
} from '../features/reports';
import { subscribeRealtimeEvents } from '../features/shipments';
import { colors, fonts } from '../theme';

export default function ReportsScreen() {
  const formatDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDates = (presetId) => {
    const today = new Date();
    const endStr = formatDateString(today);

    switch (presetId) {
      case 'TODAY':
        return { start: endStr, end: endStr };
      case 'THIS_WEEK': {
        const dayOfWeek = today.getDay(); // 0 is Sunday
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - distanceToMonday);
        return { start: formatDateString(monday), end: endStr };
      }
      case 'THIS_MONTH': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: formatDateString(firstDay), end: endStr };
      }
      case 'LAST_30_DAYS': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return { start: formatDateString(thirtyDaysAgo), end: endStr };
      }
      default:
        return null;
    }
  };

  const initialPreset = 'THIS_MONTH';
  const initialDates = getPresetDates(initialPreset);

  const [activePreset, setActivePreset] = useState(initialPreset);
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [activeTab, setActiveTab] = useState('FINANCIAL');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiveUpdating, setIsLiveUpdating] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const debounceTimer = useRef(null);

  const fetchReportData = useCallback(async (start, end, showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      } else {
        setIsLiveUpdating(true);
      }
      setErrorMessage(null);

      const data = await getReportSummary({ startDate: start, endDate: end });
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report summary:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to load report data');
    } finally {
      if (showSpinner) setLoading(false);
      setIsLiveUpdating(false);
    }
  }, []);

  // Initial load and filter change
  useEffect(() => {
    fetchReportData(startDate, endDate, true);
  }, [startDate, endDate, fetchReportData]);

  // Real-Time SSE Auto-Sync with 300ms Debounce and Window Focus Sync
  useEffect(() => {
    const handleSilentSync = () => {
      fetchReportData(startDate, endDate, false);
    };

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (
        ['STATUS_UPDATE', 'SHIPMENT_CREATED', 'PAYMENT_RECORDED', 'SOA_GENERATED'].includes(event.type)
      ) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          handleSilentSync();
        }, 300);
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentSync);
    }

    return () => {
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentSync);
      }
    };
  }, [startDate, endDate, fetchReportData]);

  const handleSelectPreset = (presetId) => {
    setActivePreset(presetId);
    if (presetId !== 'CUSTOM') {
      const dates = getPresetDates(presetId);
      if (dates) {
        setStartDate(dates.start);
        setEndDate(dates.end);
      }
    }
  };

  const handleCustomStartDateChange = (val) => {
    setActivePreset('CUSTOM');
    setStartDate(val);
  };

  const handleCustomEndDateChange = (val) => {
    setActivePreset('CUSTOM');
    setEndDate(val);
  };

  const dateRangeStr = `${startDate}_to_${endDate}`;

  return (
    <AppShell activeNav="Reports">
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Toolbar */}
        <ReportsHeader
          activePreset={activePreset}
          onSelectPreset={handleSelectPreset}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleCustomStartDateChange}
          onEndDateChange={handleCustomEndDateChange}
          onPrintPress={() => setIsPrintModalOpen(true)}
          isLiveUpdating={isLiveUpdating}
        />

        {/* Error Notification Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Error: {errorMessage}</Text>
          </View>
        )}

        {/* Top 5 KPI Summary Ribbon */}
        <ReportsKpiBar kpis={reportData?.kpis} loading={loading} />

        {/* Prototype Hero Row: Charges vs Collected Chart & Thursday Collections Summary Card */}
        <View style={styles.heroRow}>
          <ChargesVsCollectedChart clientRevenue={reportData?.clientRevenue} />
          <CollectionCycleSummaryCard collectionSummary={reportData?.collectionSummary} />
        </View>

        {/* Detailed Domain Tab Navigation */}
        <ReportsTabNav activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Tab Content Display */}
        {loading && !reportData ? (
          <View style={styles.loaderArea}>
            <ActivityIndicator size="large" color={colors.ink} />
            <Text style={styles.loaderText}>Generating report aggregates...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'FINANCIAL' && (
              <FinancialRevenueTab
                clientRevenue={reportData?.clientRevenue}
                paymentMethods={reportData?.paymentMethods}
                deductions={reportData?.deductions}
                dateRangeStr={dateRangeStr}
              />
            )}

            {activeTab === 'OPERATIONAL' && (
              <OperationalVolumeTab
                dailyVolume={reportData?.dailyVolume}
                statusDistribution={reportData?.statusDistribution}
                dateRangeStr={dateRangeStr}
              />
            )}

            {activeTab === 'AGING' && (
              <ReceivablesAgingTab
                receivablesAging={reportData?.receivablesAging}
                dateRangeStr={dateRangeStr}
              />
            )}
          </>
        )}

        {/* A4 Printable Document View Modal */}
        <PrintableReportModal
          visible={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          reportData={reportData}
          startDate={startDate}
          endDate={endDate}
        />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 64,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  errorBanner: {
    backgroundColor: '#FDE8E8',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#9B1C1C',
    fontWeight: '600',
  },
  loaderArea: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
});
