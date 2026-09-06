import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import MetricCard from '../components/common/MetricCard';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import DonutChart from '../components/common/DonutChart';
import BarChart from '../components/common/BarChart';
import ComparisonBars from '../components/common/ComparisonBars';
import ActivityRow from '../components/common/ActivityRow';
import CycleDropdown from '../features/collections/components/CycleDropdown';
import { getActiveCollectionCycles } from '../features/collections/services/collectionsApi';
import { getRecentThursdays } from '../features/collections/utils/collectionsUtils';
import { getDashboardSummary, subscribeRealtimeEvents } from '../features/shipments';
import { colors, fonts, spacing } from '../theme';

const FALLBACK_SUMMARY = {
  shipmentCount: 0,
  parcelCount: 0,
  todayShipmentCount: 0,
  todayDateFormatted: '—',
  unpaidTransactionCount: 0,
  forCollection: { amount: 0, day: 'Thu', clientCount: 0 },
  parcelUnitsByStatus: [
    { label: 'Registered', value: 0, color: '#2563EB' },
    { label: 'QR Generated', value: 0, color: '#0D9488' },
    { label: 'Loaded on Truck', value: 0, color: '#D97706' },
    { label: 'Outload / Arrive TNL', value: 0, color: '#16A34A' },
    { label: 'Loaded to Hauler', value: 0, color: '#7C3AED' },
  ],
  weeklyShipmentVolume: [
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 0 },
    { label: 'Wed', value: 0 },
    { label: 'Thu', value: 0 },
    { label: 'Fri', value: 0 },
    { label: 'Sat', value: 0 },
    { label: 'Sun', value: 0 },
  ],
  outstandingVsCollected: [
    { label: 'Outstanding', value: 0, color: '#DC2626' },
    { label: 'Collected', value: 0, color: '#16A34A' },
  ],
  recentActivity: [],
};

export default function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');

  // Fetch active cycles containing registered shipments
  useEffect(() => {
    let mounted = true;
    async function loadCycles() {
      const activeCycles = await getActiveCollectionCycles();
      if (!mounted) return;
      if (activeCycles.length > 0) {
        setCycles(activeCycles);
        setSelectedCycle((prev) => (prev && activeCycles.some((c) => c.isoDate === prev) ? prev : activeCycles[0].isoDate));
      } else {
        const fallback = getRecentThursdays(1);
        setCycles(fallback);
        setSelectedCycle(fallback[0]?.isoDate || '');
      }
    }
    loadCycles();
    return () => {
      mounted = false;
    };
  }, []);

  const load = useCallback(async (cycleDate) => {
    try {
      setLoading(true);
      const data = await getDashboardSummary(cycleDate);
      if (data) {
        setSummary(data);
      }
    } catch (err) {
      console.warn('Dashboard summary fetch failed, using fallback data.', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      load(selectedCycle);
    }
  }, [selectedCycle, load]);

  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (['STATUS_UPDATE', 'SHIPMENT_CREATED', 'PAYMENT_RECORDED', 'SOA_GENERATED'].includes(event.type)) {
        if (selectedCycle) {
          load(selectedCycle);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [selectedCycle, load]);

  const shipmentCount = summary.shipmentCount ?? 0;
  const parcelCount = summary.parcelCount ?? 0;
  const todayShipments = summary.todayShipmentCount ?? summary.registeredToday ?? 0;
  const todayDate = summary.todayDateFormatted || summary.registeredTodayDate || '—';
  const unpaidCount = summary.unpaidTransactionCount ?? summary.unpaidTransactions ?? 0;

  const forCollectionAmount = summary.forCollection?.amount ?? 0;
  const forCollectionClients = summary.forCollection?.clientCount ?? 0;
  const forCollectionDay = summary.forCollection?.day || 'THU';

  const statusSegments = summary.parcelUnitsByStatus || [];
  const weeklyVolume = summary.weeklyShipmentVolume || summary.weeklyRegistrations || [];
  const financialRows = summary.outstandingVsCollected || [];
  const recentActivities = summary.recentActivity || [];

  return (
    <AppShell shipmentCount={shipmentCount} parcelCount={parcelCount}>
      <PageHeader
        eyebrow="Operations Overview"
        title="Dashboard"
        right={
          <View style={styles.headerRightGroup}>
            {cycles.length > 0 ? (
              <CycleDropdown
                cycles={cycles}
                selectedCycle={selectedCycle}
                onSelectCycle={setSelectedCycle}
                minWidth={280}
              />
            ) : null}
            <Button
              label="+ Register Shipment"
              variant="primary"
              onPress={() => router.push('/register')}
            />
          </View>
        }
      />

      <View style={styles.metricsRow}>
        <MetricCard
          label="Shipments"
          value={shipmentCount}
          sublabel={`${parcelCount} parcel units`}
          onPress={() => router.push('/shipments')}
        />
        <MetricCard
          label="Today's Shipments"
          value={todayShipments}
          sublabel={todayDate}
        />
        <MetricCard
          label="Unpaid Transactions"
          value={unpaidCount}
          sublabel="shipments with balance"
          onPress={() => router.push('/payments')}
        />
        <MetricCard
          label={`For Collection · ${forCollectionDay}`}
          value={`₱${Number(forCollectionAmount).toLocaleString()}`}
          sublabel={`${forCollectionClients} clients`}
          emphasis
          onPress={() => router.push(selectedCycle ? `/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}` : '/weekly-collections')}
        />
      </View>

      <View style={styles.chartsRow}>
        <Card title="Parcel Units by Status" style={styles.chartCard}>
          <DonutChart segments={statusSegments} />
        </Card>
        <Card title="Weekly Shipment Volume" style={styles.chartCard}>
          <BarChart data={weeklyVolume} />
        </Card>
        <Card title="Outstanding vs Collected" style={styles.chartCard}>
          <ComparisonBars rows={financialRows} />
          <Button
            label="Prepare weekly collection →"
            variant="secondary"
            onPress={() => router.push(selectedCycle ? `/weekly-collections?cycle=${encodeURIComponent(selectedCycle)}` : '/weekly-collections')}
            style={styles.collectionBtn}
          />
        </Card>
      </View>

      <Card
        title="Recent Activity"
        right={
          <Text style={styles.viewAllLink} onPress={() => router.push('/tracking-logs')}>
            View all logs →
          </Text>
        }
      >
        {recentActivities.length > 0 ? (
          recentActivities.map((activity, idx) => (
            <ActivityRow
              key={`${activity.trackingId}-${idx}`}
              {...activity}
              isLast={idx === recentActivities.length - 1}
            />
          ))
        ) : (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyText}>No recent tracking scans logged yet.</Text>
          </View>
        )}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  chartsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  chartCard: {
    flex: 1,
    minWidth: 280,
  },
  collectionBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderColor: 'transparent',
    paddingHorizontal: 0,
  },
  viewAllLink: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accent,
  },
  emptyActivity: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
});
