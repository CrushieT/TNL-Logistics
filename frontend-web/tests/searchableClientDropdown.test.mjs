import { mountScreen } from './previewHarness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

// Exercise production JSX and handlers with the same lightweight hooks approach as registration tests.
function mountComponent(path, dependencies = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
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
  const React = {
    ...hooks,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace('export default function', 'function');
  const componentName = /function (\w+)\(/.exec(source)[1];
  const compiled = transformSync(source, {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'],
  }).code;
  const bindings = {
    React, ...hooks, View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
    ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { create: value => value }, colors: {}, fonts: {}, spacing: {}, radius: {},
    Platform: { OS: 'web' }, AppShell: 'AppShell', CheckIcon: 'CheckIcon',
    SearchableClientDropdown: 'SearchableClientDropdown', CycleDropdown: 'CycleDropdown',
    DeductionsInputCard: 'DeductionsInputCard', StatementPaperCard: 'StatementPaperCard',
    useRouter: () => ({ push() {} }), useLocalSearchParams: () => ({}),
    hasUnsavedStatementAdjustments: () => false, getStatementPrintBlockReason: () => null,
    formatCurrency: value => String(value), ...dependencies,
  };
  const component = new Function(...Object.keys(bindings), `${compiled}\nreturn ${componentName};`)(...Object.values(bindings));
  return (props = {}) => {
    cursor = 0;
    const tree = component(props);
    const pending = effects;
    effects = [];
    pending.forEach(callback => callback());
    return tree;
  };
}

function elements(tree, type) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, type));
  if (!tree || typeof tree !== 'object') return [];
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}

function textContent(tree) {
  if (Array.isArray(tree)) return tree.map(textContent).join('');
  if (tree && typeof tree === 'object') return textContent(tree.props?.children);
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}

const clients = [
  { clientId: 'CL-A', name: 'Northern Goods', clientCode: 'NORTH-01', contactNumber: '09171234567', email: 'billing@north.example', soaNumber: 'SOA-20261015-001' },
  { clientId: 'CL-B', clientName: 'Southern Supplies', code: 'SOUTH-02', contact: '09281234567', soaNumber: 'SOA-20261015-002' },
  { clientId: 'CL-C', name: 'No Statement' },
  { clientId: 'CL-D', name: 'Blank Statement', soaNumber: '' },
];

function dropdown(options = {}) {
  const render = mountComponent('../src/features/collections/components/SearchableClientDropdown.js');
  const props = { clients, ...options };
  const input = () => elements(render(props), 'TextInput')[0];
  input().props.onFocus();
  return {
    render: () => render(props),
    search(query) { input().props.onChangeText(query); return render(props); },
  };
}

function recommendations(tree) {
  return elements(tree, 'ScrollView').flatMap(list => elements(list, 'Pressable'));
}

test('SOA mode displays numbers and omits the line for missing or blank numbers', () => {
  const rows = recommendations(dropdown({ showSoaNumber: true }).render());
  assert.equal(rows.length, 4);
  assert.ok(textContent(rows[0]).includes('SOA: SOA-20261015-001'));
  assert.ok(textContent(rows[1]).includes('SOA: SOA-20261015-002'));
  assert.ok(!textContent(rows[2]).includes('SOA:'));
  assert.ok(!textContent(rows[3]).includes('SOA:'));
});

for (const query of ['SOA-20261015-001', '1015-001', 'soa-20261015-001', '  SoA-20261015-001  ']) {
  test(`SOA search matches ${JSON.stringify(query)}`, () => {
    const rows = recommendations(dropdown({ showSoaNumber: true }).search(query));
    assert.equal(rows.length, 1);
    assert.ok(textContent(rows[0]).includes('Northern Goods'));
  });
}

for (const showSoaNumber of [false, true]) {
  test(`existing client searches and whitespace work with SOA mode ${showSoaNumber}`, () => {
    const component = dropdown({ showSoaNumber });
    for (const query of ['northern', ' NORTH-01 ', '0917123', 'BILLING@NORTH', 'southern', 'south-02', '0928123']) {
      assert.equal(recommendations(component.search(query)).length, 1, query);
    }
    assert.equal(recommendations(component.search('   ')).length, 4);
    assert.equal(recommendations(component.search('not present')).length, 0);
  });
}

