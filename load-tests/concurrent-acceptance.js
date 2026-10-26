import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';

// Global configuration from environment
const baseUrl = __ENV.BASE_URL || 'http://host.docker.internal:8080';
const password = __ENV.LOADTEST_PASSWORD;
const courierVUs = Number(__ENV.COURIER_VUS || 5); // 5 for Normal, 9 for Peak
const warmupDurationSec = Number(__ENV.WARMUP_SECONDS || 60);
const measuredDurationSec = Number(__ENV.MEASURED_SECONDS || 600);
const totalDurationSec = warmupDurationSec + measuredDurationSec;
const summaryPath = __ENV.SUMMARY_PATH || './load-tests/results/acceptance-summary.json';

// Acceptance metrics
const sampleCounter = new Counter('acceptance_samples');
const timeoutCounter = new Counter('acceptance_timeouts');

export const options = {
  scenarios: {
    admin_flow: {
      executor: 'constant-vus',
      vus: 1,
      duration: `${totalDurationSec}s`,
      gracefulStop: '5s',
      exec: 'adminWorkflow',
    },
    receiving_flow: {
      executor: 'constant-vus',
      vus: 1,
      duration: `${totalDurationSec}s`,
      gracefulStop: '5s',
      exec: 'receivingWorkflow',
    },
    dispatch_flow: {
      executor: 'constant-vus',
      vus: 1,
      duration: `${totalDurationSec}s`,
      gracefulStop: '5s',
      exec: 'dispatchWorkflow',
    },
    hot_courier_flow: {
      executor: 'constant-vus',
      vus: 1,
      duration: `${totalDurationSec}s`,
      gracefulStop: '5s',
      exec: 'hotCourierWorkflow',
    },
    courier_flow: {
      executor: 'constant-vus',
      vus: Math.max(1, courierVUs - 1),
      duration: `${totalDurationSec}s`,
      gracefulStop: '5s',
      exec: 'courierWorkflow',
    },
  },
  thresholds: {
    'http_req_failed{phase:measured}': ['rate<0.01'],
    'acceptance_timeouts{phase:measured}': ['count==0'],
    'http_req_duration{phase:measured,endpoint:dashboard_summary}': ['p(95)<1500'],
    'http_req_duration{phase:measured,endpoint:tracking_logs}': ['p(95)<1500'],
    'http_req_duration{phase:measured,endpoint:tracking_metrics}': ['p(95)<1500'],
    'http_req_duration{phase:measured,endpoint:tracking_search_selective}': ['p(95)<1500'],
    'http_req_duration{phase:measured,endpoint:weekly_collections}': ['p(95)<1500'],
    'http_req_duration{phase:measured,endpoint:reports_default_month}': ['p(95)<5000'],
    'http_req_duration{phase:measured,endpoint:reports_full_range}': ['p(95)<5000'],
    'http_req_duration{phase:measured,role:receiving}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:receiving_shipments}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:receiving_vehicles}': ['p(95)<500'],
    'http_req_duration{phase:measured,role:dispatch}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:dispatch_metrics}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:dispatch_history}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:dispatch_scan_context}': ['p(95)<500'],
    'http_req_duration{phase:measured,role:courier}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:courier_metrics}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:courier_history}': ['p(95)<500'],
    'http_req_duration{phase:measured,endpoint:courier_scan_context}': ['p(95)<500'],
    'http_req_duration{phase:measured,hot_history:true}': ['p(95)<500'],
    'acceptance_samples{endpoint:dashboard_summary}': ['count>=0'],
    'acceptance_samples{endpoint:tracking_logs}': ['count>=0'],
    'acceptance_samples{endpoint:tracking_metrics}': ['count>=0'],
    'acceptance_samples{endpoint:tracking_search_selective}': ['count>=0'],
    'acceptance_samples{endpoint:weekly_collections}': ['count>=0'],
    'acceptance_samples{endpoint:reports_default_month}': ['count>=0'],
    'acceptance_samples{endpoint:reports_full_range}': ['count>=0'],
    'acceptance_samples{endpoint:receiving_shipments}': ['count>=0'],
    'acceptance_samples{endpoint:receiving_vehicles}': ['count>=0'],
    'acceptance_samples{endpoint:dispatch_metrics}': ['count>=0'],
    'acceptance_samples{endpoint:dispatch_history}': ['count>=0'],
    'acceptance_samples{endpoint:dispatch_scan_context}': ['count>=0'],
    'acceptance_samples{endpoint:courier_metrics}': ['count>=0'],
    'acceptance_samples{endpoint:courier_history}': ['count>=0'],
    'acceptance_samples{endpoint:courier_scan_context}': ['count>=0'],
    'acceptance_samples{hot_history:true}': ['count>=0'],
    'acceptance_samples{role:receiving}': ['count>=0'],
    'acceptance_samples{role:dispatch}': ['count>=0'],
    'acceptance_samples{role:courier}': ['count>=0'],
  },
};

