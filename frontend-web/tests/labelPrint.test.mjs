import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IncompleteLabelDataError,
  escapeHtml,
  formatFiniteNumber,
  normalizeLabelData,
  resolveCurrentLabelBranding,
  buildLabelHtml,
} from '../src/features/shipments/services/labelPrintServiceCore.mjs';

test('label branding uses the current response at print time', async () => {
  const refreshedBranding = { companyName: 'TC & CT Integrated Logistics' };
  let fetchCount = 0;
  const branding = await resolveCurrentLabelBranding(async () => {
    fetchCount += 1;
    return refreshedBranding;
  });

  assert.equal(branding, refreshedBranding);
  assert.equal(fetchCount, 1);
});

test('label branding rejects failed and invalid refreshes', async () => {
  await assert.rejects(
    () => resolveCurrentLabelBranding(async () => { throw new Error('Branding service unavailable'); }),
    /Branding service unavailable/
  );
  await assert.rejects(
    () => resolveCurrentLabelBranding(async () => ({ companyName: '   ' })),
    /could not be verified/
  );
});

test('normalizeLabelData extracts full shipment and parcel unit metadata', () => {
  const shipment = {
    shipmentId: 'SHP-2026-001',
    recipientDetails: {
      fullName: 'Juan Dela Cruz',
      contactNumber: '0917-555-0148',
      address: '148 Rizal Ave, Caloocan City',
    },
    destination: 'TNL Baguio Hub',
    origin: 'Manila',
    description: 'Assorted office supplies',
    client: 'Northbridge Trading',
    totalAmount: 500,
    units: [
      { trackingId: 'TRK-2026-000101', packageIndex: 1, packageCount: 3, weightKg: 2.5 },
      { trackingId: 'TRK-2026-000102', packageIndex: 2, packageCount: 3, weightKg: 1.5 },
      { trackingId: 'TRK-2026-000103', packageIndex: 3, packageCount: 3, weightKg: 3.0 },
    ],
  };

  const labelData = normalizeLabelData(shipment, shipment.units[0], 0, 3);

  assert.equal(labelData.trackingId, 'TRK-2026-000101');
  assert.equal(labelData.shipmentId, 'SHP-2026-001');
  assert.equal(labelData.packageIndex, 1);
  assert.equal(labelData.packageCount, 3);
  assert.equal(labelData.recipientName, 'Juan Dela Cruz');
  assert.equal(labelData.contactNumber, '0917-555-0148');
  assert.equal(labelData.address, '148 Rizal Ave, Caloocan City');
  assert.equal(labelData.destinationHub, 'TNL Baguio Hub');
  assert.equal(labelData.contents, 'Assorted office supplies');
  assert.equal(labelData.clientName, 'Northbridge Trading');
  assert.equal(labelData.route, null, 'Missing routes must not be invented from origin and destination');
  assert.equal(labelData.totalAmount, 500);
  assert.equal(labelData.weightKg, 2.5);
});

test('normalizeLabelData falls back gracefully on flat structures', () => {
  const shipment = {
    shipmentId: 'SHP-2026-007',
    recipient: 'Test Recipient',
    contactNumber: '09123123132',
    address: 'testing address',
    destinationHub: 'TNL Central',
    client: { name: 'Acme Corp' },
    route: 'Manila to Baguio',
    pricing: { totalAmount: 750 },
  };
  const unit = { trackingId: 'TRK-2026-000007' };

  const labelData = normalizeLabelData(shipment, unit, 0, 1);

  assert.equal(labelData.trackingId, 'TRK-2026-000007');
  assert.equal(labelData.shipmentId, 'SHP-2026-007');
  assert.equal(labelData.recipientName, 'Test Recipient');
  assert.equal(labelData.contactNumber, '09123123132');
  assert.equal(labelData.address, 'testing address');
  assert.equal(labelData.destinationHub, 'TNL Central');
  assert.equal(labelData.clientName, 'Acme Corp');
  assert.equal(labelData.route, 'Manila to Baguio');
  assert.equal(labelData.totalAmount, 750);
});

