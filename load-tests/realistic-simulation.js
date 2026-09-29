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
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'courierWorkflow',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:admin_web}': ['p(95)<1500'],
    'http_req_duration{scenario:mobile_couriers}': ['p(95)<500'],
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

  // 2. Authenticate Field Staff via Mobile Login (Phase 6.9 role separation)
  const fieldLogin = http.post(`${baseUrl}/api/v1/auth/mobile-login`, JSON.stringify({
    username: 'loadtest-field',
    password: password,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': '11111111-1111-1111-1111-111111111111',
    },
  });

  check(fieldLogin, { 'field login succeeded': (r) => r.status === 200 && r.json('token') });

  return {
    adminToken: adminLogin.json('token'),
    fieldToken: fieldLogin.json('token'),
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
  const headers = { Authorization: `Bearer ${data.fieldToken}` };

  const responses = http.batch([
    ['GET', `${baseUrl}/api/v1/tracking-events/mine/metrics`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/tracking-events/mine?page=0&size=20`, null, { headers }],
    ['GET', `${baseUrl}/api/v1/tracking-events/scan-context/TRK-LT-00000001-01`, null, { headers }],
  ]);

  responses.forEach((res) => check(res, { 'courier request succeeded': (r) => r.status === 200 }));
  sleep(1);
}

export function handleSummary(data) {
  const sanitized = { ...data };
  delete sanitized.setup_data;
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