export function setup() {
  if (!password) {
    throw new Error('[setup] LOADTEST_PASSWORD environment variable is required');
  }
  console.log(`[setup] Starting acceptance setup against ${baseUrl} (courierVUs=${courierVUs})...`);

  // 1. Admin login
  const adminRes = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify({
    username: 'loadtest-admin',
    password: password,
  }), { headers: { 'Content-Type': 'application/json' }, timeout: '15s' });

  if (adminRes.status !== 200 || !adminRes.json('token')) {
    throw new Error(`[setup] Admin login failed with status ${adminRes.status}`);
  }
  const adminToken = adminRes.json('token');

  // 2. Mobile Receiving login
  const receivingSession = authenticateMobile('loadtest-office', '22222222-2222-2222-2222-222222222222', 'receiving');

  // 3. Mobile Dispatch login
  const dispatchSession = authenticateMobile('loadtest-dispatch', '33333333-3333-3333-3333-333333333333', 'dispatch');

  // 4. Hot-history courier: LT-FIELD
  const hotCourierSession = authenticateMobile('loadtest-field', '11111111-1111-1111-1111-111111111111', 'hot_courier');
  hotCourierSession.isHot = true;

  // 5. Distinct synthetic couriers
  const syntheticCourierSessions = [];
  for (let i = 1; i <= 8; i++) {
    const username = `loadtest-courier-${i}`;
    const deviceId = `44444444-4444-4444-4444-00000000000${i}`;
    const session = authenticateMobile(username, deviceId, `courier_${i}`);
    session.isHot = false;
    syntheticCourierSessions.push(session);
  }
  const courierSessions = [hotCourierSession, ...syntheticCourierSessions];

  // 6. Discover sample tracking IDs for scan-context reads
  const logsRes = http.get(`${baseUrl}/api/v1/tracking-events?page=0&size=100`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    timeout: '15s',
  });
  if (logsRes.status !== 200) {
    throw new Error(`[setup] Tracking logs fixture lookup failed: status ${logsRes.status}`);
  }
  const content = logsRes.json('content') || [];
  const trackingIds = [...new Set(content.map((entry) => entry.trackingId).filter(Boolean))];
  if (trackingIds.length === 0) {
    throw new Error('[setup] No tracking IDs found in database fixtures');
  }

  console.log(`[setup] Setup complete. Discovered ${trackingIds.length} sample tracking IDs.`);
  console.log(`[setup] Active courier sessions: ${courierSessions.length} (exercising ${courierVUs} for this run).`);

  return {
    adminToken,
    receivingSession,
    dispatchSession,
    hotCourierSession,
    syntheticCourierSessions,
    courierSessions,
    trackingIds,
    startTime: Date.now(),
    warmupDurationMs: warmupDurationSec * 1000,
  };
}

function authenticateMobile(username, deviceId, roleLabel) {
  const res = http.post(`${baseUrl}/api/v1/auth/mobile-login`, JSON.stringify({
    username,
    password,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
    },
    timeout: '15s',
  });

  if (res.status !== 200 || !res.json('token')) {
    throw new Error(`[setup] ${roleLabel} (${username}) mobile login failed: status ${res.status}`);
  }

  const json = res.json();
  return {
    username,
    token: json.token,
    deviceId: json.deviceId || deviceId,
    deviceToken: json.deviceToken,
  };
}

