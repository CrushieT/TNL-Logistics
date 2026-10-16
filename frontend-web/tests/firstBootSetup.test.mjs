import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getSoaBankDetailsErrors, normalizeSoaBankDetails } from '../src/features/settings/utils/soaBankDetails.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const financialLabels = ['SOA BANK NAME *', 'SOA ACCOUNT NAME *', 'SOA ACCOUNT NUMBER *', 'RATE PER KILO (PHP) *'];
const validFinancialValues = ['Example Settlement Bank', 'Example Freight Account', '001234567890', '37.25'];

function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}

function textContent(tree) {
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object') return '';
  if (Array.isArray(tree)) return tree.map(textContent).join(' ');
  return textContent(tree.props?.children);
}

function mountSetup(register = async () => {}) {
  const slots = [];
  let cursor = 0;
  const requests = [];
  const routes = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {},
  };
  const source = readFileSync(new URL('../src/app/setup.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export default function', 'function');
  const compiled = transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
  const bindings = {
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    ...hooks, View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity',
    Image: 'Image', ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView',
    StyleSheet: { create: value => value }, Platform: { OS: 'web' },
    useWindowDimensions: () => ({ width: 390, height: 600 }),
    colors: {}, fonts: {}, spacing: {}, radius: {}, require: () => 'logo',
    useRouter: () => ({ replace: path => routes.push(path) }), useRootNavigationState: () => ({ key: 'setup' }),
    getSoaBankDetailsErrors, normalizeSoaBankDetails,
    registerFirstBootAdmin: async payload => { requests.push(payload); return register(payload); },
  };
  const component = new Function(...Object.keys(bindings), `${compiled}\nreturn SetupScreen;`)(...Object.values(bindings));
  let tree;
  const render = () => { cursor = 0; tree = component(); return tree; };
  const button = label => elements(tree, 'TouchableOpacity').find(element => textContent(element).includes(label));
  const field = label => elements(tree, 'TextInput').find(element => element.props.accessibilityLabel === label);
  const fill = values => financialLabels.forEach((label, index) => field(label).props.onChangeText(values[index]));
  render();
  ['Setup Admin', 'setupadmin', 'SetupPass123!', 'SetupPass123!'].forEach((value, index) => {
    elements(tree, 'TextInput')[index].props.onChangeText(value);
  });
  render();
  button('CONTINUE TO COMPANY SETUP').props.onPress();
  render();
  return { render, button, field, fill, requests, routes, tree: () => tree };
}

test('first boot financial inputs start empty without placeholders and retain values across Back/Next', () => {
  const screen = mountSetup();
  for (const label of financialLabels) {
    assert.equal(screen.field(label).props.value, '');
    assert.equal(screen.field(label).props.placeholder, undefined);
  }
  assert.match(textContent(screen.tree()), /Company Details.*SOA Bank Details.*Pricing/);
  screen.fill(validFinancialValues);
  screen.render();
  screen.button('BACK').props.onPress();
  screen.render();
  assert.equal(elements(screen.tree(), 'TextInput')[0].props.value, 'Setup Admin');
  screen.button('CONTINUE TO COMPANY SETUP').props.onPress();
  screen.render();
  financialLabels.forEach((label, index) => assert.equal(screen.field(label).props.value, validFinancialValues[index]));
  const billingEmail = elements(screen.tree(), 'TextInput').find(element => element.props.keyboardType === 'email-address');
  assert.equal(billingEmail.props.onSubmitEditing, undefined);
  assert.equal(screen.field(financialLabels[3]).props.returnKeyType, 'go');
});

for (const [index, values] of financialLabels.map((label, index) => [index, validFinancialValues.map((value, position) => position === index ? '' : value)])) {
  test(`first boot requires ${financialLabels[index]}`, async () => {
    const screen = mountSetup();
    screen.fill(values);
    screen.render();
    await screen.button('INITIALIZE & LAUNCH CONSOLE').props.onPress();
    screen.render();
    assert.equal(screen.requests.length, 0);
    assert.match(textContent(screen.tree()), /SETUP VALIDATION ERROR/);
  });
}

for (const [index, value] of [
  [0, 'B'.repeat(101)], [1, 'A'.repeat(151)], [0, 'Bank\nName'], [1, 'Account\tName'],
  [0, 'Bank\u0085Name'], [1, 'Account\u2028Name'], [0, 'Bank\u0000Name'],
  [2, '12345'], [2, '1'.repeat(21)], [2, '001-234'], [2, '00123A'],
  ...['0', '-1', '0.001', '1.234', '10000000000', '1e2', '12junk', '.5', '1.', 'NaN', 'Infinity', '1,000', '+1'].map(rate => [3, rate]),
]) {
  test(`first boot rejects invalid financial field ${index}: ${JSON.stringify(value)}`, async () => {
    const screen = mountSetup();
    screen.fill(validFinancialValues.map((valid, position) => position === index ? value : valid));
    screen.render();
    await screen.field(financialLabels[3]).props.onSubmitEditing();
    screen.render();
    assert.equal(screen.requests.length, 0);
    assert.match(textContent(screen.tree()), /SETUP VALIDATION ERROR/);
  });
}

