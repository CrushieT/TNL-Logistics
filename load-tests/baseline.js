import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const baseUrl = __ENV.BASE_URL || 'http://host.docker.internal:8082';
const username = __ENV.LOADTEST_USERNAME || 'loadtest-admin';
const password = __ENV.LOADTEST_PASSWORD;

export const options = {
  stages: [
    { duration: '1m', target: 1 },
    { duration: '2m', target: 10 },
    { duration: '5m', target: 25 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

export function setup() {
  if (!password) throw new Error('LOADTEST_PASSWORD is required');
  const response = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify({ username, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(response, { 'login succeeded': (result) => result.status === 200 && result.json('token') });
  return { token: response.json('token') };
}

export default function (data) {
  const parameters = { headers: { Authorization: `Bearer ${data.token}` } };
  const requests = [
    ['GET', `${baseUrl}/api/v1/dashboard/summary`, null, parameters],
    ['GET', `${baseUrl}/api/v1/shipments?page=0&size=20`, null, parameters],
    ['GET', `${baseUrl}/api/v1/shipments?page=0&size=20&paymentStatus=UNPAID`, null, parameters],
    ['GET', `${baseUrl}/api/v1/clients?page=0&size=20`, null, parameters],
    ['GET', `${baseUrl}/api/v1/vehicles`, null, parameters],
    ['GET', `${baseUrl}/api/v1/tracking-events?page=0&size=25`, null, parameters],
  ];
  http.batch(requests).forEach((response) => check(response, { 'request succeeded': (result) => result.status === 200 }));
  sleep(1);
}

export function handleSummary(data) {
  const sanitized = { ...data };
  delete sanitized.setup_data;
  return {
    '/scripts/results/baseline-summary.json': JSON.stringify(sanitized, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
