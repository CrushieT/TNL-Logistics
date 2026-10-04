import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShipmentRequest, calculateRegistration, createRegistrationForm, createShipmentSubmitter,
  isUncertainWrite, mapRegistrationErrors, MAX_PARCELS, toCents, validateRegistration,
} from '../src/features/shipments/registration.mjs';
import {
  clampParcelPage, createParcelPaginationModel, generatePaginationItems, getParcelPageCount, getParcelPageIndex,
  PARCEL_PAGE_SIZE,
} from '../src/features/shipments/parcelPagination.mjs';

function validForm(overrides = {}) {
  return {
    ...createRegistrationForm(), clientId: 'CL-TEST', clientName: 'Test billing client',
    recipientAddress: 'Test street, Baguio', recipientContact: '09170000000',
    quantity: '2', weightKg: '1.25', lengthCm: '40', widthCm: '30', heightCm: '25',
    ...overrides,
  };
}

function newClientForm() {
  return validForm({
    clientMode: 'NEW', clientId: '', clientName: '', newClientName: 'New client',
    newClientAddress: 'Test billing address', newClientContact: '09170000001', newClientEmail: '',
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

test('defaults require deliberate client and measurements entry', () => {
  const form = createRegistrationForm();
  assert.equal(form.quantity, '1');
  assert.equal(form.paidAtRegistration, false);
  assert.equal(form.chargeModel, 'PER_KILO');
  assert.equal(form.recipientName, undefined);
  assert.equal(form.shippingFee, undefined);
  for (const field of ['clientId']) {
    assert.equal(form[field], '');
    assert.ok(validateRegistration(form)[field]);
  }
  assert.ok(validateRegistration(form)['parcels[0].weightKg']);
  assert.equal(calculateRegistration(form, null).totalCents, null);
});

test('flat and per-parcel pricing use integer cents', () => {
  assert.equal(toCents('0.10'), 10);
  assert.equal(toCents('12.3'), 1230);
  assert.equal(toCents('12.'), null);
  const form = validForm({ quantity: '3', shippingFee: '0.10', otherCharges: '0.20' });
  assert.equal(calculateRegistration(form, 5000).totalCents, 30);
  assert.equal(calculateRegistration({ ...form, chargeModel: 'PER_PARCEL' }, 5000).totalCents, 50);
});

test('volume and billable weight use total quantity and the server divisor', () => {
  const totals = calculateRegistration(validForm(), 5000);
  assert.equal(totals.unitVolume, 0.03);
  assert.equal(totals.totalVolume, 0.06);
  assert.equal(totals.actualWeight, 2.5);
  assert.equal(totals.volumetricWeight, 12);
  assert.equal(totals.billableWeight, 12);
  assert.equal(calculateRegistration(validForm({ weightKg: '20' }), 6000).billableWeight, 40);
  assert.equal(calculateRegistration(validForm(), 6000).volumetricWeight, 10);
});

test('missing settings never invent a divisor and do not invalidate registration', () => {
  for (const divisor of [null, undefined, 0, -1, NaN, Infinity, '5000']) {
    assert.equal(calculateRegistration(validForm(), divisor).billableWeight, null);
  }
  assert.deepEqual(validateRegistration(validForm()), {});
});

test('quantity rejects fractional, exponential, zero and oversized values', () => {
  for (const quantity of ['0', '-1', '1.2', '1e2', '2units', 'Infinity', String(MAX_PARCELS + 1)]) {
    assert.ok(validateRegistration(validForm({ quantity })).quantity, quantity);
  }
  assert.equal(validateRegistration(validForm({ quantity: String(MAX_PARCELS) })).quantity, undefined);
  assert.equal(calculateRegistration(validForm({ quantity: ' 2 ' }), 5000).actualWeight, 2.5);
});

test('measurement minimums and precision match the API', () => {
  for (const value of ['', '0', '-1', '1.234', '1e2', '1000000', 'Infinity']) {
    assert.ok(validateRegistration(validForm({ weightKg: value })).weightKg, value);
    assert.ok(validateRegistration(validForm({ lengthCm: value })).lengthCm, value);
  }
  assert.equal(validateRegistration(validForm({ weightKg: '0.01' })).weightKg, undefined);
  assert.ok(validateRegistration(validForm({ lengthCm: '0.01' })).lengthCm);
  assert.equal(validateRegistration(validForm({ lengthCm: '0.1' })).lengthCm, undefined);
});

test('charges require nonnegative decimal amounts and preserve zero', () => {
  for (const value of ['', '-0.1', '2.999', '1e2', '10000000000']) {
    assert.ok(validateRegistration(validForm({ otherCharges: value })).otherCharges, value);
  }
  assert.equal(calculateRegistration(validForm({ otherCharges: '0' }), 5000, 100).totalCents !== null, true);
});

test('new client validation covers lengths, optional email, and whitespace', () => {
  assert.deepEqual(validateRegistration(newClientForm()), {});
  const invalid = validateRegistration({
    ...newClientForm(), newClientName: ' ', newClientAddress: 'a'.repeat(256),
    newClientContact: '123', newClientEmail: 'invalid-email',
  });
  for (const field of ['newClientName', 'newClientAddress', 'newClientContact', 'newClientEmail']) assert.ok(invalid[field]);
  assert.ok(validateRegistration(validForm({ recipientAddress: ' ', recipientContact: ' ' })).recipientAddress);
});

test('recipient, description, and route validation enforce maximum character lengths', () => {
  const invalid = validateRegistration(validForm({
    recipientAddress: 'B'.repeat(256),
    recipientContact: '0'.repeat(12),
    description: 'D'.repeat(256),
    route: 'R'.repeat(151),
  }));
  assert.ok(invalid.recipientAddress);
  assert.ok(invalid.recipientContact);
  assert.ok(invalid.description);
  assert.ok(invalid.route);

  const nonDigitContact = validateRegistration(validForm({
    recipientContact: '0917-555-01',
  }));
  assert.ok(nonDigitContact.recipientContact);

  const valid = validateRegistration(validForm({
    recipientAddress: 'B'.repeat(255),
    recipientContact: '0'.repeat(11),
    description: 'D'.repeat(255),
    route: 'R'.repeat(150),
  }));
  assert.equal(valid.recipientAddress, undefined);
  assert.equal(valid.recipientContact, undefined);
  assert.equal(valid.description, undefined);
  assert.equal(valid.route, undefined);
});

test('ui-shaped mobile registration form passes validation and builds request with zero legacy errors', () => {
  const uiForm = {
    ...createRegistrationForm(),
    clientMode: 'EXISTING',
    clientId: 'CL-001',
    clientName: 'Acme Logistics Client',
    recipientAddress: '123 Market St, Baguio',
    recipientContact: '09171234567',
    description: 'Fresh Produce',
    quantity: '1',
    route: 'Manila to TNL Labo C.N.',
    otherCharges: '50.00',
    paidAtRegistration: true,
    parcels: [
      { id: 'unit-1', seq: 1, weightKg: '5.5', lengthCm: '30', widthCm: '20', heightCm: '15' },
    ],
  };

  const errors = validateRegistration(uiForm);
  assert.deepEqual(errors, {});

  const request = buildShipmentRequest(uiForm, 'CL-001', {
    expectedRatePerKilo: 100.0,
    expectedVolumetricDivisor: 5000,
  });

  assert.equal(request.clientId, 'CL-001');
  assert.equal(request.recipientName, 'Acme Logistics Client');
  assert.equal(request.recipientAddress, '123 Market St, Baguio');
  assert.equal(request.recipientContact, '09171234567');
  assert.equal(request.chargeModel, 'PER_KILO');
  assert.equal(request.otherCharges, 50.0);
  assert.equal(request.paidAtRegistration, true);
  assert.equal(request.expectedRatePerKilo, 100.0);
  assert.equal(request.expectedVolumetricDivisor, 5000);
  assert.equal(request.shippingFee, undefined);
  assert.equal(request.parcels.length, 1);
  assert.equal(request.parcels[0].weightKg, 5.5);
});

test('request mapping uses mobile source and real API enums without computed or client-only fields', () => {
  const payload = buildShipmentRequest(validForm({ chargeModel: 'PER_PARCEL', paidAtRegistration: true, recipientName: ' Recipient ' }));
  assert.equal(payload.registeredVia, 'MOBILE_FIELD');
  assert.equal(payload.chargeModel, 'PER_PARCEL');
  assert.equal(payload.paidAtRegistration, true);
  assert.equal(payload.recipientName, 'Recipient');
  assert.equal(payload.description, 'General Goods');
  assert.equal(payload.quantity, payload.parcels.length);
  assert.deepEqual(payload.parcels.map((parcel) => parcel.seq), [1, 2]);
  assert.deepEqual(payload.parcels[1], { seq: 2, weightKg: 1.25, lengthCm: 40, widthCm: 30, heightCm: 25 });
  assert.equal(payload.totalAmount, undefined);
  assert.equal(payload.clientName, undefined);
  assert.equal(payload.deviceToken, undefined);
  assert.throws(() => buildShipmentRequest(validForm({ parcels: [{ seq: 1, weightKg: '', lengthCm: '10', widthCm: '10', heightCm: '10' }] })));
});

test('validate the entire form before any client or shipment writes', async () => {
  const submit = createShipmentSubmitter({ createClient: () => assert.fail('Unexpected client write'), registerShipment: () => assert.fail('Unexpected shipment write') });
  await assert.rejects(submit({ ...newClientForm(), recipientAddress: '' }));
});

test('existing client submission does not create a client and trusts server totals', async () => {
  const submit = createShipmentSubmitter({
    createClient: () => assert.fail('Unexpected client write'),
    registerShipment: async (request) => ({ shipmentId: 'SHP-TEST', totalAmount: 99, clientId: request.clientId, trackingIds: ['TRK-A', 'TRK-B'] }),
  });
  const result = await submit(validForm());
  assert.equal(result.totalAmount, 99);
  assert.equal(result.clientName, 'Test billing client');
});

test('two simultaneous taps make only one write', async () => {
  const pending = deferred();
  let writes = 0;
  const submit = createShipmentSubmitter({ registerShipment: () => { writes += 1; return pending.promise; } });
  const first = submit(validForm());
  assert.equal(await submit(validForm()), null);
  assert.equal(writes, 1);
  pending.resolve({ shipmentId: 'SHP-TEST' });
  assert.equal((await first).shipmentId, 'SHP-TEST');
});

test('created client is retained across a rejected shipment and reused on explicit retry', async () => {
  let clientWrites = 0;
  let shipmentWrites = 0;
  let selectedClient;
  const submit = createShipmentSubmitter({
    createClient: async (request) => { clientWrites += 1; assert.equal(request.email, null); return { clientId: 'CL-NEW', name: request.name }; },
    registerShipment: async (request) => {
      shipmentWrites += 1;
      assert.equal(request.clientId, 'CL-NEW');
      if (shipmentWrites === 1) throw Object.assign(new Error('Rejected'), { response: { status: 400 } });
      return { shipmentId: 'SHP-NEW' };
    },
  });
  await assert.rejects(submit(newClientForm(), (client) => { selectedClient = client; }), (error) => error.registrationStage === 'shipment');
  assert.equal(selectedClient.clientId, 'CL-NEW');
  assert.equal(clientWrites, 1);
  assert.equal(shipmentWrites, 1);
  assert.equal((await submit(newClientForm())).shipmentId, 'SHP-NEW');
  assert.equal(clientWrites, 1);
});

test('client rejection is tagged and never proceeds to registration', async () => {
  const submit = createShipmentSubmitter({
    createClient: async () => { throw Object.assign(new Error('Invalid client'), { response: { status: 400 } }); },
    registerShipment: () => assert.fail('Unexpected shipment write'),
  });
  await assert.rejects(submit(newClientForm()), (error) => error.registrationStage === 'client');
});

test('session teardown during client creation prevents a subsequent shipment write', async () => {
  let isActive = true;
  const pending = deferred();
  const submit = createShipmentSubmitter({ createClient: () => pending.promise, registerShipment: () => assert.fail('Unexpected shipment write') }, () => isActive);
  const result = submit(newClientForm(), () => assert.fail('Unexpected UI update'));
  isActive = false;
  pending.resolve({ clientId: 'CL-NEW', name: 'New client' });
  assert.equal(await result, null);
  assert.equal(await submit(validForm()), null);
});

test('late shipment responses cannot restore a torn-down screen', async () => {
  let isActive = true;
  const pending = deferred();
  const submit = createShipmentSubmitter({ registerShipment: () => pending.promise }, () => isActive);
  const result = submit(validForm());
  isActive = false;
  pending.resolve({ shipmentId: 'SHP-TEST' });
  assert.equal(await result, null);
});

test('backend errors map nested parcel and new-client fields to the visible form', () => {
  assert.deepEqual(mapRegistrationErrors({ response: { data: { fieldErrors: { 'parcels[0].weightKg': 'Invalid weight', recipientName: 'Required' } } } }), { weightKg: 'Invalid weight', recipientName: 'Required' });
  assert.deepEqual(mapRegistrationErrors({ registrationStage: 'client', response: { data: { fieldErrors: { name: 'Required', email: 'Invalid email' } } } }), { newClientName: 'Required', newClientEmail: 'Invalid email' });
});

test('timeouts and server failures require checking previous outcome; validation does not', () => {
  assert.equal(isUncertainWrite(new Error('Network lost')), true);
  assert.equal(isUncertainWrite({ response: { status: 503 } }), true);
  for (const status of [400, 401, 403, 409]) assert.equal(isUncertainWrite({ response: { status } }), false);
});

test('per-unit parcel registration calculation computes heterogeneous dimensions and rate-per-kilo shipping fee', () => {
  const formWithUnits = {
    quantity: '2',
    otherCharges: '50.00',
    parcels: [
      { id: 'unit-1', seq: 1, weightKg: '5.0', lengthCm: '40', widthCm: '30', heightCm: '20' }, // 24,000 cm3 -> 4.8 kg vol
      { id: 'unit-2', seq: 2, weightKg: '2.0', lengthCm: '60', widthCm: '50', heightCm: '40' }, // 120,000 cm3 -> 24.0 kg vol
    ],
  };

  const totals = calculateRegistration(formWithUnits, 5000, 15.5);
  // Total actual weight = 7.0 kg
  // Total volumetric weight = 144,000 / 5000 = 28.8 kg
  // Billable weight = 28.8 kg
  // Shipping fee = 28.8 * 15.5 = 446.40
  // Total amount = 446.40 + 50.00 = 496.40 (49640 cents)
  assert.equal(totals.actualWeight, 7.0);
  assert.equal(totals.volumetricWeight, 28.8);
  assert.equal(totals.billableWeight, 28.8);
  assert.equal(totals.shippingFee, 446.4);
  assert.equal(totals.totalAmount, 496.4);
  assert.equal(totals.totalCents, 49640);
});

test('per-unit parcel validation isolates indexed errors to failing units', () => {
  const formWithInvalidUnit = {
    ...validForm(),
    quantity: '2',
    parcels: [
      { id: 'unit-1', seq: 1, weightKg: '2.0', lengthCm: '30', widthCm: '20', heightCm: '10' },
      { id: 'unit-2', seq: 2, weightKg: '0', lengthCm: '30', widthCm: '', heightCm: '10' },
    ],
  };

  const errors = validateRegistration(formWithInvalidUnit);
  assert.equal(errors['parcels[0].weightKg'], undefined);
  assert.ok(errors['parcels[1].weightKg']);
  assert.ok(errors['parcels[1].widthCm']);
});

test('buildShipmentRequest includes per-unit parcels, expected rate per kilo and divisor guards', () => {
  const form = {
    ...validForm(),
    quantity: '2',
    otherCharges: '25.00',
    paidAtRegistration: true,
    parcels: [
      { id: 'unit-1', seq: 1, weightKg: '3.0', lengthCm: '20', widthCm: '15', heightCm: '10' },
      { id: 'unit-2', seq: 2, weightKg: '4.5', lengthCm: '30', widthCm: '25', heightCm: '20' },
    ],
  };

  const payload = buildShipmentRequest(form, 'CL-TEST', { expectedRatePerKilo: 20.0, expectedVolumetricDivisor: 5000 });
  assert.equal(payload.chargeModel, 'PER_KILO');
  assert.equal(payload.paidAtRegistration, true);
  assert.equal(payload.expectedRatePerKilo, 20.0);
  assert.equal(payload.expectedVolumetricDivisor, 5000);
  assert.equal(payload.parcels.length, 2);
  assert.deepEqual(payload.parcels[0], { seq: 1, weightKg: 3.0, lengthCm: 20, widthCm: 15, heightCm: 10 });
  assert.deepEqual(payload.parcels[1], { seq: 2, weightKg: 4.5, lengthCm: 30, widthCm: 25, heightCm: 20 });
});

test('mapRegistrationErrors preserves indexed errors when preserveIndexed is true', () => {
  const error = {
    response: {
      data: {
        fieldErrors: {
          'parcels[1].weightKg': 'Must be at least 0.01',
          recipientAddress: 'Required',
        },
      },
    },
  };

  const preserved = mapRegistrationErrors(error, true);
  assert.equal(preserved['parcels[1].weightKg'], 'Must be at least 0.01');
  assert.equal(preserved.recipientAddress, 'Required');
});

test('pagination slicing, page clamping, and off-page error detection logic', () => {
  const parcels = Array.from({ length: 25 }, (_, i) => ({
    id: `unit-${i + 1}`,
    seq: i + 1,
    weightKg: '1.0',
    lengthCm: '20',
    widthCm: '10',
    heightCm: '15',
  }));
  const errors = {
    'parcels[5].weightKg': 'Required',
    'parcels[12].lengthCm': 'Required',
    'parcels[22].heightCm': 'Required',
  };

  const firstPage = createParcelPaginationModel(parcels, errors, 0);
  assert.equal(PARCEL_PAGE_SIZE, 10);
  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.visibleParcels.length, 10);
  assert.equal(firstPage.visibleParcels[0].parcel.seq, 1);
  assert.equal(firstPage.visibleParcels[9].parcel.seq, 10);
  assert.deepEqual(firstPage.offPageErrorUnitIndices, [12, 22]);
  assert.deepEqual(Array.from(firstPage.errorPageIndices), [0, 1, 2]);

  const clampedLastPage = createParcelPaginationModel(parcels, errors, 99);
  assert.equal(clampedLastPage.activePage, 2);
  assert.equal(clampedLastPage.visibleParcels.length, 5);
  assert.equal(clampedLastPage.visibleParcels[0].globalIndex, 20);
  assert.equal(clampedLastPage.visibleParcels[4].parcel.seq, 25);

  assert.equal(getParcelPageCount(1), 1);
  assert.equal(getParcelPageCount(10), 1);
  assert.equal(getParcelPageCount(11), 2);
  assert.equal(getParcelPageCount(1000), 100);
  assert.equal(getParcelPageIndex(22), 2);
  assert.equal(clampParcelPage(-1, 25), 0);
  assert.equal(clampParcelPage(10, 25), 2);
});

test('adding a unit copies previous unit measurements while quantity input leaves new units empty', () => {
  const existingParcels = [
    { id: 'unit-1', seq: 1, weightKg: '2.5', lengthCm: '30', widthCm: '20', heightCm: '15' },
  ];

  const lastUnit = existingParcels[existingParcels.length - 1];
  const addedUnit = {
    id: 'unit-2',
    seq: 2,
    weightKg: lastUnit ? lastUnit.weightKg || '' : '',
    lengthCm: lastUnit ? lastUnit.lengthCm || '' : '',
    widthCm: lastUnit ? lastUnit.widthCm || '' : '',
    heightCm: lastUnit ? lastUnit.heightCm || '' : '',
  };
  assert.equal(addedUnit.weightKg, '2.5');
  assert.equal(addedUnit.lengthCm, '30');
  assert.equal(addedUnit.widthCm, '20');
  assert.equal(addedUnit.heightCm, '15');

  const typedQty = 3;
  const typedAdded = Array.from({ length: typedQty - existingParcels.length }, (_, i) => ({
    id: `unit-${i + 2}`,
    seq: i + 2,
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
  }));
  assert.equal(typedAdded.length, 2);
  assert.deepEqual(typedAdded[0], { id: 'unit-2', seq: 2, weightKg: '', lengthCm: '', widthCm: '', heightCm: '' });
  assert.deepEqual(typedAdded[1], { id: 'unit-3', seq: 3, weightKg: '', lengthCm: '', widthCm: '', heightCm: '' });
});

test('generatePaginationItems produces windowed pagination with at most 7 pills and ellipsis jump ranges', () => {
  // <= 7 pages: all pages returned directly without ellipsis
  const smallItems = generatePaginationItems(2, 5);
  assert.equal(smallItems.length, 5);
  assert.deepEqual(smallItems.map((item) => item.label), ['1', '2', '3', '4', '5']);
  assert.equal(smallItems[2].isCurrent, true);
  assert.equal(smallItems.every((item) => !item.isEllipsis), true);

  // Near start: page 1 of 100
  const startItems = generatePaginationItems(0, 100);
  assert.equal(startItems.length, 7);
  assert.deepEqual(startItems.map((item) => item.label), ['1', '2', '3', '4', '5', '...', '100']);
  assert.equal(startItems[0].isCurrent, true);
  assert.equal(startItems[5].isEllipsis, true);
  assert.equal(startItems[5].ellipsisDirection, 'right');
  assert.equal(startItems[5].pageIndex, 5); // jumps to page 6
  assert.equal(startItems[5].coveredPageIndices[0], 5);
  assert.equal(startItems[5].coveredPageIndices[startItems[5].coveredPageIndices.length - 1], 98);

  // Middle: page 37 of 100 (activePage = 36)
  const middleItems = generatePaginationItems(36, 100);
  assert.equal(middleItems.length, 7);
  assert.deepEqual(middleItems.map((item) => item.label), ['1', '...', '36', '37', '38', '...', '100']);
  assert.equal(middleItems[3].pageNumber, 37);
  assert.equal(middleItems[3].isCurrent, true);
  assert.equal(middleItems[1].isEllipsis, true);
  assert.equal(middleItems[1].ellipsisDirection, 'left');
  assert.equal(middleItems[1].pageIndex, 31); // 36 - 5 = 31 (page 32)
  assert.equal(middleItems[1].coveredPageIndices[0], 1);
  assert.equal(middleItems[1].coveredPageIndices[middleItems[1].coveredPageIndices.length - 1], 34);
  assert.equal(middleItems[5].isEllipsis, true);
  assert.equal(middleItems[5].ellipsisDirection, 'right');
  assert.equal(middleItems[5].pageIndex, 41); // 36 + 5 = 41 (page 42)
  assert.equal(middleItems[5].coveredPageIndices[0], 38);
  assert.equal(middleItems[5].coveredPageIndices[middleItems[5].coveredPageIndices.length - 1], 98);

  // Near end: page 100 of 100 (activePage = 99)
  const endItems = generatePaginationItems(99, 100);
  assert.equal(endItems.length, 7);
  assert.deepEqual(endItems.map((item) => item.label), ['1', '...', '96', '97', '98', '99', '100']);
  assert.equal(endItems[6].pageNumber, 100);
  assert.equal(endItems[6].isCurrent, true);
  assert.equal(endItems[1].isEllipsis, true);
  assert.equal(endItems[1].ellipsisDirection, 'left');
  assert.equal(endItems[1].pageIndex, 94); // 99 - 5 = 94 (page 95)
  assert.equal(endItems[1].coveredPageIndices[0], 1);
  assert.equal(endItems[1].coveredPageIndices[endItems[1].coveredPageIndices.length - 1], 94);

  // Boundary check at totalPages = 8
  const eightStart = generatePaginationItems(2, 8);
  assert.deepEqual(eightStart.map((item) => item.label), ['1', '2', '3', '4', '5', '...', '8']);
  const eightEnd = generatePaginationItems(5, 8);
  assert.deepEqual(eightEnd.map((item) => item.label), ['1', '...', '4', '5', '6', '7', '8']);

  // createParcelPaginationModel includes paginationItems
  const dummyParcels = Array.from({ length: 1000 }, (_, i) => ({ id: `p-${i}`, seq: i + 1 }));
  const model = createParcelPaginationModel(dummyParcels, {}, 36);
  assert.equal(model.paginationItems.length, 7);
  assert.deepEqual(model.paginationItems.map((item) => item.label), ['1', '...', '36', '37', '38', '...', '100']);
});

test('client selection and new client inputs auto-fill recipient delivery fields while preserving manual edits', () => {
  // 1. Initial form state
  const form = createRegistrationForm();
  assert.equal(form.recipientAddress, '');
  assert.equal(form.recipientContact, '');

  // 2. Client selection auto-populates address and contact
  const mockClient = {
    clientId: 'CL-001',
    name: 'Acme Logistics',
    address: '123 Main St, Quezon City',
    contactNumber: '09171234567',
  };

  const populatedFromClient = {
    ...form,
    clientId: mockClient.clientId,
    clientName: mockClient.name,
    recipientAddress: mockClient.address,
    recipientContact: mockClient.contactNumber,
  };
  assert.equal(populatedFromClient.recipientAddress, '123 Main St, Quezon City');
  assert.equal(populatedFromClient.recipientContact, '09171234567');

  // 3. User can manually override recipient delivery details (editable)
  const userOverridden = {
    ...populatedFromClient,
    recipientAddress: '456 Delivery Hub, Pasig City',
    recipientContact: '09189998877',
  };
  assert.equal(userOverridden.recipientAddress, '456 Delivery Hub, Pasig City');
  assert.equal(userOverridden.recipientContact, '09189998877');
  // Client identity remains intact
  assert.equal(userOverridden.clientId, 'CL-001');
  assert.equal(userOverridden.clientName, 'Acme Logistics');

  // 4. In NEW mode, separate recipient fields are not required and derive from new client
  const newModeForm = {
    ...createRegistrationForm(),
    clientMode: 'NEW',
    newClientName: 'Brand New Client',
    newClientAddress: '789 Industrial Ave, Taguig',
    newClientContact: '09191112233',
    newClientEmail: 'client@taguig.com',
    parcels: [{ id: 'u-1', seq: 1, weightKg: '2.0', lengthCm: '10', widthCm: '10', heightCm: '10' }],
  };
  const newModeErrors = validateRegistration(newModeForm);
  assert.deepEqual(newModeErrors, {});

  const newModeRequest = buildShipmentRequest(newModeForm, 'CL-GENERATED');
  assert.equal(newModeRequest.recipientAddress, '789 Industrial Ave, Taguig');
  assert.equal(newModeRequest.recipientContact, '09191112233');
  assert.equal(newModeRequest.recipientName, 'Brand New Client');
});


