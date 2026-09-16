/**
 * Utility to download CSV data files for Reports.
 */

function downloadCsv(headers, rows, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const escapeCell = (cell) => {
    if (cell == null) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\r\n');

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

export function exportClientRevenueToCsv(rows, dateSuffix = '') {
  if (!rows || rows.length === 0) return;
  const headers = ['Client ID', 'Client Name', 'Total Shipments', 'Total Billed (PHP)', 'Total Paid (PHP)', 'Balance (PHP)', 'Payment Status'];
  const data = rows.map((r) => [
    r.clientId || '',
    r.clientName || '',
    r.totalShipments || 0,
    r.totalBilled != null ? Number(r.totalBilled).toFixed(2) : '0.00',
    r.totalPaid != null ? Number(r.totalPaid).toFixed(2) : '0.00',
    r.balance != null ? Number(r.balance).toFixed(2) : '0.00',
    r.paymentStatus || '',
  ]);
  downloadCsv(headers, data, `tnl-client-revenue-report${dateSuffix ? `-${dateSuffix}` : ''}.csv`);
}

export function exportDailyVolumeToCsv(rows, dateSuffix = '') {
  if (!rows || rows.length === 0) return;
  const headers = ['Date', 'Shipments Count', 'Parcels Count', 'Total Weight (kg)', 'Total Volume (cbm)', 'Completed Deliveries'];
  const data = rows.map((r) => [
    r.date || r.dateLabel || '',
    r.shipmentsCount || 0,
    r.parcelsCount || 0,
    r.totalWeightKg != null ? Number(r.totalWeightKg).toFixed(2) : '0.00',
    r.totalVolumeCbm != null ? Number(r.totalVolumeCbm).toFixed(4) : '0.0000',
    r.completedDeliveries || 0,
  ]);
  downloadCsv(headers, data, `tnl-daily-volume-report${dateSuffix ? `-${dateSuffix}` : ''}.csv`);
}

export function exportReceivablesAgingToCsv(rows, dateSuffix = '') {
  if (!rows || rows.length === 0) return;
  const headers = ['Client ID', 'Client Name', 'Contact', 'Unpaid Shipments', 'Current 0-7 Days (PHP)', 'Past Due 8-14 Days (PHP)', 'Overdue 15+ Days (PHP)', 'Total Outstanding (PHP)'];
  const data = rows.map((r) => [
    r.clientId || '',
    r.clientName || '',
    r.recipientContact || '',
    r.unpaidShipmentsCount || 0,
    r.currentDue != null ? Number(r.currentDue).toFixed(2) : '0.00',
    r.pastDue != null ? Number(r.pastDue).toFixed(2) : '0.00',
    r.overdue != null ? Number(r.overdue).toFixed(2) : '0.00',
    r.totalOutstanding != null ? Number(r.totalOutstanding).toFixed(2) : '0.00',
  ]);
  downloadCsv(headers, data, `tnl-ar-aging-report${dateSuffix ? `-${dateSuffix}` : ''}.csv`);
}
