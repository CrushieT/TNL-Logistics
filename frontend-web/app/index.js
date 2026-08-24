import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/common/AppShell';
import PageHeader from '../components/common/PageHeader';
import MetricCard from '../components/common/MetricCard';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import DonutChart from '../components/common/DonutChart';
import BarChart from '../components/common/BarChart';
import ComparisonBars from '../components/common/ComparisonBars';
import ActivityRow from '../components/common/ActivityRow';
import { getDashboardSummary } from '../api/shipments';
import { colors, fonts, spacing } from '../constants/theme';

// Fallback demo data so the screen renders meaningfully before the backend
// is wired up. Replace by wiring getDashboardSummary() to the real endpoint.
const FALLBACK_SUMMARY = {
  shipmentCount: 10,
  parcelCount: 13,
  registeredToday: 1,
  registeredTodayDate: 'Aug 7, 2026',
  unpaidTransactions: 8,
  forCollection: { amount: 4670, day: 'Thu', clientCount: 3 },
  parcelUnitsByStatus: [
    { label: 'Registered', value: 2, color: colors.info },
    { label: 'Loaded on Truck', value: 3, color: colors.warning },
    { label: 'Arrived at TNL', value: 8, color: colors.success },
  ],
  weeklyRegistrations: [
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 4 },
    { label: 'Thu', value: 3 },
    { label: 'Fri', value: 2 },
    { label: 'Sat', value: 0 },
    { label: 'Sun', value: 0 },
  ],
  outstandingVsCollected: [
    { label: 'Outstanding', value: 4670, color: colors.danger },
    { label: 'Collected', value: 1500, color: colors.success },
  ],
  recentActivity: [
    { date: 'Aug 7, 2026', time: '8:16 AM', action: 'QR Generated', trackingId: 'TRK-2026-000113', meta: 'Pkg 1/1 — by Andrea Lim' },
    { date: 'Aug 7, 2026', time: '8:15 AM', action: 'Registered', trackingId: 'TRK-2026-000113', meta: 'Pkg 1/1 — by Andrea Lim' },
    { date: 'Aug 6, 2026', time: '8:16 AM', action: 'QR Generated', trackingId: 'TRK-2026-000110', meta: 'Pkg 1/1 — by Andrea Lim' },
  ],
};

export default function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDashboardSummary();
      if (data) {
        setSummary(data);
      }
    } catch (err) {
      // Keep fallback data if the API isn't reachable yet.
      console.warn('Dashboard summary fetch failed, using fallback data.', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell shipmentCount={summary.shipmentCount} parcelCount={summary.parcelCount}>
      <PageHeader
        eyebrow="Operations Overview"
        title="Dashboard"
        action={<Button label="+ Register Shipment" variant="primary" onPress={() => router.push('/register')} />}
      />

      <View style={styles.metricsRow}>
        <MetricCard label="Shipments" value={summary.shipmentCount} sublabel={`${summary.parcelCount} parcel units`} />
        <MetricCard
          label="Registered Today"
          value={summary.registeredToday}
          sublabel={summary.registeredTodayDate}
        />
        <MetricCard
          label="Unpaid Transactions"
          value={summary.unpaidTransactions}
          sublabel="shipments with balance"
        />
        <MetricCard
          label={`For Collection · ${summary.forCollection?.day || ''}`}
          value={`₱${Number(summary.forCollection?.amount || 0).toLocaleString()}`}
          sublabel={`${summary.forCollection?.clientCount || 0} clients`}
          emphasis
        />
      </View>

      <View style={styles.chartsRow}>
        <Card title="Parcel Units by Status" style={styles.chartCard}>
          <DonutChart segments={summary.parcelUnitsByStatus} />
        </Card>
        <Card title="Weekly Registrations" style={styles.chartCard}>
          <BarChart data={summary.weeklyRegistrations} />
        </Card>
        <Card title="Outstanding vs Collected" style={styles.chartCard}>
          <ComparisonBars rows={summary.outstandingVsCollected} />
          <Button
            label="Prepare weekly collection →"
            variant="ghost"
            onPress={() => router.push('/weekly-collections')}
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
        {summary.recentActivity?.map((a, idx) => (
          <ActivityRow key={`${a.trackingId}-${idx}`} {...a} isLast={idx === summary.recentActivity.length - 1} />
        ))}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
    cursor: 'pointer',
  },
});