test('normalizeLabelData throws IncompleteLabelDataError when required fields are missing', () => {
  assert.throws(
    () => normalizeLabelData({}, {}),
    (err) => err instanceof IncompleteLabelDataError && err.missingFields.includes('trackingId')
  );
});

test('buildLabelHtml generates isolated printable HTML matching prototype layout', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 3,
    recipientName: 'Juan Dela Cruz',
    contactNumber: '0917-555-0148',
    address: '148 Rizal Ave, Caloocan City',
    destinationHub: 'TNL Baguio Hub',
    contents: 'Assorted office supplies',
    clientName: 'Northbridge Trading',
    shipmentId: 'SHP-2026-001',
    route: 'Manila → TNL Baguio',
    totalAmount: 500,
  };

  const html = buildLabelHtml(labelData);

  assert.ok(html.includes('<!DOCTYPE html>'), 'Must start with DOCTYPE');
  assert.ok(html.includes('@page {'), 'Must declare @page CSS rule');
  assert.ok(html.includes('size: 150mm 100mm;'), 'Must specify 150mm by 100mm landscape thermal paper size');
  assert.ok(html.includes('TNL LOGISTICS'), 'Must include brand name');
  assert.ok(html.includes('PKG 1 / 3'), 'Must include package pill');
  assert.ok(html.includes('SCAN TO TRACK'), 'Must include scan prompt');
  assert.ok(html.includes('TRK-2026-000101'), 'Must include tracking ID');
  assert.ok(html.includes('Juan Dela Cruz'), 'Must include recipient name');
  assert.ok(html.includes('0917-555-0148'), 'Must include contact number');
  assert.ok(html.includes('148 Rizal Ave, Caloocan City'), 'Must include recipient address');
  assert.ok(html.includes('<div class="hub">Manila → TNL Baguio</div>'), 'Must show the entered route below the address');
  assert.ok(html.includes('Assorted office supplies'), 'Must include contents');
  assert.ok(html.includes('SHP-2026-001'), 'Must include shipment ID');
  assert.equal(html.includes('>Client:</span>'), false, 'Intentional presentation change: omit bottom client');
  assert.ok(html.includes('Manila → TNL Baguio'), 'Must include route');
  assert.equal(html.includes('PHP '), false, 'Intentional presentation change: omit price');
  assert.ok(html.includes('<svg'), 'Must render inline vector SVG QR code');
  assert.ok(html.includes('shape-rendering: crispEdges;'), 'Must configure crisp SVG edges for thermal print');
});

test('buildLabelHtml generates multi-unit document with CSS page breaks', () => {
  const labels = [
    {
      trackingId: 'TRK-2026-000101',
      packageIndex: 1,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      destinationHub: 'TNL Baguio Hub',
      shipmentId: 'SHP-2026-001',
      totalAmount: 500,
    },
    {
      trackingId: 'TRK-2026-000102',
      packageIndex: 2,
      packageCount: 2,
      recipientName: 'Juan Dela Cruz',
      destinationHub: 'TNL Baguio Hub',
      shipmentId: 'SHP-2026-001',
      totalAmount: 500,
    },
  ];

  const html = buildLabelHtml(labels);

  assert.ok(html.includes('SHP-2026-001 (2 Labels) - TNL Shipping Labels'), 'Title should reflect multiple labels');
  assert.ok(html.includes('PKG 1 / 2'), 'Must include first unit package counter');
  assert.ok(html.includes('PKG 2 / 2'), 'Must include second unit package counter');
  assert.ok(html.includes('TRK-2026-000101'), 'Must include first tracking ID');
  assert.ok(html.includes('TRK-2026-000102'), 'Must include second tracking ID');
  assert.ok(html.includes('page-break-after: always;'), 'Must specify page break after each card');
});