function mobileHeaders(session) {
  return {
    Authorization: `Bearer ${session.token}`,
    'X-Device-Id': session.deviceId,
    'X-Device-Token': session.deviceToken,
  };
}

function getPhase(setupData) {
  return Date.now() < (setupData.startTime + setupData.warmupDurationMs) ? 'warmup' : 'measured';
}

function execGet(url, headers, endpoint, role, dateRange, hotHistory, data) {
  const phase = getPhase(data);
  const hotStr = hotHistory ? 'true' : 'false';
  const rangeStr = dateRange || 'none';
  const tags = {
    endpoint,
    role,
    date_range: rangeStr,
    hot_history: hotStr,
    phase,
  };

  const res = http.get(url, { headers, tags, timeout: '15s' });

  if (phase === 'measured') {
    sampleCounter.add(1, { endpoint });
    sampleCounter.add(1, { role });
    if (hotHistory) {
      sampleCounter.add(1, { hot_history: 'true' });
    }
    if (res.status === 0 || res.timings.duration >= 15000) {
      timeoutCounter.add(1, { phase: 'measured' });
    }
  }

  return res;
}

// ----------------------------------------------------
// Admin Workflow:
// Rotates Dashboard, Tracking Logs & metrics, selective Tracking Logs search,
// Weekly Collections, Reports default month, Reports full range,
// with 2-second pauses between completed page visits.
// ----------------------------------------------------
export function adminWorkflow(data) {
  const headers = { Authorization: `Bearer ${data.adminToken}` };

  // Page 1: Dashboard
  {
    const res = execGet(`${baseUrl}/api/v1/dashboard/summary`, headers, 'dashboard_summary', 'admin', 'none', false, data);
    check(res, { 'dashboard succeeded': (r) => r.status === 200 });
    sleep(2);
  }

  // Page 2: Tracking Logs and metrics
  {
    const resLogs = execGet(`${baseUrl}/api/v1/tracking-events?page=0&size=25`, headers, 'tracking_logs', 'admin', 'none', false, data);
    check(resLogs, { 'tracking logs succeeded': (r) => r.status === 200 });

    const resMetrics = execGet(`${baseUrl}/api/v1/tracking-events/metrics`, headers, 'tracking_metrics', 'admin', 'none', false, data);
    check(resMetrics, { 'tracking metrics succeeded': (r) => r.status === 200 });
    sleep(2);
  }

  // Page 3: Selective Tracking Logs search
  {
    const res = execGet(`${baseUrl}/api/v1/tracking-events?page=0&size=25&search=TRK-2026-1`, headers, 'tracking_search_selective', 'admin', 'none', false, data);
    check(res, { 'selective tracking search succeeded': (r) => r.status === 200 });
    sleep(2);
  }

  // Page 4: Weekly Collections
  {
    const res = execGet(`${baseUrl}/api/v1/collections/weekly`, headers, 'weekly_collections', 'admin', 'none', false, data);
    check(res, { 'weekly collections succeeded': (r) => r.status === 200 });
    sleep(2);
  }

  // Page 5: Reports default month (Oct 1 - Oct 31, 2026)
  {
    const res = execGet(`${baseUrl}/api/v1/reports/summary?startDate=2026-10-01&endDate=2026-10-31`, headers, 'reports_default_month', 'admin', 'default_month', false, data);
    check(res, { 'reports default month succeeded': (r) => r.status === 200 });
    sleep(2);
  }

  // Page 6: Reports full seeded range (Jan 1 - Oct 17, 2026)
  {
    const res = execGet(`${baseUrl}/api/v1/reports/summary?startDate=2026-01-01&endDate=2026-10-17`, headers, 'reports_full_range', 'admin', 'full_range', false, data);
    check(res, { 'reports full range succeeded': (r) => r.status === 200 });
    sleep(2);
  }
}

