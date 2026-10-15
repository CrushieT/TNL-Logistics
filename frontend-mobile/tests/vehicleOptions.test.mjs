import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VEHICLE_OPTION_PAGE_SIZE,
  VEHICLE_RECOMMENDATION_SIZE,
  appendUniqueVehicleOptions,
  buildVehicleOptionParams,
  createVehicleOptionRequestCoordinator,
  hasNextVehicleOptionPage,
  normalizeVehicleSearch
} from '../src/features/scanner/vehicleOptionsFlow.mjs';

function mountSingleReviewVehicleLoader(listVehicleOptions) {
  const source = readFileSync(new URL('../src/app/(main)/scan.js', import.meta.url), 'utf8').replace(/\r/g, '');
  const loaderSource = source.slice(source.indexOf('  const loadRecentVehicleOptions ='), source.indexOf('  const loadNextVehicleOptions ='));
  const effectSource = source.slice(source.indexOf('  // When in SINGLE review'), source.indexOf('  const handleToggleTorch ='));
  let previousDependencies;
  let pendingRequest;
  let requestCount = 0;
  const environment = {
    connectivity: { isOnline: true },
    user: { role: 'COURIER_STAFF' },
    state: {
      mode: 'SINGLE',
      phase: 'SINGLE_REVIEW',
      currentContext: { requiresVehicle: true, nextStatusCode: 'LOADED_ON_TRUCK' }
    },
    SCANNER_MODES: { SINGLE: 'SINGLE' },
    SCANNER_PHASES: { SINGLE_REVIEW: 'SINGLE_REVIEW' },
    vehicles: [],
    loadingVehicles: false,
    hasLoadedVehicleOptions: false,
    vehicleLoadError: '',
    vehicleOptionCoordinatorRef: { current: createVehicleOptionRequestCoordinator() },
    isRoleTransitionAllowed: (role) => role === 'COURIER_STAFF',
    VEHICLE_OPTION_PAGE_SIZE,
    appendUniqueVehicleOptions,
    hasNextVehicleOptionPage,
    trackingScanApi: {
      listVehicleOptions(options) {
        requestCount += 1;
        return listVehicleOptions(options);
      }
    },
    useCallback: callback => callback,
    useEffect(callback, dependencies) {
      if (!previousDependencies || dependencies.some((value, index) => value !== previousDependencies[index])) {
        previousDependencies = dependencies;
        callback();
      }
    }
  };
  for (const setter of new Set(loaderSource.match(/\bset[A-Z]\w*/g))) {
    const property = setter[3].toLowerCase() + setter.slice(4);
    environment[setter] = value => { environment[property] = value; };
  }
  const loader = new Function('environment', `with (environment) { ${loaderSource} return loadRecentVehicleOptions; }`)(environment);
  environment.loadRecentVehicleOptions = () => {
    pendingRequest = loader();
    return pendingRequest;
  };
  const renderEffect = new Function('environment', `with (environment) { ${effectSource} }`);
  return {
    environment,
    get requestCount() { return requestCount; },
    retry: environment.loadRecentVehicleOptions,
    async renderCycles(count = 5) {
      for (let cycle = 0; cycle < count; cycle++) {
        renderEffect(environment);
        renderEffect(environment);
        await pendingRequest;
      }
    }
  };
}

