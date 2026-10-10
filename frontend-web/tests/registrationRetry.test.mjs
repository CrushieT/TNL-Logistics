import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { calculateShipmentMetrics } from '../src/features/shipments/registrationCalculations.mjs';
import { calculateTotalCents } from '../src/features/shipments/fixedPointPricing.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

function mountComponent(path, dependencies) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
    useMemo(callback) { return callback(); },
    useCallback(callback) { return callback; },
    useEffect(callback, next) {
      const index = cursor++;
      if (!slots[index] || next.some((value, position) => value !== slots[index][position])) {
        slots[index] = next;
        effects.push(callback);
      }
    },
  };
  const React = { ...hooks, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace('export default function', 'function');
  const componentName = /function (\w+)\(/.exec(source)[1];
  const compiled = transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
  const bindings = {
    React, ...hooks, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Switch: 'Switch',
    StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 1200 }),
    colors: {}, fonts: {}, spacing: {}, radius: {}, type: {}, calculateShipmentMetrics, calculateTotalCents,
    AppShell: 'AppShell', PageHeader: 'PageHeader', Toast: 'Toast', ShipmentForm: 'ShipmentForm',
    ShipmentResultView: 'ShipmentResultView', PrintLabelsModal: 'PrintLabelsModal', Card: 'Card',
    FormField: 'FormField', SelectField: 'SelectField', Button: 'Button', StatusModal: 'StatusModal',
    ClientSelectDropdown: 'ClientSelectDropdown', ParcelUnitsEditor: 'ParcelUnitsEditor', ShipmentPricingSummary: 'ShipmentPricingSummary',
    useRouter: () => ({ push() {} }), ...dependencies,
  };
  const component = new Function(...Object.keys(bindings), `${compiled}\nreturn ${componentName};`)(...Object.values(bindings));
  return props => {
    cursor = 0;
    const tree = component(props);
    const pending = effects;
    effects = [];
    pending.forEach(callback => callback());
    return tree;
  };
}

function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type), ...elements(tree.props?.right, type)];
}

async function setup({ failClient = false, rejections = 1, pendingClient } = {}) {
  let clientWrites = 0;
  const requests = [];
  const createdClient = { id: 'CL-NEW', name: 'New billing client', address: 'Billing street', contactNumber: '09170000000', active: true };
  const screen = mountComponent('../src/app/register.js', {
    listClients: async () => [{ id: 'CL-OLD', name: 'Old client', active: true }],
    getCompanyBranding: async () => ({ volumetricDivisor: 5000, ratePerKilo: 34.25 }),
    getShipmentCalculationSettings: async () => ({ volumetricDivisor: 5000, ratePerKilo: 35 }),
    createClient: async () => { clientWrites++; if (pendingClient) await pendingClient; if (failClient) throw { response: { status: 400, data: { message: 'Invalid client' } } }; return createdClient; },
    registerShipment: async request => {
      requests.push(request);
      if (requests.length <= rejections) throw { response: { status: 409, data: { code: 'STALE_SETTINGS' } } };
      return { shipmentId: 'SHP-NEW', units: [] };
    },
    getShipment: async () => ({ shipmentId: 'SHP-NEW', units: [] }),
  });
  const form = mountComponent('../src/features/shipments/components/ShipmentForm.js');
  let tree;
  const render = async () => {
    for (let iteration = 0; iteration < 5; iteration++) {
      const props = elements(screen(), 'ShipmentForm')[0]?.props;
      if (props) tree = form(props);
      await Promise.resolve();
    }
    return tree;
  };
  await render();
  elements(tree, 'TouchableOpacity').find(element => element.props.children[0]?.props?.children[0] === '+ New').props.onPress();
  await render();
  const fields = elements(tree, 'FormField');
  const fill = (label, value) => {
    const field = fields.find(element => element.props.label === label);
    assert.ok(field, label);
    field.props.onChangeText(value);
  };
  // Use the production field handlers, including the parcel editor callback.
  for (const [label, value] of [['Client / Company Name', createdClient.name], ['Billing Address', createdClient.address], ['Contact Number', createdClient.contactNumber]]) fill(label, value);
  const editor = elements(tree, 'ParcelUnitsEditor')[0];
  for (const [field, value] of Object.entries({ weightKg: '0.06', lengthCm: '0.1', widthCm: '0.1', heightCm: '0.1' })) editor.props.onUpdateParcelField(0, field, value);
  elements(tree, 'ShipmentPricingSummary')[0].props.onOtherChargesChange('0.29');
  elements(tree, 'Switch')[0].props.onValueChange(true);
  await render();
  return { render, screen, getTree: () => tree, requests, getClientWrites: () => clientWrites };
}