// ----------------------------------------------------
// Receiving Workflow:
// Authorized operational reads with 10-second pauses.
// ----------------------------------------------------
export function receivingWorkflow(data) {
  const headers = mobileHeaders(data.receivingSession);

  const resShipments = execGet(`${baseUrl}/api/v1/shipments?page=0&size=20`, headers, 'receiving_shipments', 'receiving', 'none', false, data);
  check(resShipments, { 'receiving shipments succeeded': (r) => r.status === 200 });

  const resVehicles = execGet(`${baseUrl}/api/v1/vehicles`, headers, 'receiving_vehicles', 'receiving', 'none', false, data);
  check(resVehicles, { 'receiving vehicles succeeded': (r) => r.status === 200 });

  sleep(10);
}

// ----------------------------------------------------
// Dispatch Workflow:
// Authorized operational reads with 10-second pauses.
// ----------------------------------------------------
export function dispatchWorkflow(data) {
  const headers = mobileHeaders(data.dispatchSession);
  const trackingId = data.trackingIds[Math.floor(Math.random() * data.trackingIds.length)];

  const resMetrics = execGet(`${baseUrl}/api/v1/tracking-events/mine/metrics`, headers, 'dispatch_metrics', 'dispatch', 'none', false, data);
  check(resMetrics, { 'dispatch metrics succeeded': (r) => r.status === 200 });

  const resHistory = execGet(`${baseUrl}/api/v1/tracking-events/mine?page=0&size=20`, headers, 'dispatch_history', 'dispatch', 'none', false, data);
  check(resHistory, { 'dispatch history succeeded': (r) => r.status === 200 });

  const resContext = execGet(`${baseUrl}/api/v1/tracking-events/scan-context/${trackingId}`, headers, 'dispatch_scan_context', 'dispatch', 'none', false, data);
  check(resContext, { 'dispatch scan context succeeded': (r) => r.status === 200 });

  sleep(10);
}

// ----------------------------------------------------
// Hot-History Courier Workflow:
// Dedicated VU for LT-FIELD with 10-second pauses.
// ----------------------------------------------------
export function hotCourierWorkflow(data) {
  const session = data.hotCourierSession;
  const headers = mobileHeaders(session);
  const trackingId = data.trackingIds[Math.floor(Math.random() * data.trackingIds.length)];

  const resMetrics = execGet(`${baseUrl}/api/v1/tracking-events/mine/metrics`, headers, 'courier_metrics', 'courier', 'none', true, data);
  check(resMetrics, { 'hot courier metrics succeeded': (r) => r.status === 200 });

  const resHistory = execGet(`${baseUrl}/api/v1/tracking-events/mine?page=0&size=20`, headers, 'courier_history', 'courier', 'none', true, data);
  check(resHistory, { 'hot courier history succeeded': (r) => r.status === 200 });

  const resContext = execGet(`${baseUrl}/api/v1/tracking-events/scan-context/${trackingId}`, headers, 'courier_scan_context', 'courier', 'none', true, data);
  check(resContext, { 'hot courier scan context succeeded': (r) => r.status === 200 });

  sleep(10);
}

// ----------------------------------------------------
// Synthetic Courier Workflow:
// Distinct synthetic courier sessions with 10-second pauses.
// ----------------------------------------------------
export function courierWorkflow(data) {
  const vuIndex = (__VU - 1) % data.syntheticCourierSessions.length;
  const session = data.syntheticCourierSessions[vuIndex] || data.syntheticCourierSessions[0];
  const headers = mobileHeaders(session);
  const trackingId = data.trackingIds[Math.floor(Math.random() * data.trackingIds.length)];

  const resMetrics = execGet(`${baseUrl}/api/v1/tracking-events/mine/metrics`, headers, 'courier_metrics', 'courier', 'none', false, data);
  check(resMetrics, { 'courier metrics succeeded': (r) => r.status === 200 });

  const resHistory = execGet(`${baseUrl}/api/v1/tracking-events/mine?page=0&size=20`, headers, 'courier_history', 'courier', 'none', false, data);
  check(resHistory, { 'courier history succeeded': (r) => r.status === 200 });

  const resContext = execGet(`${baseUrl}/api/v1/tracking-events/scan-context/${trackingId}`, headers, 'courier_scan_context', 'courier', 'none', false, data);
  check(resContext, { 'courier scan context succeeded': (r) => r.status === 200 });

  sleep(10);
}

