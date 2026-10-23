import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProductionModule } from './previewHarness.mjs';

function mount(path, props = {}, shipment) {
  const slots = [];
  let cursor = 0;
  let tree;
  let effects = [];
  const routes = [];
  const reads = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useCallback: callback => callback,
    useEffect: effect => { effects.push(effect); },
  };
  const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
    Platform: { OS: 'web' }, StyleSheet: { create: styles => styles } };
  const Screen = loadProductionModule(path, dependency => {
    if (dependency === 'react') return { __esModule: true, default: react, ...react };
    if (dependency === 'react-native') return native;
    if (dependency === 'expo-router') return {
      useRouter: () => ({ push: route => routes.push(route) }),
      useLocalSearchParams: () => ({ shipmentId: 'SHP-1' }),
    };
    if (dependency.endsWith('/theme')) return { colors: {}, fonts: {}, spacing: {}, radius: {}, type: {} };
    if (dependency.endsWith('/features/shipments')) return {
      getShipment: async id => { reads.push(id); return shipment; },
      subscribeRealtimeEvents: () => () => {},
      LabelPreview: 'LabelPreview', PrintLabelsModal: 'PrintLabelsModal', SingleUnitQRModal: 'SingleUnitQRModal',
    };
    return { __esModule: true, default: dependency.split('/').at(-1) };
  }).default;
  function render() { cursor = 0; effects = []; tree = Screen(props); return tree; }
  return {
    render, routes, reads,
    async load() { render(); const pending = effects; await Promise.all(pending.map(effect => effect())); await new Promise(setImmediate); render(); },
    nodes: () => nodes(tree),
  };
}

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}

function rowWith(view, value) {
  return view.nodes().find(node => node.type === 'View'
    && node.props.children.some(child => child?.type === 'Text' && text(child) === value));
}

test('shipment table places current vehicles after Status and preserves View and paging actions', () => {
  const cases = [
    [{ currentVehicleCount: 0 }, '—'],
    [{ currentVehicleCount: 1, currentVehiclePlate: 'ABC-123', currentVehicleId: 'TRK-A' }, 'ABC-123'],
    [{ currentVehicleCount: 1, currentVehiclePlate: '   ', currentVehicleId: 'TRK-A' }, 'TRK-A'],
    [{ currentVehicleCount: 2, currentVehiclePlate: 'must not appear' }, 'Multiple vehicles'],
    [{ vehiclePlate: 'HISTORICAL', vehicleId: 'OLD' }, '—'],
  ];
  for (const [assignment, expected] of cases) {
    const shipment = { shipmentId: 'SHP-1', status: 'Loaded on Truck', ...assignment };
    let selected;
    let page;
    let pageSize;
    const view = mount('../src/features/shipments/components/ShipmentsTable.js', {
      shipments: [shipment], onView: value => { selected = value; },
      totalPages: 2, onPageChange: value => { page = value; }, onPageSizeChange: value => { pageSize = value; },
    });
    view.render();
    const header = view.nodes().find(node => node.type === 'View' && Array.isArray(node.props.children[0])
      && text(node.props.children[0][0]) === 'SHIPMENT');
    assert.deepEqual(header.props.children[0].map(text), ['SHIPMENT', 'RECIPIENT', 'CLIENT', 'QTY', 'STATUS', 'VEHICLE', 'PAYMENT', 'BALANCE', '']);
    const row = view.nodes().find(node => node.type === 'View' && node.props.children[0]?.props?.children?.[0]?.props?.children?.[0] === 'SHP-1');
    assert.equal(text(row.props.children[5]), expected);
    assert.equal(text(row).includes('HISTORICAL'), false);
    view.nodes().find(node => node.type === 'Pressable' && text(node) === 'View').props.onPress();
    assert.equal(selected, shipment);
    view.nodes().find(node => node.type === 'Button' && node.props.label === 'Next').props.onPress();
    assert.equal(page, 1);
    view.nodes().find(node => node.type === 'select').props.onChange({ target: { value: '50' } });
    assert.equal(pageSize, 50);
  }
});

test('detail screen renders package assignments and keeps View and Reprint tied to the package', async () => {
  const units = [
    { trackingId: 'PKG-1', currentVehicleId: 'TRK-A', currentVehiclePlate: 'ABC-123' },
    { trackingId: 'PKG-2', currentVehicleId: 'TRK-B', currentVehiclePlate: '  ' },
    { trackingId: 'PKG-3' },
    { trackingId: 'PKG-4', lost: true, currentVehicleId: 'TRK-A', currentVehiclePlate: 'ABC-123' },
    { trackingId: 'PKG-5', currentVehicleId: null, currentVehiclePlate: null },
  ].map((unit, index) => ({ ...unit, packageIndex: index + 1, packageCount: 5, status: 'Registered' }));
  const view = mount('../src/app/shipments/[shipmentId]/index.js', {}, { shipmentId: 'SHP-1', units });
  await view.load();
  assert.deepEqual(view.reads, ['SHP-1']);
  const header = rowWith(view, 'TRACKING ID');
  assert.deepEqual(header.props.children.map(text), ['PACKAGE', 'TRACKING ID', 'STATUS', 'VEHICLE', '']);
  for (const [index, expected] of ['ABC-123', 'TRK-B', '—', '—', '—'].entries()) {
    assert.equal(text(rowWith(view, `PKG-${index + 1}`).props.children[3]), expected);
  }
  const packageRow = rowWith(view, 'PKG-2');
  const actions = nodes(packageRow).filter(node => node.type === 'Pressable');
  actions.find(node => text(node) === 'View').props.onPress();
  assert.deepEqual(view.routes, ['/shipments/SHP-1/units/PKG-2']);
  actions.find(node => text(node) === 'Reprint').props.onPress();
  view.render();
  const modal = view.nodes().find(node => node.type === 'PrintLabelsModal');
  assert.equal(modal.props.visible, true);
  assert.equal(modal.props.initialTrackingId, 'PKG-2');
  assert.deepEqual(view.reads, ['SHP-1']);
});