for (const rate of ['0.01', '1', '1.2', '9999999999.99', ' 37.25 ']) {
  test(`first boot accepts rate ${rate} and boundary bank values without losing leading zeros`, async () => {
    const screen = mountSetup();
    screen.fill([' B'.padEnd(101, 'B') + ' ', ' A'.padEnd(151, 'A') + ' ', '00000000000000000001', rate]);
    screen.render();
    await screen.field(financialLabels[3]).props.onSubmitEditing();
    assert.equal(screen.requests.length, 1);
    const payload = screen.requests[0];
    assert.equal(payload.soaBankName.length, 100);
    assert.equal(payload.soaAccountName.length, 150);
    assert.equal(payload.soaAccountNumber, '00000000000000000001');
    assert.equal(payload.ratePerKilo, Number(rate));
    assert.equal(payload.companyName, 'TC & CT Integrated Logistics');
    assert.equal(payload.username, 'setupadmin');
    assert.deepEqual(screen.routes, ['/']);
  });
}

test('saving prevents duplicate keyboard/click requests and navigation; rejection preserves inputs and permits retry', async () => {
  let rejectRequest;
  const screen = mountSetup(() => screen.requests.length === 1
    ? new Promise((resolve, reject) => { rejectRequest = reject; }) : Promise.resolve());
  screen.fill(validFinancialValues);
  screen.render();
  const submit = screen.button('INITIALIZE & LAUNCH CONSOLE').props.onPress;
  const staleBack = screen.button('BACK').props.onPress;
  const pending = submit();
  await submit();
  staleBack();
  screen.render();
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.button('BACK').props.disabled, true);
  assert.ok(elements(screen.tree(), 'TouchableOpacity').filter(element => element.props.onPress).every(element => element.props.disabled));
  assert.ok(elements(screen.tree(), 'TextInput').every(element => element.props.editable === false));
  assert.ok(screen.field(financialLabels[3]));
  rejectRequest({ response: { data: { message: 'Setup could not be saved' } } });
  await pending;
  screen.render();
  assert.match(textContent(screen.tree()), /Setup could not be saved/);
  assert.equal(screen.button('BACK').props.disabled, false);
  financialLabels.forEach((label, index) => assert.equal(screen.field(label).props.value, validFinancialValues[index]));
  await screen.button('INITIALIZE & LAUNCH CONSOLE').props.onPress();
  assert.equal(screen.requests.length, 2);
  assert.deepEqual(screen.requests[1], screen.requests[0]);
  assert.deepEqual(screen.routes, ['/']);
});

test('registration client sends all financial fields and retains administrator session behavior', async () => {
  const source = readFileSync(new URL('../src/services/api/client.js', import.meta.url), 'utf8');
  const functionSource = source.slice(source.indexOf('export async function registerFirstBootAdmin'), source.indexOf('\nconst apiClient ='))
    .replace('export async function', 'async function');
  let request;
  let user;
  let token;
  const bindings = {
    axios: { post: async (url, payload) => { request = { url, payload }; return { data: { token: 'admin-token', userId: 'USR-ADMIN', role: 'ADMIN', mustChangePassword: false } }; } },
    BASE_URL: '/api/v1', isEligibleAdminToken: () => true,
    incrementSessionGeneration() {}, setToken: value => { token = value; }, setCurrentUser: value => { user = value; }, notifySessionChanged() {},
  };
  const register = new Function(...Object.keys(bindings), `let isAdminSessionVerified = false;\n${functionSource}\nreturn registerFirstBootAdmin;`)(...Object.values(bindings));
  const payload = { fullName: 'Setup Admin', username: 'setupadmin', password: 'SetupPass123!', confirmPassword: 'SetupPass123!',
    companyName: 'Example Freight', companyAddress: 'Example Street', companyContact: '09175550000', billingEmail: 'billing@example.test',
    soaBankName: validFinancialValues[0], soaAccountName: validFinancialValues[1], soaAccountNumber: validFinancialValues[2], ratePerKilo: 37.25 };
  await register(payload);
  assert.deepEqual(request, { url: '/api/v1/auth/first-boot-admin', payload });
  assert.equal(token, 'admin-token');
  assert.equal(user.role, 'ADMIN');
  assert.equal(user.username, 'setupadmin');
  assert.equal(user.soaAccountNumber, undefined);
});