test('buildLabelHtml escapes untrusted input to prevent XSS in print document', () => {
  const hostile = '<script>alert(1)</script>';
  const html = buildLabelHtml({
    trackingId: 'TRK-2026-000999',
    packageIndex: 1,
    packageCount: 1,
    recipientName: hostile,
    destinationHub: 'TNL Hub',
    shipmentId: 'SHP-2026-999',
    contents: '"quoted" & <special>',
  });

  assert.ok(!html.includes('<script>'), 'Must not contain unescaped script tag');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Must contain escaped script tag');
  assert.ok(html.includes('&quot;quoted&quot; &amp; &lt;special&gt;'), 'Must contain escaped attributes');
});

test('buildLabelHtml applies dynamic company branding without badge letter', () => {
  const labelData = {
    trackingId: 'TRK-2026-000101',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Juan Dela Cruz',
    destinationHub: 'Camarines Hub',
    shipmentId: 'SHP-2026-001',
  };

  const html = buildLabelHtml(labelData, { companyName: 'TC & CT Integrated Logistics' });

  assert.ok(html.includes('TC &amp; CT INTEGRATED LOGISTICS'), 'Must include custom uppercase business name with HTML entities escaped');
  assert.ok(html.includes('TRK-2026-000101 - TC &amp; CT Integrated Logistics Shipping Label'), 'Title must reflect company name');
});

test('buildLabelHtml derives brand title from custom company name string', () => {
  const labelData = {
    trackingId: 'TRK-2026-000202',
    packageIndex: 1,
    packageCount: 1,
    recipientName: 'Maria Santos',
    destinationHub: 'Baguio Central',
    shipmentId: 'SHP-2026-002',
  };

  const html = buildLabelHtml(labelData, 'Acme Cargo');

  assert.ok(html.includes('ACME CARGO'), 'Must include custom string brand title');
  assert.ok(html.includes('TRK-2026-000202 - Acme Cargo Shipping Label'), 'Title must reflect custom brand string');
});

test('HTML labels use the escaped entered route without substituting a destination hub', () => {
  const label = { trackingId: 'TRK-2026-000058', packageIndex: 1, packageCount: 1,
    destinationHub: 'UNRELATED HUB', route: 'Quezon <City> to Cebu',
    clientName: 'Example Client', contents: 'D'.repeat(120), shipmentId: 'SHP-2026-014', totalAmount: 500 };
  const html = buildLabelHtml(label);
  assert.ok(html.includes('<div class="hub">Quezon &lt;City&gt; to Cebu</div>'));
  assert.equal(html.split('Quezon &lt;City&gt; to Cebu').length - 1, 1, 'Route must appear only once');
  assert.equal(html.includes('UNRELATED HUB'), false);
  assert.ok(html.indexOf('class="contents-field"') < html.indexOf('class="shipment-field"'));
  assert.equal(html.includes('class="client-field"'), false);
  assert.equal(html.includes('class="total-row"'), false);
  assert.ok(html.includes('>Notes:</span>'));
  assert.equal(html.includes('>Contents:</span>'), false);
  assert.ok(html.includes('D'.repeat(120)), 'Complete contents must be retained');
  assert.equal(buildLabelHtml({ ...label, route: null }).includes('<div class="hub">'), false);
});