describe('Single-scan vehicle loading effect', () => {
  const emptyPage = { content: [], number: 0, last: true, empty: true };

  it('loads an empty fleet once instead of refetching when loading completes', async () => {
    const screen = mountSingleReviewVehicleLoader(async () => emptyPage);
    await screen.renderCycles();
    assert.equal(screen.requestCount, 1);
    assert.equal(screen.environment.hasLoadedVehicleOptions, true);
    assert.deepEqual(screen.environment.vehicles, []);
    assert.equal(screen.environment.loadingVehicles, false);
  });

  it('allows an explicit retry after an empty response to load newly available vehicles', async () => {
    let page = emptyPage;
    const screen = mountSingleReviewVehicleLoader(async () => page);
    await screen.renderCycles();
    page = { content: [{ vehicleId: 'VH-001' }], number: 0, last: true };
    await screen.retry();
    await screen.renderCycles();
    assert.equal(screen.requestCount, 2);
    assert.equal(screen.environment.vehicles[0].vehicleId, 'VH-001');
  });

  it('keeps a failed load retryable without automatically repeating requests', async () => {
    const screen = mountSingleReviewVehicleLoader(async () => { throw new Error('Unavailable'); });
    await screen.renderCycles();
    assert.equal(screen.requestCount, 1);
    assert.equal(screen.environment.hasLoadedVehicleOptions, false);
    assert.equal(screen.environment.vehicleLoadError, 'Unable to load active vehicles.');
    screen.environment.trackingScanApi.listVehicleOptions = async () => emptyPage;
    await screen.retry();
    await screen.renderCycles();
    assert.equal(screen.environment.hasLoadedVehicleOptions, true);
    assert.equal(screen.environment.vehicleLoadError, '');
  });

  it('does not mark an offline skip as loaded and permits loading after reconnecting', async () => {
    const screen = mountSingleReviewVehicleLoader(async () => emptyPage);
    screen.environment.connectivity.isOnline = false;
    await screen.renderCycles();
    assert.equal(screen.requestCount, 0);
    assert.equal(screen.environment.hasLoadedVehicleOptions, false);
    screen.environment.connectivity.isOnline = true;
    await screen.retry();
    await screen.renderCycles();
    assert.equal(screen.requestCount, 1);
  });
});

describe('Courier vehicle option pagination', () => {
  it('uses the 20-item page default and bounds invalid pagination input', () => {
    assert.equal(VEHICLE_OPTION_PAGE_SIZE, 20);
    assert.deepEqual(buildVehicleOptionParams(), { page: 0, size: 20 });
    assert.deepEqual(buildVehicleOptionParams({ page: -2, size: 500 }), { page: 0, size: 100 });
    assert.deepEqual(buildVehicleOptionParams({ page: 2, size: 0 }), { page: 2, size: 1 });
  });

  it('normalizes vehicle searches and includes only non-empty queries', () => {
    assert.equal(normalizeVehicleSearch('  abc-1234  '), 'ABC-1234');
    assert.equal(normalizeVehicleSearch('   '), '');
    assert.deepEqual(
      buildVehicleOptionParams({ search: '  vh-001  ', size: VEHICLE_RECOMMENDATION_SIZE }),
      { page: 0, size: 8, search: 'VH-001' }
    );
  });

  it('appends pages without duplicate vehicle IDs and preserves server order', () => {
    const merged = appendUniqueVehicleOptions(
      [{ vehicleId: 'VH-003', plateNumber: 'CCC' }, { vehicleId: 'VH-002', plateNumber: 'BBB' }],
      [{ vehicleId: 'VH-002', plateNumber: 'BBB' }, { vehicleId: 'VH-001', plateNumber: 'AAA' }, null]
    );
    assert.deepEqual(merged.map((option) => option.vehicleId), ['VH-003', 'VH-002', 'VH-001']);
  });

  it('detects the final page from Spring page metadata', () => {
    assert.equal(hasNextVehicleOptionPage({ number: 0, totalPages: 2, last: false, empty: false }), true);
    assert.equal(hasNextVehicleOptionPage({ number: 1, totalPages: 2, last: true, empty: false }), false);
    assert.equal(hasNextVehicleOptionPage({ number: 0, totalPages: 0, empty: true }), false);
  });
});

describe('Courier vehicle option request coordination', () => {
  it('blocks concurrent end-of-list requests until the active request finishes', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const nextPage = coordinator.beginNextPage();
    assert.equal(coordinator.beginNextPage(), null);
    assert.equal(coordinator.finish(nextPage), true);
    assert.notEqual(coordinator.beginNextPage(), null);
  });

  it('invalidates stale recommendation responses when the query changes', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const stale = coordinator.beginRecommendation('ab');
    const current = coordinator.beginRecommendation('abc');

    assert.equal(stale.signal.aborted, true);
    assert.equal(coordinator.isCurrent(stale), false);
    assert.equal(coordinator.isCurrent(current), true);
    assert.equal(current.query, 'ABC');
  });

  it('starting a first page cancels pagination and cancelAll invalidates every request', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const pagination = coordinator.beginNextPage();
    const firstPage = coordinator.beginFirstPage();
    const recommendation = coordinator.beginRecommendation('VH-001');

    assert.equal(pagination.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), true);
    coordinator.cancelAll();
    assert.equal(firstPage.signal.aborted, true);
    assert.equal(recommendation.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), false);
    assert.equal(coordinator.isCurrent(recommendation), false);
  });
});