// ----------------------------------------------------
// Summary and Sanitization:
// Excludes credentials and setup tokens from saved files.
// Computes and reports sample count, p95, failed rate, and timeouts
// for each tagged endpoint, role, date range, and hot-history status.
// ----------------------------------------------------
export function handleSummary(data) {
  // Deep clone and sanitize setup data
  const sanitized = {
    metrics: data.metrics,
    root_group: data.root_group,
  };

  const output = {};
  output[summaryPath] = JSON.stringify(sanitized, null, 2);

  // Targets definition
  const targets = [
    { name: 'Dashboard Summary', durKey: 'http_req_duration{endpoint:dashboard_summary,phase:measured}', cntKey: 'acceptance_samples{endpoint:dashboard_summary}', limitMs: 1500 },
    { name: 'Tracking Logs Page 0', durKey: 'http_req_duration{endpoint:tracking_logs,phase:measured}', cntKey: 'acceptance_samples{endpoint:tracking_logs}', limitMs: 1500 },
    { name: 'Tracking Metrics (Day)', durKey: 'http_req_duration{endpoint:tracking_metrics,phase:measured}', cntKey: 'acceptance_samples{endpoint:tracking_metrics}', limitMs: 1500 },
    { name: 'Selective Tracking Search', durKey: 'http_req_duration{endpoint:tracking_search_selective,phase:measured}', cntKey: 'acceptance_samples{endpoint:tracking_search_selective}', limitMs: 1500 },
    { name: 'Weekly Collections', durKey: 'http_req_duration{endpoint:weekly_collections,phase:measured}', cntKey: 'acceptance_samples{endpoint:weekly_collections}', limitMs: 1500 },
    { name: 'Reports Default Month', durKey: 'http_req_duration{endpoint:reports_default_month,phase:measured}', cntKey: 'acceptance_samples{endpoint:reports_default_month}', limitMs: 5000 },
    { name: 'Reports Full Seeded Range', durKey: 'http_req_duration{endpoint:reports_full_range,phase:measured}', cntKey: 'acceptance_samples{endpoint:reports_full_range}', limitMs: 5000 },
    { name: 'Role: Receiving (Aggregate)', durKey: 'http_req_duration{phase:measured,role:receiving}', cntKey: 'acceptance_samples{role:receiving}', limitMs: 500 },
    { name: '  - Receiving Shipments', durKey: 'http_req_duration{endpoint:receiving_shipments,phase:measured}', cntKey: 'acceptance_samples{endpoint:receiving_shipments}', limitMs: 500 },
    { name: '  - Receiving Vehicles', durKey: 'http_req_duration{endpoint:receiving_vehicles,phase:measured}', cntKey: 'acceptance_samples{endpoint:receiving_vehicles}', limitMs: 500 },
    { name: 'Role: Dispatch (Aggregate)', durKey: 'http_req_duration{phase:measured,role:dispatch}', cntKey: 'acceptance_samples{role:dispatch}', limitMs: 500 },
    { name: '  - Dispatch Metrics', durKey: 'http_req_duration{endpoint:dispatch_metrics,phase:measured}', cntKey: 'acceptance_samples{endpoint:dispatch_metrics}', limitMs: 500 },
    { name: '  - Dispatch History', durKey: 'http_req_duration{endpoint:dispatch_history,phase:measured}', cntKey: 'acceptance_samples{endpoint:dispatch_history}', limitMs: 500 },
    { name: '  - Dispatch Scan Context', durKey: 'http_req_duration{endpoint:dispatch_scan_context,phase:measured}', cntKey: 'acceptance_samples{endpoint:dispatch_scan_context}', limitMs: 500 },
    { name: 'Role: Courier (Aggregate)', durKey: 'http_req_duration{phase:measured,role:courier}', cntKey: 'acceptance_samples{role:courier}', limitMs: 500 },
    { name: '  - Courier Metrics', durKey: 'http_req_duration{endpoint:courier_metrics,phase:measured}', cntKey: 'acceptance_samples{endpoint:courier_metrics}', limitMs: 500 },
    { name: '  - Courier History', durKey: 'http_req_duration{endpoint:courier_history,phase:measured}', cntKey: 'acceptance_samples{endpoint:courier_history}', limitMs: 500 },
    { name: '  - Courier Scan Context', durKey: 'http_req_duration{endpoint:courier_scan_context,phase:measured}', cntKey: 'acceptance_samples{endpoint:courier_scan_context}', limitMs: 500 },
    { name: 'Hot History (LT-FIELD)', durKey: 'http_req_duration{hot_history:true,phase:measured}', cntKey: 'acceptance_samples{hot_history:true}', limitMs: 500 },
  ];

  let consoleSummary = '\n====================================================================================================\n';
  consoleSummary += '                             CONCURRENT PERFORMANCE ACCEPTANCE RESULTS                              \n';
  consoleSummary += '====================================================================================================\n';
  consoleSummary += `${'Target / Endpoint Name'.padEnd(32)} | ${'Samples'.padStart(8)} | ${'Target'.padStart(10)} | ${'p(95) ms'.padStart(10)} | ${'Gate Status'.padStart(14)}\n`;
  consoleSummary += '----------------------------------------------------------------------------------------------------\n';

  const metrics = data.metrics || {};

  function findMetric(key) {
    if (metrics[key]) return metrics[key];
    // Find normalized tag match
    for (const [k, v] of Object.entries(metrics)) {
      if (k.startsWith(key.split('{')[0])) {
        const expectedTags = key.match(/\{([^}]+)\}/);
        if (expectedTags) {
          const pairs = expectedTags[1].split(',').map((p) => p.trim());
          if (pairs.every((pair) => k.includes(pair))) return v;
        }
      }
    }
    return null;
  }

  for (const t of targets) {
    const durMetric = findMetric(t.durKey);
    const cntMetric = findMetric(t.cntKey);

    const count = cntMetric && cntMetric.values && cntMetric.values.count !== undefined ? cntMetric.values.count : 0;
    const p95 = durMetric && durMetric.values && durMetric.values['p(95)'] !== undefined ? durMetric.values['p(95)'] : null;
    const p95Str = p95 !== null ? p95.toFixed(1) : '-';

    let status = 'PASS';
    if (count < 30) {
      status = 'INSUFFICIENT';
    } else if (p95 === null || p95 > t.limitMs) {
      status = 'FAIL';
    }

    consoleSummary += `${t.name.padEnd(32)} | ${String(count).padStart(8)} | ${('< ' + t.limitMs + 'ms').padStart(10)} | ${p95Str.padStart(10)} | ${status.padStart(14)}\n`;
  }

  consoleSummary += '====================================================================================================\n';

  // Overall failure rate and timeouts
  const failMetric = findMetric('http_req_failed{phase:measured}');
  const failRate = failMetric && failMetric.values && failMetric.values.rate !== undefined ? (failMetric.values.rate * 100).toFixed(2) + '%' : '0.00%';
  const timeoutMetric = findMetric('acceptance_timeouts{phase:measured}');
  const timeouts = timeoutMetric && timeoutMetric.values && timeoutMetric.values.count !== undefined ? timeoutMetric.values.count : 0;

  consoleSummary += `Overall Measured Failure Rate : ${failRate} (Threshold: < 1.00%)\n`;
  consoleSummary += `Total 15s Client Timeouts     : ${timeouts} (Threshold: 0)\n`;
  consoleSummary += '====================================================================================================\n';

  output['stdout'] = consoleSummary;
  return output;
}