test('production web and mobile previews retain Notes values and omit price and bottom client', async () => {
  const { loadProductionModule } = await import('./previewHarness.mjs');
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => [value, () => {}], useEffect: () => {}, useRef: value => ({ current: value }),
  };
  const native = new Proxy({ StyleSheet: { create: value => value }, Platform: { OS: 'web' } },
    { get: (target, key) => target[key] ?? key });
  const qr = () => null;
  const boundary = dependency => {
    if (dependency === 'react') return { __esModule: true, default: react, ...react };
    if (dependency === 'react-native') return native;
    if (dependency.endsWith('/theme')) return { colors: {}, fonts: {}, spacing: {}, radius: {} };
    if (dependency.endsWith('/QRCodeGenerator')) return { __esModule: true, default: qr, QRCodeGenerator: qr };
    if (dependency === 'expo-router') return { useRouter: () => ({}) };
    if (dependency.endsWith('/PrinterContext')) return { usePrinter: () => ({}) };
    return {};
  };
  const fixtures = [
    ['../src/features/shipments/components/LabelPreview.js', 'default', label => label],
    ['../src/features/shipments/components/PrintLabelsModal.js', 'default', label => ({ visible: true,
      shipment: { ...label, description: label.contents, client: label.clientName,
        recipientDetails: { fullName: label.recipientName, contactNumber: label.contactNumber, address: label.address },
        units: [{ trackingId: label.trackingId, packageIndex: 2 }], packageCount: 3 } })],
    ['../../frontend-mobile/src/components/common/ThermalLabelPreviewModal.js', 'ThermalLabelPreviewModal',
      label => ({ visible: true, labels: [label, { ...label, trackingId: 'OTHER-PARCEL' }] })],
  ];
  for (const [path, exportName, props] of fixtures) {
    const Component = loadProductionModule(path, boundary)[exportName];
    for (const contents of ['', 'Original <notes> & "fragile"', 'D'.repeat(120)]) {
      const label = { companyName: 'TNL LOGISTICS', trackingId: 'TRK-2026-000058', packageIndex: 2, packageCount: 3,
        contents, shipmentId: 'SHP-' + '9'.repeat(120), recipientName: 'Retained Recipient',
        contactNumber: '09171234567', address: 'Retained Address', route: 'Manila to Cebu',
        clientName: 'Hidden Client', client: 'Hidden Client', total: 987654, totalAmount: 987654 };
      const nodes = [];
      function visit(node) {
        if (Array.isArray(node)) return node.forEach(visit);
        if (node && typeof node === 'object') { nodes.push(node); visit(node.props?.children); }
      }
      const tree = Component(props(label));
      visit(tree);
      const text = node => Array.isArray(node) ? node.map(text).join('')
        : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
      const rendered = text(tree);
      assert.match(rendered, /Notes: /, path);
      assert.ok(rendered.includes(contents), path);
      assert.ok(rendered.includes(label.shipmentId), path);
      for (const retained of [label.recipientName, label.contactNumber, label.address, label.route]) assert.ok(rendered.includes(retained), path);
      assert.doesNotMatch(rendered, /Contents:|Client:|Total:|Hidden Client|987654/);
      assert.ok(nodes.some(node => node.type === qr && node.props.value === label.trackingId && node.props.size === 110));
    }
  }
});


test('HTML Notes retain empty, long, and escaped descriptions in single and batch labels', () => {
  for (const contents of ['', 'D'.repeat(120), '<script>"fragile" & safe</script>']) {
    const label = { trackingId: 'TRK-2026-000058', packageIndex: 2, packageCount: 3,
      contents, shipmentId: 'SHP-' + '9'.repeat(120), clientName: 'HIDDEN_CLIENT', totalAmount: 987654 };
    for (const labels of [label, [label, { ...label, trackingId: 'TRK-2026-000059', packageIndex: 3 }]]) {
      const html = buildLabelHtml(labels);
      assert.doesNotMatch(html, /HIDDEN_CLIENT|987654|>Client:|>Total:|>Contents:/);
      assert.ok(html.includes(label.shipmentId));
      assert.ok(html.includes('PKG 2 / 3'));
      assert.ok(html.includes('overflow-wrap: anywhere'));
      if (contents.startsWith('<')) {
        assert.ok(html.includes('&lt;script&gt;&quot;fragile&quot; &amp; safe&lt;/script&gt;'));
        assert.equal(html.includes(contents), false);
      } else assert.ok(html.includes(contents));
    }
  }
});
