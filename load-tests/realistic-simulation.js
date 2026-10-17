import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const baseUrl = __ENV.BASE_URL || 'http://host.docker.internal:8082';
const password = __ENV.LOADTEST_PASSWORD;

export const options = {
  scenarios: {
    admin_web: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'adminWorkflow',
    },
    mobile_couriers: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 8 },
        { duration: '1m', target: 18 },
        { duration: '30s', target: 0 },
      ],
      exec: 'courierWorkflow',
    },
    mobile_receiving: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'receivingWorkflow',
    },
    mobile_dispatch: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'dispatchWorkflow',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:admin_web}': ['p(95)<1500'],
    'http_req_duration{scenario:mobile_couriers}': ['p(95)<500'],
    'http_req_duration{scenario:mobile_receiving}': ['p(95)<500'],
    'http_req_duration{scenario:mobile_dispatch}': ['p(95)<500'],
  },
};

export function setup() {
  if (!password) throw new Error('LOADTEST_PASSWORD is required');

  // 1. Authenticate Admin via Web Login
  const adminLogin = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify({
    username: 'loadtest-admin',
    password: password,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(adminLogin, { 'admin login succeeded': (r) => r.status === 200 && r.json('token') });
  if (adminLogin.status !== 200 || !adminLogin.json('token')) throw new Error('Admin login failed');

  const courierSession = authenticateMobileStaff('loadtest-field',
    '11111111-1111-1111-1111-111111111111', 'courier');
  const receivingSession = authenticateMobileStaff('loadtest-office',
    '22222222-2222-2222-2222-222222222222', 'receiving');
  const dispatchSession = authenticateMobileStaff('loadtest-dispatch',
    '33333333-3333-3333-3333-333333333333', 'dispatch');

  const logs = http.get(`${baseUrl}/api/v1/tracking-events?page=0&size=100`, {
    headers: { Authorization: `Bearer ${adminLogin.json('token')}` },
  });
  if (logs.status !== 200) throw new Error('Tracking fixture lookup failed');
  const trackingIds = [...new Set(logs.json('content').map((entry) => entry.trackingId))];
  if (!trackingIds.length) throw new Error('Seeded tracking records are required');

  return {
    adminToken: adminLogin.json('token'),
    fieldToken: courierSession.token,
    deviceId: courierSession.deviceId,
    deviceToken: courierSession.deviceToken,
    receivingSession,
    dispatchSession,
    trackingIds,
  };
}

function authenticateMobileStaff(username, deviceId, role) {
  const response = http.post(`${baseUrl}/api/v1/auth/mobile-login`, JSON.stringify({
    username,
    password,
  }), { headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId } });
  check(response, { [`${role} login succeeded`]: (result) => result.status === 200 && result.json('token') });
  if (response.status !== 200) throw new Error(`${role} login failed (${response.status})`);
  const session = response.json();
  if (!session.token || !session.deviceId || !session.deviceToken) {
    throw new Error(`${role} login returned an incomplete device session`);
  }
  return { token: session.token, deviceId: session.deviceId, deviceToken: session.deviceToken };
}

function mobileHeaders(session) {
  return {
    Authorization: `Bearer ${session.token}`,
    'X-Device-Id': session.deviceId,
    'X-Device-Token': session.deviceToken,
  };
}

export function adminWorkflow(data) {
  const headers = { Authorization: `Bearer ${data.adminToken}` };

  const responses = http.batch([
    ['GET', `${baseUrl}/api/v1/dashboard/summary`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/shipments?page=0&size=20`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/clients?page=0&size=20`, null, { headers }],
  ]);

  responses.forEach((res) => check(res, { 'admin request succeeded': (r) => r.status === 200 }));
  sleep(2);
}

export function courierWorkflow(data) {
  runTrackingWorkflow({ token: data.fieldToken, deviceId: data.deviceId, deviceToken: data.deviceToken },
    data.trackingIds, 'courier');
}

export function dispatchWorkflow(data) {
  runTrackingWorkflow(data.dispatchSession, data.trackingIds, 'dispatch');
}

export function receivingWorkflow(data) {
  const headers = mobileHeaders(data.receivingSession);
  const responses = http.batch([
    ['GET', `${baseUrl}/api/v1/shipments?page=0&size=20`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/vehicles`, null, { headers }],
  ]);
  responses.forEach((response) => check(response, { 'receiving request succeeded': (result) => result.status === 200 }));
  sleep(1);
}

function runTrackingWorkflow(session, trackingIds, role) {
  const headers = mobileHeaders(session);
  const trackingId = trackingIds[Math.floor(Math.random() * trackingIds.length)];

  const responses = http.batch([
    ['GET', `${baseUrl}/api/v1/tracking-events/mine/metrics`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/tracking-events/mine?page=0&size=20`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/tracking-events/scan-context/${trackingId}`, null, { headers }],
  ]);

  responses.forEach((res) => check(res, { [`${role} request succeeded`]: (r) => r.status === 200 }));
  sleep(1);
}

export function handleSummary(data) {
  const sanitized = { ...data };
  delete sanitized.setup_data;
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