test('default mode hides and does not search SOA numbers and keeps original guidance', () => {
  const component = dropdown();
  assert.ok(!textContent(component.render()).includes('SOA:'));
  const tree = component.search('SOA-20261015-001');
  assert.equal(recommendations(tree).length, 0);
  assert.ok(textContent(tree).includes('Try searching with a different name, code, or contact number.'));
});

test('SOA mode includes SOA numbers in empty-result guidance', () => {
  assert.ok(textContent(dropdown({ showSoaNumber: true }).search('missing'))
    .includes('Try searching with a different SOA number'));
});

test('search selection returns the original client, sets its name and closes the menu', () => {
  const selected = [];
  const searches = [];
  const component = dropdown({ showSoaNumber: true, onSelectClient: client => selected.push(client), onChangeSearch: query => searches.push(query) });
  recommendations(component.search('1015-002'))[0].props.onPress();
  assert.equal(selected[0], clients[1]);
  assert.equal(searches.at(-1), 'Southern Supplies');
  assert.equal(elements(component.render(), 'TextInput')[0].props.value, 'Southern Supplies');
  assert.equal(recommendations(component.render()).length, 0);
});

test('Statements maps generated SOAs and selection requests the correct client and cycle', async () => {
  const cycles = [{ isoDate: '2026-10-15' }, { isoDate: '2026-10-08' }];
  const previewRequests = [];
  const collectionRequests = [];
  const screen = mountScreen('statements', {
    getActiveCollectionCycles: async () => cycles,
    getAuthorizedCollectors: async () => [],
    getWeeklyCollections: async cycle => {
      collectionRequests.push(cycle);
      return { items: [
        ...clients.slice(0, 2).map(client => ({
          clientId: client.clientId, clientName: client.name || client.clientName,
          clientCode: client.clientCode || client.code, contactNumber: client.contactNumber || client.contact,
          statementId: `${cycle}-${client.clientId}`, status: client.clientId === 'CL-A' ? 'SOA_GENERATED' : 'SETTLED',
        })),
        { clientId: 'CL-C', clientName: 'Not generated', status: 'READY_FOR_SOA' },
      ] };
    },
    getStatementPreview: async (clientId, cycle) => {
      previewRequests.push({ clientId, cycle });
      return { items: [], totalCharges: 0 };
    },
  });
  const render = async () => {
    await screen.flush();
    for (let step = 0; step < 3; step++) { await new Promise(resolve => setTimeout(resolve, 330)); await screen.flush(); }
    return screen.render();
  };
  let tree = await render();
  let props = screen.props('SearchableClientDropdown');
  assert.equal(props.showSoaNumber, true);
  assert.ok(props.placeholder.includes('SOA number'));
  assert.equal(props.clients.length, 2);
  assert.equal(props.clients[0].clientCode, 'NORTH-01');
  assert.equal(props.clients[0].contactNumber, '09171234567');
  assert.equal(props.clients[0].soaNumber, '2026-10-15-CL-A');
  const component = dropdown(props);
  recommendations(component.search('2026-10-15-CL-B'))[0].props.onPress();
  tree = await render();
  assert.deepEqual(previewRequests.at(-1), { clientId: 'CL-B', cycle: '2026-10-15' });
  screen.props('CycleDropdown').onSelectCycle('2026-10-08');
  tree = await render();
  props = screen.props('SearchableClientDropdown');
  assert.equal(collectionRequests.at(-1), '2026-10-08');
  assert.equal(props.clients[1].soaNumber, '2026-10-08-CL-B');
  const switched = dropdown(props);
  assert.equal(recommendations(switched.search('2026-10-15')).length, 0);
  recommendations(switched.search('2026-10-08-CL-A'))[0].props.onPress();
  await render();
  assert.deepEqual(previewRequests.at(-1), { clientId: 'CL-A', cycle: '2026-10-08' });
  screen.unmount();
});
