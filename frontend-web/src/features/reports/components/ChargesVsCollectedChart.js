import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';

/**
 * Grouped dual-bar chart matching prototype report page.png:
 * "CHARGES VS COLLECTED BY CLIENT"
 */
export default function ChargesVsCollectedChart({ clientRevenue = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Take top clients (up to 6) to keep the chart clean and punchy like the prototype
  const displayClients = (clientRevenue || []).slice(0, 6);

  // Compute maximum amount to scale Y-axis ticks nicely
  const maxVal = Math.max(
    ...displayClients.map((c) => Math.max(Number(c.totalBilled || 0), Number(c.totalPaid || 0))),
    1000
  );

  // Round maxVal up to a clean round number
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const normalized = maxVal / magnitude;
  let niceMax;
  if (normalized <= 1.2) niceMax = 1.2 * magnitude;
  else if (normalized <= 2) niceMax = 2 * magnitude;
  else if (normalized <= 4) niceMax = 4 * magnitude;
  else if (normalized <= 6) niceMax = 6 * magnitude;
  else niceMax = 10 * magnitude;

  // 4 interval ticks: 0, 25%, 50%, 75%, 100%
  const ticks = [
    niceMax,
    niceMax * 0.75,
    niceMax * 0.5,
    niceMax * 0.25,
    0,
  ];

  const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.card}>
      {/* Chart Title and Legend */}
      <View style={styles.headerRow}>
        <Text style={styles.chartTitle}>CHARGES VS COLLECTED BY CLIENT</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#111827' }]} />
            <Text style={styles.legendLabel}>Charges</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#16A34A' }]} />
            <Text style={styles.legendLabel}>Collected</Text>
          </View>
        </View>
      </View>

      {/* Chart Canvas Area */}
      <View style={styles.chartArea}>
        {/* Y-Axis Labels and Horizontal Grid Lines */}
        <View style={styles.gridOverlay}>
          {ticks.map((val, idx) => (
            <View key={idx} style={styles.gridLineRow}>
              <Text style={styles.yAxisLabel}>{Math.round(val).toLocaleString()}</Text>
              <View style={[styles.gridLine, val === 0 ? styles.baseLine : null]} />
            </View>
          ))}
        </View>

        {/* Bars Container */}
        <View style={styles.barsContainer}>
          {displayClients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No client revenue activity in this period</Text>
            </View>
          ) : (
            displayClients.map((client, idx) => {
              const billedVal = Number(client.totalBilled || 0);
              const paidVal = Number(client.totalPaid || 0);

              const billedHeightPct = Math.min(100, Math.max(2, (billedVal / niceMax) * 100));
              const paidHeightPct = Math.min(100, Math.max(paidVal > 0 ? 2 : 0, (paidVal / niceMax) * 100));

              const isHovered = hoveredIndex === idx;

              // Truncate client name for X-axis label (e.g. "Sunrise Hardware" -> "Sunrise")
              const shortName = (client.clientName || 'Client').split(' ')[0];

              return (
                <View
                  key={client.clientId || idx}
                  style={styles.clientGroup}
                  // @ts-ignore
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipTitle}>{client.clientName}</Text>
                      <Text style={styles.tooltipText}>Charges: {formatCurrency(billedVal)}</Text>
                      <Text style={[styles.tooltipText, { color: '#22C55E' }]}>
                        Collected: {formatCurrency(paidVal)}
                      </Text>
                    </View>
                  )}

                  {/* Dual Bars Pair */}
                  <View style={styles.barPair}>
                    {/* Billed (Charges) Bar - Dark */}
                    <View style={styles.barSlot}>
                      <View style={[styles.bar, styles.billedBar, { height: `${billedHeightPct}%` }]} />
                    </View>

                    {/* Collected Bar - Green */}
                    <View style={styles.barSlot}>
                      <View style={[styles.bar, styles.paidBar, { height: `${paidHeightPct}%` }]} />
                    </View>
                  </View>

                  {/* Client Name Label */}
                  <Text style={styles.xAxisLabel} numberOfLines={1}>
                    {shortName}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  chartTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  chartArea: {
    height: 240,
    position: 'relative',
    marginTop: 8,
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  yAxisLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
    width: 46,
    textAlign: 'right',
    paddingRight: 8,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  baseLine: {
    backgroundColor: '#BDBDBD',
    height: 1.5,
  },
  barsContainer: {
    position: 'absolute',
    left: 50,
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  clientGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingBottom: 4,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: 216,
    width: '100%',
  },
  barSlot: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: 24,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  billedBar: {
    backgroundColor: '#111827',
  },
  paidBar: {
    backgroundColor: '#16A34A',
  },
  xAxisLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    zIndex: 10,
    minWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  tooltipTitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  tooltipText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: '#D1D5DB',
  },
  emptyContainer: {
    flex: 1,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
});
