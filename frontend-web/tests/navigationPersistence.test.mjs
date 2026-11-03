import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveSectionRoute,
  getSectionRoute,
  clearSectionRoute,
  savePageState,
  getPageState,
  clearPageState,
  clearAllNavigationState,
} from '../src/services/navigation/navigationState.mjs';
import { useSavedPageState } from '../src/services/navigation/useSavedPageState.js';

describe('Navigation & Directory Filter Persistence', () => {
  beforeEach(() => {
    clearAllNavigationState();
    delete globalThis.window;
  });

  describe('navigationState - In-Memory Fallback', () => {
    test('saveSectionRoute and getSectionRoute track and restore sub-routes', () => {
      assert.equal(getSectionRoute('/shipments'), null);
      saveSectionRoute('/shipments', '/shipments/SHP-2026-000104');
      assert.equal(getSectionRoute('/shipments'), '/shipments/SHP-2026-000104');
    });

    test('clearSectionRoute removes saved sub-route', () => {
      saveSectionRoute('/clients', '/clients/CL-001');
      assert.equal(getSectionRoute('/clients'), '/clients/CL-001');
      clearSectionRoute('/clients');
      assert.equal(getSectionRoute('/clients'), null);
    });

    test('ignores invalid sectionRoot or pathname inputs', () => {
      saveSectionRoute(null, '/shipments/SHP-001');
      saveSectionRoute('not-a-root', '/shipments/SHP-001');
      saveSectionRoute('/shipments', null);
      saveSectionRoute('/shipments', 'invalid-subpath');
      assert.equal(getSectionRoute('/shipments'), null);
      assert.equal(getSectionRoute(null), null);
    });

    test('savePageState and getPageState serialize and deserialize state objects', () => {
      const state = { search: 'Test', statusFilter: 'Active', page: 2, pageSize: 20 };
      savePageState('shipments_directory', state);
      assert.deepEqual(getPageState('shipments_directory'), state);
    });

    test('clearPageState removes saved page state', () => {
      savePageState('vehicles_directory', { page: 1 });
      assert.deepEqual(getPageState('vehicles_directory'), { page: 1 });
      clearPageState('vehicles_directory');
      assert.equal(getPageState('vehicles_directory'), null);
    });

    test('clearAllNavigationState purges all section routes and page filter states', () => {
      saveSectionRoute('/shipments', '/shipments/SHP-001');
      saveSectionRoute('/waybills', '/waybills/WB-001');
      savePageState('shipments_directory', { search: 'A' });
      savePageState('waybills_directory', { search: 'B' });

      clearAllNavigationState();

      assert.equal(getSectionRoute('/shipments'), null);
      assert.equal(getSectionRoute('/waybills'), null);
      assert.equal(getPageState('shipments_directory'), null);
      assert.equal(getPageState('waybills_directory'), null);
    });
  });

  describe('navigationState - sessionStorage Integration & Error Handling', () => {
    test('synchronizes with window.sessionStorage when available', () => {
      const storageMap = new Map();
      globalThis.window = {
        sessionStorage: {
          getItem: (k) => storageMap.get(k) ?? null,
          setItem: (k, v) => storageMap.set(k, String(v)),
          removeItem: (k) => storageMap.delete(k),
          get length() {
            return storageMap.size;
          },
          key: (index) => Array.from(storageMap.keys())[index] ?? null,
        },
      };

      saveSectionRoute('/shipments', '/shipments/SHP-2026-000104');
      assert.equal(storageMap.get('tnl_section_route_/shipments'), '/shipments/SHP-2026-000104');
      assert.equal(getSectionRoute('/shipments'), '/shipments/SHP-2026-000104');

      savePageState('clients_directory', { selectedStatus: 'Inactive', currentPage: 3 });
      assert.deepEqual(
        JSON.parse(storageMap.get('tnl_page_state_clients_directory')),
        { selectedStatus: 'Inactive', currentPage: 3 }
      );
      assert.deepEqual(getPageState('clients_directory'), {
        selectedStatus: 'Inactive',
        currentPage: 3,
      });

      clearAllNavigationState();
      assert.equal(storageMap.size, 0);
      assert.equal(getSectionRoute('/shipments'), null);
      assert.equal(getPageState('clients_directory'), null);
    });

    test('gracefully handles sessionStorage throws without crashing', () => {
      globalThis.window = {
        sessionStorage: {
          getItem: () => {
            throw new Error('SecurityError: storage disabled');
          },
          setItem: () => {
            throw new Error('QuotaExceededError');
          },
          removeItem: () => {
            throw new Error('SecurityError');
          },
          get length() {
            throw new Error('SecurityError');
          },
          key: () => {
            throw new Error('SecurityError');
          },
        },
      };

      assert.doesNotThrow(() => saveSectionRoute('/shipments', '/shipments/SHP-001'));
      assert.doesNotThrow(() => getSectionRoute('/shipments'));
      assert.doesNotThrow(() => clearSectionRoute('/shipments'));
      assert.doesNotThrow(() => savePageState('test_page', { page: 1 }));
      assert.doesNotThrow(() => getPageState('test_page'));
      assert.doesNotThrow(() => clearPageState('test_page'));
      assert.doesNotThrow(() => clearAllNavigationState());
    });
  });

  describe('useSavedPageState React Hook Simulation', () => {
    test('restores saved state across unmount/remount cycles', () => {
      // Simulate React hook execution environment
      let hookState;
      let hookUpdate;

      const defaultFilters = { search: '', status: 'ALL', page: 0, pageSize: 20 };

      // Helper simulating hook mount
      const mountHook = () => {
        let stateValue;
        const mockSetState = (action) => {
          stateValue = typeof action === 'function' ? action(stateValue) : action;
          hookState = stateValue;
        };

        // Call initializer logic from useSavedPageState
        const saved = getPageState('test_screen');
        stateValue = saved && typeof saved === 'object' ? { ...defaultFilters, ...saved } : defaultFilters;
        hookState = stateValue;

        hookUpdate = (updater) => {
          mockSetState((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
            savePageState('test_screen', next);
            return next;
          });
        };
      };

      // 1. Initial mount: receives default state
      mountHook();
      assert.deepEqual(hookState, defaultFilters);

      // 2. User updates filter and page
      hookUpdate({ search: 'Acme', page: 2 });
      assert.deepEqual(hookState, { search: 'Acme', status: 'ALL', page: 2, pageSize: 20 });

      // 3. User unmounts (simulated by clearing local hook variables)
      hookState = null;
      hookUpdate = null;

      // 4. Remounts: state is restored from storage
      mountHook();
      assert.deepEqual(hookState, { search: 'Acme', status: 'ALL', page: 2, pageSize: 20 });

      // 5. User uses functional updater
      hookUpdate((prev) => ({ ...prev, page: prev.page + 1 }));
      assert.equal(hookState.page, 3);

      // 6. Logout / clear
      clearAllNavigationState();
      mountHook();
      assert.deepEqual(hookState, defaultFilters);
    });
  });

  describe('Sidebar & Detail Screen Navigation Workflow Invariants', () => {
    const SECTION_ROOTS = [
      '/shipments',
      '/clients',
      '/waybills',
      '/vehicles',
      '/tracking-logs',
      '/payments',
      '/weekly-collections',
      '/statements',
      '/reports',
      '/users',
    ];

    // Simulates Sidebar handleNavigate logic
    const simulateSidebarClick = (currentPathname, targetHref) => {
      if (SECTION_ROOTS.includes(targetHref)) {
        const isWithinSection =
          currentPathname === targetHref ||
          (currentPathname && currentPathname.startsWith(targetHref + '/'));
        if (isWithinSection) {
          clearSectionRoute(targetHref);
          return targetHref;
        }
        const savedRoute = getSectionRoute(targetHref);
        return savedRoute || targetHref;
      }
      return targetHref;
    };

    test('visiting sub-route, switching sections, and clicking sidebar restores sub-route', () => {
      // 1. User starts at /shipments
      saveSectionRoute('/shipments', '/shipments');

      // 2. User opens detail record
      saveSectionRoute('/shipments', '/shipments/SHP-2026-000104');

      // 3. User switches to Vehicles section via sidebar
      let currentPath = simulateSidebarClick('/shipments/SHP-2026-000104', '/vehicles');
      assert.equal(currentPath, '/vehicles');
      saveSectionRoute('/vehicles', '/vehicles');

      // 4. In sidebar, user clicks Shipments: restores detail view!
      currentPath = simulateSidebarClick('/vehicles', '/shipments');
      assert.equal(currentPath, '/shipments/SHP-2026-000104');
    });

    test('clicking sidebar while already on detail view toggles back to root directory', () => {
      saveSectionRoute('/shipments', '/shipments/SHP-2026-000104');

      // User is currently ON /shipments/SHP-2026-000104 and clicks Shipments in sidebar
      const currentPath = simulateSidebarClick(
        '/shipments/SHP-2026-000104',
        '/shipments'
      );
      assert.equal(currentPath, '/shipments');
      // Memory must be reset to root
      assert.equal(getSectionRoute('/shipments'), null);
    });

    test('detail breadcrumb link "Back to Shipments" resets section memory to root', () => {
      saveSectionRoute('/shipments', '/shipments/SHP-2026-000104');
      assert.equal(getSectionRoute('/shipments'), '/shipments/SHP-2026-000104');

      // User clicks "Back to Shipments" breadcrumb
      clearSectionRoute('/shipments');
      assert.equal(getSectionRoute('/shipments'), null);

      // Subsequent sidebar click now routes to root /shipments
      const nextPath = simulateSidebarClick('/vehicles', '/shipments');
      assert.equal(nextPath, '/shipments');
    });

    test('non-section routes are navigated directly without section memory', () => {
      assert.equal(simulateSidebarClick('/shipments', '/register'), '/register');
      assert.equal(simulateSidebarClick('/shipments', '/settings'), '/settings');
      assert.equal(simulateSidebarClick('/shipments', '/'), '/');
    });
  });

  describe('Extended Directories Persistence (Users, Weekly Collections, Statements)', () => {
    const SECTION_ROOTS = [
      '/shipments',
      '/clients',
      '/waybills',
      '/vehicles',
      '/tracking-logs',
      '/payments',
      '/weekly-collections',
      '/statements',
      '/reports',
      '/users',
    ];

    const simulateSidebarClick = (currentPathname, targetHref) => {
      if (SECTION_ROOTS.includes(targetHref)) {
        const isWithinSection =
          currentPathname === targetHref ||
          (currentPathname && currentPathname.startsWith(targetHref + '/'));
        if (isWithinSection) {
          clearSectionRoute(targetHref);
          return targetHref;
        }
        const savedRoute = getSectionRoute(targetHref);
        return savedRoute || targetHref;
      }
      return targetHref;
    };

    test('users_directory preserves filters and page index across unmount and remount', () => {
      savePageState('users_directory', {
        searchQuery: 'Courier',
        roleFilter: 'COURIER',
        statusFilter: 'Active',
        currentPage: 2,
        pageSize: 20,
      });

      const restored = getPageState('users_directory');
      assert.deepEqual(restored, {
        searchQuery: 'Courier',
        roleFilter: 'COURIER',
        statusFilter: 'Active',
        currentPage: 2,
        pageSize: 20,
      });

      // Simulate first mount guard: restored page is preserved on mount
      let isFirstMount = true;
      let currentPage = restored.currentPage;
      const onFilterChangeTriggered = () => {
        if (isFirstMount) {
          isFirstMount = false;
          return;
        }
        currentPage = 0;
      };

      onFilterChangeTriggered();
      assert.equal(currentPage, 2, 'Restored currentPage should be preserved on first mount');

      onFilterChangeTriggered();
      assert.equal(currentPage, 0, 'Subsequent filter change should reset currentPage to 0');
    });

    test('weekly_collections_directory persists cycle and search and validates against available cycles', () => {
      savePageState('weekly_collections_directory', {
        selectedCycle: '2026-10-15',
        searchQuery: 'Global Express',
        statusFilter: 'READY_FOR_SOA',
      });

      const restored = getPageState('weekly_collections_directory');
      assert.equal(restored.selectedCycle, '2026-10-15');
      assert.equal(restored.searchQuery, 'Global Express');
      assert.equal(restored.statusFilter, 'READY_FOR_SOA');

      const availableCycles = [
        { isoDate: '2026-10-22' },
        { isoDate: '2026-10-15' },
        { isoDate: '2026-10-08' },
      ];

      const resolveCycle = (savedCycle, cycles) => {
        const isStillValid = savedCycle && cycles.some((c) => c.isoDate === savedCycle);
        return isStillValid ? savedCycle : (cycles[0]?.isoDate || '');
      };

      assert.equal(resolveCycle(restored.selectedCycle, availableCycles), '2026-10-15');
      assert.equal(resolveCycle('2025-01-01', availableCycles), '2026-10-22');
    });

    test('statements_selection prioritizes URL search params over saved session state', () => {
      savePageState('statements_selection', {
        clientId: 'CL-PRIOR',
        cycle: '2026-10-08',
        isClientExplicit: false,
      });

      const resolveStatementSelection = (searchParams, savedState) => {
        if (searchParams.clientId || searchParams.cycle) {
          return {
            clientId: searchParams.clientId || null,
            cycle: searchParams.cycle || '',
            isClientExplicit: Boolean(searchParams.clientId),
          };
        }
        return savedState;
      };

      // Direct navigation with URL query params
      const directNavParams = { clientId: 'CL-002', cycle: '2026-10-22' };
      const directSelection = resolveStatementSelection(directNavParams, getPageState('statements_selection'));
      assert.deepEqual(directSelection, {
        clientId: 'CL-002',
        cycle: '2026-10-22',
        isClientExplicit: true,
      });

      savePageState('statements_selection', directSelection);

      // Sidebar navigation without query params
      const sidebarNavParams = {};
      const sidebarSelection = resolveStatementSelection(sidebarNavParams, getPageState('statements_selection'));
      assert.deepEqual(sidebarSelection, {
        clientId: 'CL-002',
        cycle: '2026-10-22',
        isClientExplicit: true,
      });
    });

    test('Sidebar recognizes /weekly-collections and /statements in section memory and sub-routes', () => {
      saveSectionRoute('/statements', '/statements/print?clientId=CL-001&cycle=2026-10-22');
      assert.equal(
        getSectionRoute('/statements'),
        '/statements/print?clientId=CL-001&cycle=2026-10-22'
      );

      let currentPath = simulateSidebarClick('/statements/print?clientId=CL-001&cycle=2026-10-22', '/weekly-collections');
      assert.equal(currentPath, '/weekly-collections');

      currentPath = simulateSidebarClick('/weekly-collections', '/statements');
      assert.equal(currentPath, '/statements/print?clientId=CL-001&cycle=2026-10-22');

      currentPath = simulateSidebarClick('/statements/print?clientId=CL-001&cycle=2026-10-22', '/statements');
      assert.equal(currentPath, '/statements');
      assert.equal(getSectionRoute('/statements'), null);
    });
  });
});
