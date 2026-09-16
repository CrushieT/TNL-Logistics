/**
 * Utility to export an array of tracking log entries to a CSV file in the browser.
 */
export function exportTrackingLogsToCsv(
  logs,
  filename = `tnl_tracking_logs_${new Date().toISOString().slice(0, 10)}.csv`
) {
  if (!logs || logs.length === 0) return;

  const headers = [
    'Event ID',
    'Timestamp',
    'Event',
    'Tracking ID',
    'Shipment ID',
    'Package',
    'Vehicle ID',
    'Vehicle Plate',
    'Staff Name',
    'Staff Username',
    'Staff Role',
    'Remarks',
  ];

  const escapeCell = (cell) => {
    if (cell == null) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map((log) => [
    log.eventId ?? '',
    log.formattedTimestamp || log.timestamp || '',
    log.statusDisplay || log.status || '',
    log.trackingId || '',
    log.shipmentId || '',
    log.packageDisplay || '',
    log.vehicleId || '',
    log.vehiclePlateNumber || '',
    log.staffName || '',
    log.staffUsername || '',
    log.staffRole || '',
    log.remarks || '',
  ]);

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\r\n');

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
