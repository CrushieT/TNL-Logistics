import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildWaybillPrintHtml } from '../src/features/waybills/services/waybillPrint.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

function mount({ post, onRefresh = async () => {} }) {
  const slots = [];
  let cursor = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = value; }];
  };
  const useRef = initial => useState({ current: initial })[0];
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const source = readFileSync(new URL('../src/components/common/ExceptionAction.js', import.meta.url), 'utf8')
    .replace(/^import.*;\r?\n/gm, '').replace('export default function', 'function');
  const compiled = transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code;
  const bindings = { React, useState, useRef, Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput',
    View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value },
    colors: {}, fonts: {}, radius: {}, spacing: {}, type: { label: {}, bodySmall: {} }, apiClient: { post } };
  const Component = new Function(...Object.keys(bindings), `${compiled}; return ExceptionAction;`)(...Object.values(bindings));
  let record = { trackingId: 'TRK-1', shipmentId: 'SHP-1', revision: 3, status: 'Loaded to Hauler' };
  let isAvailable = true;
  const render = () => { cursor = 0; return Component({ record, label: 'Mark as Lost', endpoint: '/parcel-units/TRK-1/lost', onRefresh, isAvailable }); };
  const nodes = (tree, type) => {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
    return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
  };
  const button = label => nodes(render(), 'Pressable').find(node => nodes(node, 'Text')
    .some(text => text.props.children.flat(Infinity).join('').includes(label)));
  return {
    open() { button('Mark as Lost').props.onPress(); },
    reason(value) { nodes(render(), 'TextInput')[0].props.onChangeText(value); },
    confirm() { return button('Confirm').props.onPress(); },
    button,
    modal() { return nodes(render(), 'Modal')[0]; },
    input() { return nodes(render(), 'TextInput')[0]; },
    updateRecord(value) { record = value; },
    available(value) { isAvailable = value; },
  };
}

test('confirmation freezes reviewed revision and blocks double submission', async () => {
  let release;
  const requests = [];
  const view = mount({ post: async (...request) => { requests.push(request); await new Promise(resolve => { release = resolve; }); } });
  view.open();
  view.reason('  Missing at hub  ');
  view.updateRecord({ trackingId: 'TRK-1', revision: 9 });
  const confirm = view.button('Confirm').props.onPress;
  const first = confirm();
  await confirm();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].expectedRevision, 3);
  assert.equal(requests[0][1].reason, 'Missing at hub');
  release();
  await first;
  assert.equal(view.modal().props.visible, false);
});

test('failed requests retain reason and reuse request ID for identical retries', async () => {
  const requests = [];
  const view = mount({ post: async (endpoint, request) => { requests.push(request); throw new Error('Network failure'); } });
  view.open();
  view.reason('Missing');
  await view.confirm();
  assert.equal(view.input().props.value, 'Missing');
  assert.equal(view.modal().props.visible, true);
  await view.confirm();
  assert.equal(requests[0].requestId, requests[1].requestId);
  view.reason('Different reason');
  await view.confirm();
  assert.notEqual(requests[1].requestId, requests[2].requestId);
});

test('conflicts refresh state and require a new confirmation', async () => {
  let refreshes = 0;
  const view = mount({ post: async () => { throw { response: { status: 409 } }; }, onRefresh: async () => { refreshes++; } });
  view.open();
  view.reason('Missing');
  await view.confirm();
  assert.equal(refreshes, 1);
  assert.equal(view.input().props.value, 'Missing');
  assert.equal(view.button('Confirm'), undefined);
  await view.button('Refresh and review again').props.onPress();
  assert.equal(view.modal().props.visible, false);
});

test('blank and overlong trimmed reasons cannot submit', async () => {
  let writes = 0;
  const view = mount({ post: async () => { writes++; } });
  view.open();
  for (const reason of ['   ', 'x'.repeat(256)]) {
    view.reason(reason);
    assert.equal(view.button('Confirm').props.disabled, true);
    await view.confirm();
  }
  assert.equal(writes, 0);
});

test('an open confirmation retains its reason when refreshed eligibility hides the action', async () => {
  let view;
  view = mount({ post: async () => { throw { response: { status: 409 } }; }, onRefresh: async () => { view.available(false); } });
  view.open();
  view.reason('All parcels missing');
  await view.confirm();
  assert.equal(view.button('Mark as Lost'), undefined);
  assert.equal(view.modal().props.visible, true);
  assert.equal(view.input().props.value, 'All parcels missing');
  assert.ok(view.button('Refresh and review again'));
});

test('reprints retain lost members, counts, and escaped tracking IDs', () => {
  const html = buildWaybillPrintHtml({ waybillId: 'WYB-2026-0001', statusLabel: 'Closed with Loss', deliveredCount: 1, lostCount: 1,
    parcels: [{ trackingId: 'TRK-OK' }, { trackingId: '<TRK-LOST>', lost: true }], totalQuantity: 2 });
  assert.ok(html.includes('&lt;TRK-LOST&gt; | LOST'));
  assert.ok(html.includes('Closed with Loss'));
  assert.ok(html.includes('Delivered: 1 | Lost: 1'));
  assert.equal((html.match(/TRK-OK/g) || []).length, 2);
});
