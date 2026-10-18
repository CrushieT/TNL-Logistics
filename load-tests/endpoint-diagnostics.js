import http from 'k6/http';
import { check, sleep } from 'k6';
import { setup as authenticate } from './realistic-simulation.js';

const baseUrl = __ENV.BASE_URL || 'http://host.docker.internal:8080';
const endpoints = ['history', 'metrics', 'scan_context', 'dashboard', 'shipments', 'clients', 'tracking_logs', 'history_empty_status', 'history_status', 'history_search'];
const selected = __ENV.ENDPOINT ? [__ENV.ENDPOINT] : endpoints;
export const options = {
  vus: 1,
  iterations: Number(__ENV.SAMPLES || 10),
  setupTimeout: '180s',
  thresholds: Object.fromEntries(selected.map(endpoint => [`http_req_duration{endpoint:${endpoint}}`, ['p(95)<1500']])),
};

export function setup() {
  if (selected.some(endpoint => !endpoints.includes(endpoint))) throw new Error('Unknown ENDPOINT');
  const data = authenticate();
  // Discard an identical warm-up pass before collecting samples.
  requestEndpoints(data, false);
  return data;
}

function requestEndpoints(data, measured) {
  const adminHeaders = { Authorization: `Bearer ${data.adminToken}` };
  const courierHeaders = {
    Authorization: `Bearer ${data.fieldToken}`,
    'X-Device-Id': data.deviceId,
    'X-Device-Token': data.deviceToken,
  };
  const paths = {
    history: '/tracking-events/mine?page=0&size=20',
    metrics: '/tracking-events/mine/metrics',
    scan_context: `/tracking-events/scan-context/${data.trackingIds[0]}`,
    dashboard: '/dashboard/summary',
    shipments: '/shipments?page=0&size=20',
    clients: '/clients?page=0&size=20',
    tracking_logs: '/tracking-events?page=0&size=100',
    history_empty_status: '/tracking-events/mine?status=REGISTERED&page=0&size=20',
    history_status: '/tracking-events/mine?status=LOADED_ON_TRUCK&page=0&size=20',
    history_search: `/tracking-events/mine?search=${encodeURIComponent(data.trackingIds[0].toLowerCase())}&page=0&size=20`,
  };
  for (const endpoint of selected) {
    const isCourier = endpoint.startsWith('history') || endpoint === 'metrics' || endpoint === 'scan_context';
    const response = http.get(`${baseUrl}/api/v1${paths[endpoint]}`, {
      headers: isCourier ? courierHeaders : adminHeaders,
      tags: { endpoint: measured ? endpoint : 'warmup', name: endpoint },
    });
    check(response, { [`${endpoint} succeeded`]: result => result.status === 200 });
  }
}

export default function(data) {
  requestEndpoints(data, true);
  sleep(1);
}

export function handleSummary(data) {
  // Allow-list summary fields: setup_data contains tokens and must never be exported.
  const sanitized = { metrics: data.metrics, state: data.state };
  return { [__ENV.SUMMARY_PATH || '/scripts/results/endpoint-diagnostics.json']: JSON.stringify(sanitized, null, 2) };
}
