import test from 'node:test';
import assert from 'node:assert/strict';
import { deferred, mountScreen } from './previewHarness.mjs';

function mountWaybillDetail(initialWaybillId = 'WYB-A') {
  const manifestRequests = [];
  const historyRequests = [];
  const screen = mountScreen('waybills/[id]', {
    searchParams: { id: initialWaybillId },
    getWaybillByNumber(waybillId) {
      const response = deferred();
      manifestRequests.push({ waybillId, ...response });
      return response.promise;
    },
    getCompanyBranding: async () => ({ companyName: 'Test Logistics' }),
    clientGet(url) {
      const response = deferred();
      historyRequests.push({ url, ...response });
      return response.promise;
    },
  });
  screen.render();
  return { screen, manifestRequests, historyRequests };
}

function getRenderedManifest(node) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const manifest = getRenderedManifest(child);
      if (manifest) return manifest;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  if (node.props?.manifest?.waybillId) return node.props.manifest;
  return getRenderedManifest(node.props?.children);
}

function manifest(waybillId, statusLabel) {
  return { waybillId, shipmentId: 'SHP-A', status: statusLabel, statusLabel, totalQuantity: 1 };
}

test('older Generated response cannot replace newer Sent to Hauler manifest and history', async () => {
  const { screen, manifestRequests, historyRequests } = mountWaybillDetail();
  await screen.flush();
  assert.equal(manifestRequests.length, 1);

  screen.emit({ type: 'WAYBILL_UPDATE', data: { waybillId: 'WYB-A', shipmentId: 'SHP-A' } });
  await screen.flush();
  assert.equal(manifestRequests.length, 2);

  manifestRequests[1].resolve(manifest('WYB-A', 'Sent to Hauler'));
  await screen.flush();
  assert.equal(historyRequests.length, 1);
  historyRequests[0].resolve({ data: [{ eventId: 2, action: 'CLOSED', actorId: 'CURRENT' }] });
  await screen.flush();

  manifestRequests[0].resolve(manifest('WYB-A', 'Generated'));
  await screen.flush();
  assert.equal(historyRequests.length, 2);
  historyRequests[1].resolve({ data: [{ eventId: 1, action: 'CLOSED', actorId: 'OBSOLETE' }] });
  const rendered = await screen.flush();

  assert.equal(getRenderedManifest(rendered)?.statusLabel, 'Sent to Hauler');
  assert.match(screen.text(), /CURRENT/);
  assert.doesNotMatch(screen.text(), /OBSOLETE/);
  screen.unmount();
});

test('previous route response cannot replace the newly selected waybill', async () => {
  const { screen, manifestRequests, historyRequests } = mountWaybillDetail();
  await screen.flush();
  screen.changeRoute({ id: 'WYB-B' });
  await screen.flush();
  assert.deepEqual(manifestRequests.map(request => request.waybillId), ['WYB-A', 'WYB-B']);

  manifestRequests[1].resolve(manifest('WYB-B', 'Sent to Hauler'));
  await screen.flush();
  historyRequests[0].resolve({ data: [] });
  await screen.flush();

  manifestRequests[0].resolve(manifest('WYB-A', 'Generated'));
  await screen.flush();
  assert.equal(historyRequests.length, 2);
  historyRequests[1].resolve({ data: [] });
  const rendered = await screen.flush();

  assert.equal(getRenderedManifest(rendered)?.waybillId, 'WYB-B');
  assert.equal(getRenderedManifest(rendered)?.statusLabel, 'Sent to Hauler');
  screen.unmount();
});

test('obsolete request failure cannot clear a successful current manifest', async () => {
  const { screen, manifestRequests, historyRequests } = mountWaybillDetail();
  await screen.flush();
  screen.emit({ type: 'WAYBILL_UPDATE', data: { waybillId: 'WYB-A', shipmentId: 'SHP-A' } });
  await screen.flush();

  manifestRequests[1].resolve(manifest('WYB-A', 'Sent to Hauler'));
  await screen.flush();
  historyRequests[0].resolve({ data: [] });
  await screen.flush();

  manifestRequests[0].reject(new Error('Obsolete request failed'));
  const rendered = await screen.flush();

  assert.equal(getRenderedManifest(rendered)?.statusLabel, 'Sent to Hauler');
  assert.doesNotMatch(screen.text(), /Could not load this waybill/);
  screen.unmount();
});

test('failed SSE refresh during initial loading does not leave the page loading forever', async () => {
  const { screen, manifestRequests } = mountWaybillDetail();
  await screen.flush();
  screen.emit({ type: 'WAYBILL_UPDATE', data: { waybillId: 'WYB-A' } });
  await screen.flush();

  manifestRequests[1].reject(new Error('Refresh failed'));
  await screen.flush();
  manifestRequests[0].resolve(manifest('WYB-A', 'Generated'));
  await screen.flush();

  assert.doesNotMatch(screen.text(), /Loading waybill/);
  screen.unmount();
});

test('missing route ID shows not found after a previous manifest', async () => {
  const { screen, manifestRequests, historyRequests } = mountWaybillDetail();
  await screen.flush();
  manifestRequests[0].resolve(manifest('WYB-A', 'Generated'));
  await screen.flush();
  historyRequests[0].resolve({ data: [] });
  await screen.flush();

  screen.changeRoute({});
  await screen.flush();

  assert.match(screen.text(), /Waybill not found/);
  screen.unmount();
});