test('web form selects created client before stale-settings rejection and reuses it on explicit retry', async () => {
  const flow = await setup();
  elements(flow.getTree(), 'Button')[0].props.onPress();
  await flow.render();
  const selected = elements(flow.getTree(), 'ClientSelectDropdown')[0];
  assert.ok(selected, 'form switches to Existing');
  assert.equal(selected.props.value, 'CL-NEW');
  assert.equal(selected.props.clients.filter(client => client.id === 'CL-NEW').length, 1);
  assert.equal(flow.requests.length, 1, 'refresh never retries a write');
  elements(flow.getTree(), 'Button')[0].props.onPress();
  await flow.render();
  assert.equal(flow.getClientWrites(), 1);
  assert.equal(flow.requests.length, 2);
  assert.deepEqual(flow.requests.map(request => request.clientId), ['CL-NEW', 'CL-NEW']);
  for (const field of ['parcels', 'recipientAddress', 'recipientContact', 'otherCharges', 'paidAtRegistration', 'description', 'route']) assert.deepEqual(flow.requests[0][field], flow.requests[1][field], field);
  assert.equal(flow.requests[1].expectedRatePerKilo, 35);
  const result = elements(flow.screen(), 'ShipmentResultView')[0];
  result.props.onRegisterAnother();
  const freshProps = elements(flow.screen(), 'ShipmentForm')[0].props;
  const freshForm = mountComponent('../src/features/shipments/components/ShipmentForm.js')(freshProps);
  assert.equal(elements(freshForm, 'ParcelUnitsEditor')[0].props.parcels[0].weightKg, '');
  assert.equal(elements(freshForm, 'Switch')[0].props.value, false);
  assert.equal(elements(freshForm, 'ShipmentPricingSummary')[0].props.otherCharges, '0');
});

test('failed client creation leaves New mode and sends no shipment', async () => {
  const flow = await setup({ failClient: true });
  elements(flow.getTree(), 'Button')[0].props.onPress();
  await flow.render();
  assert.equal(elements(flow.getTree(), 'ClientSelectDropdown').length, 0);
  assert.equal(flow.requests.length, 0);
});

test('duplicate clicks and repeated shipment rejections create one client', async () => {
  const flow = await setup({ rejections: 3 });
  const submit = elements(flow.getTree(), 'Button')[0].props.onPress;
  submit(); submit();
  await flow.render();
  assert.equal(flow.requests.length, 1);
  for (let attempt = 0; attempt < 2; attempt++) {
    elements(flow.getTree(), 'Button')[0].props.onPress();
    await flow.render();
  }
  assert.equal(flow.getClientWrites(), 1);
  assert.equal(flow.requests.length, 3);
  assert.ok(flow.requests.every(request => request.clientId === 'CL-NEW'));
});

test('pending submission makes the form inert for keyboard and pointer editing', async () => {
  let finishClient;
  const pendingClient = new Promise(resolve => { finishClient = resolve; });
  const flow = await setup({ pendingClient });
  elements(flow.getTree(), 'Button')[0].props.onPress();
  await flow.render();
  assert.equal(flow.getTree().props.inert, true);
  assert.equal(flow.getTree().props.pointerEvents, 'none');
  assert.equal(elements(flow.getTree(), 'Button')[0].props.disabled, true);
  finishClient();
  await flow.render();
  assert.equal(flow.getTree().props.inert, undefined);
  assert.equal(flow.getTree().props.pointerEvents, 'auto');
});
