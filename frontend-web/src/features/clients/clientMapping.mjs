export function mapClientRecord(c) {
  if (!c) return null;
  const id = c.clientId || c.id || 'CL-001';
  return {
    id,
    clientId: id,
    code: id,
    name: c.name,
    address: c.address,
    contactNumber: c.contactNumber,
    email: c.email,
    defaultRateType: c.defaultRateType || 'FLAT',
    ratePerKilo: c.ratePerKilo !== null && c.ratePerKilo !== undefined ? Number(c.ratePerKilo) : null,
    active: c.active !== undefined ? c.active : true,
    dateRegistered: c.dateRegistered,
    totalShipments: c.totalShipments !== undefined ? c.totalShipments : 0,
    totalParcels: c.totalParcels !== undefined ? c.totalParcels : 0,
    totalCharges: c.totalCharges !== undefined ? c.totalCharges : 0,
    totalPaid: c.totalPaid !== undefined ? c.totalPaid : 0,
    outstandingBalance: c.outstandingBalance !== undefined ? c.outstandingBalance : 0,
  };
}
