import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
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
import { useRequestCoordinator } from '../services/api/useRequestCoordinator';
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

  const { coordinator, setResumeFetcher } = useRequestCoordinator({
    scope: 'reports',
    onSuccess: (data, meta) => {
      setReportData(data);
      setErrorMessage(null);
      if (!meta.isSilent) setLoading(false);
      setIsLiveUpdating(false);
    },
    onError: (err, meta) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load report data';
      setErrorMessage(msg);
      if (!meta.isSilent) setLoading(false);
      setIsLiveUpdating(false);
    },
    debounceMs: 300,
  });

  const loadReport = useCallback((start, end, showSpinner = true, debounce = false) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setIsLiveUpdating(true);
    }
    const key = coordinator.deriveKey({ startDate: start, endDate: end });
    const fetcher = (signal) => getReportSummary({ startDate: start, endDate: end }, { signal });
    setResumeFetcher(() => fetcher);
    return coordinator.request(key, fetcher, { isSilent: !showSpinner, debounce });
  }, [coordinator, setResumeFetcher]);

  // Initial load and filter change (cancels previous query if dates change)
  useEffect(() => {
    loadReport(startDate, endDate, true, false);
  }, [startDate, endDate, loadReport]);

  // Real-Time SSE Auto-Sync with 300ms burst debounce and queued coalescing
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (
        ['PARCEL_EXCEPTION', 'WAYBILL_UPDATE', 'STATUS_UPDATE', 'SHIPMENT_CREATED', 'PAYMENT_RECORDED', 'SOA_GENERATED', 'SOA_UPDATED'].includes(event.type)
      ) {
        loadReport(startDate, endDate, false, true);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [startDate, endDate, loadReport]);

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
      <View style={styles.container}>
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
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
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
