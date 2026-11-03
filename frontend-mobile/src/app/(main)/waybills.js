import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import { useAuth } from '../../features/auth/context/AuthContext';
import { trackingScanApi } from '../../features/scanner/services/trackingScanApi';
import ScanFeedbackBanner from '../../features/scanner/components/ScanFeedbackBanner';
import ScanViewfinder from '../../features/scanner/components/ScanViewfinder';
import { safeHaptics } from '../../features/scanner/utils/haptics';
import { MAX_BATCH_SIZE, normalizeTrackingId, validateBatchCandidate, buildBatchScanRequest } from '../../features/scanner/scannerFlow.mjs';
import {
  listShipmentOptions,
  listWaybillOptions,
  listShipmentWaybills,
  listAvailableUnits,
  getWaybill,
  generateWaybill,
  sendWaybill,
  completeWaybill
} from '../../features/waybills/waybillApi';
import { buildWaybillHtml } from '../../features/waybills/printWaybill.mjs';
import {
  SHIPMENT_OPTION_PAGE_SIZE,
  SHIPMENT_RECOMMENDATION_SIZE,
  SHIPMENT_SEARCH_DEBOUNCE_MS,
  SHIPMENT_SEARCH_MIN_LENGTH,
  appendUniqueShipmentOptions,
  createShipmentOptionRequestCoordinator,
  hasNextShipmentOptionPage,
  normalizeShipmentSearch
} from '../../features/waybills/shipmentOptionsFlow.mjs';
import {
  WAYBILL_OPTION_PAGE_SIZE,
  WAYBILL_RECOMMENDATION_SIZE,
  WAYBILL_SEARCH_DEBOUNCE_MS,
  WAYBILL_SEARCH_MIN_LENGTH,
  appendUniqueWaybillOptions,
  createWaybillOptionRequestCoordinator,
  hasNextWaybillOptionPage,
  normalizeWaybillSearch
} from '../../features/waybills/waybillOptionsFlow.mjs';
import {
  doesWaybillQrMatchOpenManifest,
  isWaybillCompletionUnlocked,
  parseWaybillQrPayload
} from '../../features/waybills/waybillReturnFlow.mjs';
import { colors, typography, spacing, radius } from '../../theme';
import { canAccessMobileRoute, MOBILE_ROUTES } from '../../features/auth/services/roleAccess.mjs';

const CAMERA_HEIGHTS = [0, 160, 280];
const CAMERA_HEIGHT_LABELS = ['Collapsed', 'Compact', 'Expanded'];
const CAMERA_TAP_THRESHOLD = 8;
const DEFAULT_CAMERA_HEIGHT_INDEX = CAMERA_HEIGHTS.length - 1;

function findNearestCameraHeightIndex(height) {
  return CAMERA_HEIGHTS.reduce((nearestIndex, cameraHeight, index) => (
    Math.abs(cameraHeight - height) < Math.abs(CAMERA_HEIGHTS[nearestIndex] - height)
      ? index
      : nearestIndex
  ), 0);
}

export default function DispatchWaybillsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, isLoading: authLoading } = useAuth();
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected === true && netInfo.isInternetReachable !== false;
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState('load'); // 'load' | 'arrival' | 'return'
  const [arrivalQueue, setArrivalQueue] = useState([]);
  const [arrivalInput, setArrivalInput] = useState('');
  const [arrivalLookups, setArrivalLookups] = useState(0);
  const [pendingArrivalLeave, setPendingArrivalLeave] = useState(null);
  const [pendingShipmentSwitch, setPendingShipmentSwitch] = useState(null);
  const loadRequestRef = useRef(null);
  const arrivalQueueRef = useRef([]);
  const arrivalPendingRef = useRef(new Set());
  const arrivalVersionRef = useRef(0);
  const arrivalSubmittingRef = useRef(false);
  const arrivalOwnerRef = useRef(null);
  const arrivalOwner = `${user?.userId || ''}:${user?.role || ''}`;
  if (arrivalOwnerRef.current !== arrivalOwner) {
    arrivalOwnerRef.current = arrivalOwner;
    arrivalVersionRef.current += 1;
    loadRequestRef.current = null;
  }
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Shipment & queue state
  const [shipments, setShipments] = useState([]);
  const [shipmentPage, setShipmentPage] = useState(0);
  const [hasMoreShipments, setHasMoreShipments] = useState(false);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isLoadingMoreShipments, setIsLoadingMoreShipments] = useState(false);
  const [shipmentLoadError, setShipmentLoadError] = useState('');
  const [shipmentPageError, setShipmentPageError] = useState('');
  const [shipmentIdInput, setShipmentIdInput] = useState('');
  const [shipmentRecommendations, setShipmentRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');
  const [recommendationRetryVersion, setRecommendationRetryVersion] = useState(0);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [shipmentId, setShipmentId] = useState('');
  const [availableUnits, setAvailableUnits] = useState([]);
  const [shipmentWaybills, setShipmentWaybills] = useState([]);
  const [batchQueue, setBatchQueue] = useState([]);
  const [manualTrackingInput, setManualTrackingInput] = useState('');

  // Waybill and return confirmation state
  const [waybillInput, setWaybillInput] = useState('');
  const [waybillOptions, setWaybillOptions] = useState([]);
  const [waybillOptionPage, setWaybillOptionPage] = useState(0);
  const [hasMoreWaybillOptions, setHasMoreWaybillOptions] = useState(false);
  const [isLoadingWaybillOptions, setIsLoadingWaybillOptions] = useState(false);
  const [isLoadingMoreWaybillOptions, setIsLoadingMoreWaybillOptions] = useState(false);
  const [waybillOptionLoadError, setWaybillOptionLoadError] = useState('');
  const [waybillOptionPageError, setWaybillOptionPageError] = useState('');
  const [waybillRecommendations, setWaybillRecommendations] = useState([]);
  const [isLoadingWaybillRecommendations, setIsLoadingWaybillRecommendations] = useState(false);
  const [waybillRecommendationError, setWaybillRecommendationError] = useState('');
  const [waybillRecommendationRetryVersion, setWaybillRecommendationRetryVersion] = useState(0);
  const [manifest, setManifest] = useState(null);
  const [confirmedWaybillId, setConfirmedWaybillId] = useState(null);
  const [confirmedManifestRevision, setConfirmedManifestRevision] = useState(null);
  const isCompletingWaybill = useRef(false);

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState('');
  const [notice, setNotice] = useState('');
  const setError = useCallback((message) => {
    setErrorState(message);
    if (message) setNotice('');
  }, []);
  const [showGenerationConfirmation, setShowGenerationConfirmation] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [cameraHeightIndex, setCameraHeightIndex] = useState(DEFAULT_CAMERA_HEIGHT_INDEX);
  const [generationKey, setGenerationKey] = useState(() => Crypto.randomUUID());

  const scanLockRef = useRef(false);
  const generationLockRef = useRef(false);
  const returnContextVersionRef = useRef(0);
  const cameraHeightIndexRef = useRef(DEFAULT_CAMERA_HEIGHT_INDEX);
  const cameraDragStartHeightRef = useRef(CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX]);
  const animatedCameraHeight = useRef(
    new Animated.Value(CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX])
  ).current;
  const shipmentOptionCoordinatorRef = useRef(null);
  if (shipmentOptionCoordinatorRef.current === null) {
    shipmentOptionCoordinatorRef.current = createShipmentOptionRequestCoordinator();
  }
  const waybillOptionCoordinatorRef = useRef(null);
  if (waybillOptionCoordinatorRef.current === null) {
    waybillOptionCoordinatorRef.current = createWaybillOptionRequestCoordinator();
  }

  const animateCameraToIndex = useCallback((nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(CAMERA_HEIGHTS.length - 1, nextIndex));
    cameraHeightIndexRef.current = boundedIndex;
    setCameraHeightIndex(boundedIndex);
    animatedCameraHeight.stopAnimation();
    Animated.spring(animatedCameraHeight, {
      toValue: CAMERA_HEIGHTS[boundedIndex],
      stiffness: 260,
      damping: 28,
      mass: 0.7,
      useNativeDriver: false
    }).start();
  }, [animatedCameraHeight]);

  const resizeCamera = useCallback((indexDelta) => {
    animateCameraToIndex(cameraHeightIndexRef.current + indexDelta);
  }, [animateCameraToIndex]);

  const toggleCameraHeight = useCallback(() => {
    const currentIndex = cameraHeightIndexRef.current;
    if (currentIndex === DEFAULT_CAMERA_HEIGHT_INDEX) {
      animateCameraToIndex(DEFAULT_CAMERA_HEIGHT_INDEX - 1);
    } else if (currentIndex === 0) {
      animateCameraToIndex(1);
    } else {
      animateCameraToIndex(DEFAULT_CAMERA_HEIGHT_INDEX);
    }
  }, [animateCameraToIndex]);

  const cameraDividerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isKeyboardVisible,
    onMoveShouldSetPanResponder: (_, gestureState) => (
      !isKeyboardVisible
      && Math.abs(gestureState.dy) >= 8
      && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
    ),
    onPanResponderGrant: () => {
      animatedCameraHeight.stopAnimation((currentHeight) => {
        cameraDragStartHeightRef.current = currentHeight;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextHeight = Math.max(
        CAMERA_HEIGHTS[0],
        Math.min(
          CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX],
          cameraDragStartHeightRef.current + gestureState.dy
        )
      );
      animatedCameraHeight.setValue(nextHeight);
    },
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dy) < CAMERA_TAP_THRESHOLD) {
        toggleCameraHeight();
      } else {
        const releasedHeight = Math.max(
          CAMERA_HEIGHTS[0],
          Math.min(
            CAMERA_HEIGHTS[DEFAULT_CAMERA_HEIGHT_INDEX],
            cameraDragStartHeightRef.current + gestureState.dy
          )
        );
        animateCameraToIndex(findNearestCameraHeightIndex(releasedHeight));
      }
    },
    onPanResponderTerminate: () => {
      animatedCameraHeight.stopAnimation((currentHeight) => {
        animateCameraToIndex(findNearestCameraHeightIndex(currentHeight));
      });
    }
  }), [animatedCameraHeight, animateCameraToIndex, isKeyboardVisible, toggleCameraHeight]);

  const handleManualInputFocus = useCallback(() => {
    animatedCameraHeight.stopAnimation();
    animatedCameraHeight.setValue(0);
    setIsKeyboardVisible(true);
  }, [animatedCameraHeight]);

  const handleCameraAccessibilityAction = useCallback((event) => {
    if (isKeyboardVisible) return;
    if (event.nativeEvent.actionName === 'increment') {
      resizeCamera(1);
    } else if (event.nativeEvent.actionName === 'decrement') {
      resizeCamera(-1);
    } else if (event.nativeEvent.actionName === 'activate') {
      toggleCameraHeight();
    }
  }, [isKeyboardVisible, resizeCamera, toggleCameraHeight]);

  useEffect(() => {
    if (!authLoading && user && !canAccessMobileRoute(user.role, MOBILE_ROUTES.WAYBILLS)) {
      router.replace('/(main)');
    }
  }, [user, authLoading, router]);

  // Turn off torch and pause camera when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
        animatedCameraHeight.stopAnimation();
        animatedCameraHeight.setValue(0);
        setIsKeyboardVisible(true);
      });
      const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardVisible(false);
        animateCameraToIndex(cameraHeightIndexRef.current);
      });

      return () => {
        keyboardShowSubscription.remove();
        keyboardHideSubscription.remove();
        animatedCameraHeight.stopAnimation();
        animatedCameraHeight.setValue(CAMERA_HEIGHTS[cameraHeightIndexRef.current]);
        arrivalVersionRef.current += 1;
        if (loadRequestRef.current) setBusy(false);
        loadRequestRef.current = null;
        arrivalPendingRef.current.clear();
        setArrivalLookups(0);
        if (arrivalSubmittingRef.current) {
          arrivalSubmittingRef.current = false;
          setBusy(false);
        }
        returnContextVersionRef.current += 1;
        setIsScreenFocused(false);
        setIsKeyboardVisible(false);
        setTorchEnabled(false);
        setConfirmedWaybillId(null);
      };
    }, [animatedCameraHeight, animateCameraToIndex])
  );

  useEffect(() => {
    if (!user) {
      shipmentOptionCoordinatorRef.current.cancelAll();
      waybillOptionCoordinatorRef.current.cancelAll();
      setIsLoadingShipments(false);
      setIsLoadingMoreShipments(false);
      setIsLoadingRecommendations(false);
      setIsLoadingWaybillOptions(false);
      setIsLoadingMoreWaybillOptions(false);
      setIsLoadingWaybillRecommendations(false);
      returnContextVersionRef.current += 1;
      setConfirmedWaybillId(null);
      setManifest(null);
      setWaybillInput('');
      setWaybillOptions([]);
      setWaybillRecommendations([]);
      setBatchQueue([]);
      setShowGenerationConfirmation(false);
    }
  }, [user]);

  useEffect(() => {
    arrivalQueueRef.current = [];
    arrivalPendingRef.current.clear();
    arrivalSubmittingRef.current = false;
    setArrivalQueue([]);
    setArrivalInput('');
    setArrivalLookups(0);
    setPendingArrivalLeave(null);
    setPendingShipmentSwitch(null);
    setNotice('');
    setError('');
    setBusy(false);
    return () => {
      arrivalVersionRef.current += 1;
      loadRequestRef.current = null;
    };
  }, [arrivalOwner]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (mode !== 'arrival' || arrivalQueueRef.current.length === 0) return;
    event.preventDefault();
    if (!arrivalSubmittingRef.current) setPendingArrivalLeave({ action: event.data.action });
  }), [mode, navigation]);

  const loadRecentShipmentOptions = useCallback(async () => {
    if (!isOnline || user?.role !== 'DISPATCH_STAFF' || mode !== 'load') return;
    const coordinator = shipmentOptionCoordinatorRef.current;
    const requestToken = coordinator.beginFirstPage();
    setIsLoadingShipments(true);
    setShipmentLoadError('');
    setShipmentPageError('');
    try {
      const page = await listShipmentOptions({
        page: 0,
        size: SHIPMENT_OPTION_PAGE_SIZE,
        signal: requestToken.signal
      });
      if (!coordinator.isCurrent(requestToken)) return;
      const incoming = Array.isArray(page?.content) ? page.content : [];
      setShipments(appendUniqueShipmentOptions([], incoming));
      setShipmentPage(Number.isInteger(page?.number) ? page.number : 0);
      setHasMoreShipments(hasNextShipmentOptionPage(page));
    } catch {
      if (!coordinator.isCurrent(requestToken)) return;
      setShipmentLoadError('Unable to load recent shipments.');
    } finally {
      if (coordinator.finish(requestToken)) {
        setIsLoadingShipments(false);
      }
    }
  }, [isOnline, mode, user?.role]);

  const loadNextShipmentOptions = useCallback(async () => {
    if (!isOnline || mode !== 'load' || !hasMoreShipments) return;
    const coordinator = shipmentOptionCoordinatorRef.current;
    const requestToken = coordinator.beginNextPage();
    if (!requestToken) return;
    const nextPage = shipmentPage + 1;
    setIsLoadingMoreShipments(true);
    setShipmentPageError('');
    try {
      const page = await listShipmentOptions({
        page: nextPage,
        size: SHIPMENT_OPTION_PAGE_SIZE,
        signal: requestToken.signal
      });
      if (!coordinator.isCurrent(requestToken)) return;
      const incoming = Array.isArray(page?.content) ? page.content : [];
      setShipments((current) => appendUniqueShipmentOptions(current, incoming));
      setShipmentPage(Number.isInteger(page?.number) ? page.number : nextPage);
      setHasMoreShipments(hasNextShipmentOptionPage(page));
    } catch {
      if (!coordinator.isCurrent(requestToken)) return;
      setShipmentPageError('Could not load more shipments.');
    } finally {
      if (coordinator.finish(requestToken)) {
        setIsLoadingMoreShipments(false);
      }
    }
  }, [hasMoreShipments, isOnline, mode, shipmentPage]);

  useEffect(() => {
    if (mode === 'load') {
      loadRecentShipmentOptions();
    }
  }, [loadRecentShipmentOptions, mode, shipmentId]);

  useEffect(() => {
    if (isOnline) return;
    shipmentOptionCoordinatorRef.current.cancelAll();
    waybillOptionCoordinatorRef.current.cancelAll();
    setIsLoadingShipments(false);
    setIsLoadingMoreShipments(false);
    setIsLoadingRecommendations(false);
    setIsLoadingWaybillOptions(false);
    setIsLoadingMoreWaybillOptions(false);
    setIsLoadingWaybillRecommendations(false);
  }, [isOnline]);

  useEffect(() => () => {
    shipmentOptionCoordinatorRef.current.cancelAll();
    waybillOptionCoordinatorRef.current.cancelAll();
  }, []);

  const normalizedShipmentSearch = normalizeShipmentSearch(shipmentIdInput);
  const isRecommendationSearchActive = normalizedShipmentSearch.length >= SHIPMENT_SEARCH_MIN_LENGTH;

  useEffect(() => {
    const coordinator = shipmentOptionCoordinatorRef.current;
    if (!isOnline || mode !== 'load' || shipmentId || !isRecommendationSearchActive) {
      coordinator.cancelRecommendations();
      setShipmentRecommendations([]);
      setRecommendationError('');
      setIsLoadingRecommendations(false);
      return undefined;
    }

    const debounceTimer = setTimeout(async () => {
      const requestToken = coordinator.beginRecommendation(normalizedShipmentSearch);
      setShipmentRecommendations([]);
      setRecommendationError('');
      setIsLoadingRecommendations(true);
      try {
        const page = await listShipmentOptions({
          page: 0,
          size: SHIPMENT_RECOMMENDATION_SIZE,
          search: normalizedShipmentSearch,
          signal: requestToken.signal
        });
        if (!coordinator.isCurrent(requestToken)) return;
        const content = Array.isArray(page?.content) ? page.content : [];
        setShipmentRecommendations(content.slice(0, SHIPMENT_RECOMMENDATION_SIZE));
      } catch {
        if (!coordinator.isCurrent(requestToken)) return;
        setRecommendationError('Unable to search shipment numbers.');
      } finally {
        if (coordinator.finish(requestToken)) {
          setIsLoadingRecommendations(false);
        }
      }
    }, SHIPMENT_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      coordinator.cancelRecommendations();
    };
  }, [
    isOnline,
    isRecommendationSearchActive,
    mode,
    normalizedShipmentSearch,
    recommendationRetryVersion,
    shipmentId
  ]);

  const loadRecentWaybillOptions = useCallback(async () => {
    if (!isOnline || user?.role !== 'DISPATCH_STAFF' || mode !== 'return' || manifest) return;
    const coordinator = waybillOptionCoordinatorRef.current;
    const requestToken = coordinator.beginFirstPage();
    setIsLoadingWaybillOptions(true);
    setWaybillOptionLoadError('');
    setWaybillOptionPageError('');
    try {
      const page = await listWaybillOptions({
        page: 0,
        size: WAYBILL_OPTION_PAGE_SIZE,
        status: 'SENT_TO_HAULER',
        signal: requestToken.signal
      });
      if (!coordinator.isCurrent(requestToken)) return;
      const incoming = Array.isArray(page?.content) ? page.content : [];
      setWaybillOptions(appendUniqueWaybillOptions([], incoming));
      setWaybillOptionPage(Number.isInteger(page?.number) ? page.number : 0);
      setHasMoreWaybillOptions(hasNextWaybillOptionPage(page));
    } catch {
      if (!coordinator.isCurrent(requestToken)) return;
      setWaybillOptionLoadError('Unable to load recent returned waybills.');
    } finally {
      if (coordinator.finish(requestToken)) {
        setIsLoadingWaybillOptions(false);
      }
    }
  }, [isOnline, manifest, mode, user?.role]);

  const loadNextWaybillOptions = useCallback(async () => {
    if (!isOnline || mode !== 'return' || manifest || !hasMoreWaybillOptions) return;
    const coordinator = waybillOptionCoordinatorRef.current;
    const requestToken = coordinator.beginNextPage();
    if (!requestToken) return;
    const nextPage = waybillOptionPage + 1;
    setIsLoadingMoreWaybillOptions(true);
    setWaybillOptionPageError('');
    try {
      const page = await listWaybillOptions({
        page: nextPage,
        size: WAYBILL_OPTION_PAGE_SIZE,
        status: 'SENT_TO_HAULER',
        signal: requestToken.signal
      });
      if (!coordinator.isCurrent(requestToken)) return;
      const incoming = Array.isArray(page?.content) ? page.content : [];
      setWaybillOptions((current) => appendUniqueWaybillOptions(current, incoming));
      setWaybillOptionPage(Number.isInteger(page?.number) ? page.number : nextPage);
      setHasMoreWaybillOptions(hasNextWaybillOptionPage(page));
    } catch {
      if (!coordinator.isCurrent(requestToken)) return;
      setWaybillOptionPageError('Could not load more returned waybills.');
    } finally {
      if (coordinator.finish(requestToken)) {
        setIsLoadingMoreWaybillOptions(false);
      }
    }
  }, [hasMoreWaybillOptions, isOnline, manifest, mode, waybillOptionPage]);

  useEffect(() => {
    if (mode === 'return' && !manifest) {
      loadRecentWaybillOptions();
    }
  }, [loadRecentWaybillOptions, manifest, mode]);

  const normalizedWaybillSearch = normalizeWaybillSearch(waybillInput);
  const isWaybillRecommendationSearchActive = !manifest
    && normalizedWaybillSearch.length >= WAYBILL_SEARCH_MIN_LENGTH;

  useEffect(() => {
    const coordinator = waybillOptionCoordinatorRef.current;
    if (!isOnline || mode !== 'return' || manifest || !isWaybillRecommendationSearchActive) {
      coordinator.cancelRecommendations();
      setWaybillRecommendations([]);
      setWaybillRecommendationError('');
      setIsLoadingWaybillRecommendations(false);
      return undefined;
    }

    const debounceTimer = setTimeout(async () => {
      const requestToken = coordinator.beginRecommendation(normalizedWaybillSearch);
      setWaybillRecommendations([]);
      setWaybillRecommendationError('');
      setIsLoadingWaybillRecommendations(true);
      try {
        const page = await listWaybillOptions({
          page: 0,
          size: WAYBILL_RECOMMENDATION_SIZE,
          search: normalizedWaybillSearch,
          status: 'SENT_TO_HAULER',
          signal: requestToken.signal
        });
        if (!coordinator.isCurrent(requestToken)) return;
        const content = Array.isArray(page?.content) ? page.content : [];
        setWaybillRecommendations(content.slice(0, WAYBILL_RECOMMENDATION_SIZE));
      } catch {
        if (!coordinator.isCurrent(requestToken)) return;
        setWaybillRecommendationError('Unable to search waybill numbers.');
      } finally {
        if (coordinator.finish(requestToken)) {
          setIsLoadingWaybillRecommendations(false);
        }
      }
    }, WAYBILL_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      coordinator.cancelRecommendations();
    };
  }, [
    isOnline,
    isWaybillRecommendationSearchActive,
    manifest,
    mode,
    normalizedWaybillSearch,
    waybillRecommendationRetryVersion
  ]);

  // Refresh data for selected shipment
  const refreshShipmentData = useCallback(async (targetShipmentId) => {
    if (!targetShipmentId) return;
    const requestVersion = arrivalVersionRef.current;
    try {
      const [units, records] = await Promise.all([
        listAvailableUnits(targetShipmentId),
        listShipmentWaybills(targetShipmentId)
      ]);
      if (arrivalVersionRef.current !== requestVersion) return;
      setAvailableUnits(Array.isArray(units) ? units : []);
      setShipmentWaybills(Array.isArray(records) ? records : []);
    } catch {
      if (arrivalVersionRef.current !== requestVersion) return;
      setError('Could not refresh shipment waybill data.');
    }
  }, []);

  const getManifestCandidateError = (context, units) => {
    if (context.lost) return context.scanBlockedReason || 'Parcel is lost. Admin must mark it found before scanning.';
    if (!['ARRIVED_AT_TNL', 'LOADED_TO_HAULER'].includes(context.currentStatusCode)) {
      return `${context.trackingId} must be arrived in Daet.`;
    }
    if (!units.some((unit) => unit.trackingId === context.trackingId)) return `${context.trackingId} is not available for this manifest.`;
    return null;
  };

  const selectShipment = async (cleanId, context, request) => {
    const [units, records] = await Promise.all([listAvailableUnits(cleanId), listShipmentWaybills(cleanId)]);
    if (arrivalVersionRef.current !== request.version || loadRequestRef.current !== request) return;
    const available = Array.isArray(units) ? units : [];
    const candidateError = context ? getManifestCandidateError(context, available) : null;
    Keyboard.dismiss();
    shipmentOptionCoordinatorRef.current.cancelAll();
    returnContextVersionRef.current += 1;
    setShipmentId(cleanId);
    setShipmentIdInput(cleanId);
    setSelectedShipment([...shipmentRecommendations, ...shipments].find((shipment) => shipment.shipmentId === cleanId) || { shipmentId: cleanId });
    setAvailableUnits(available);
    setShipmentWaybills(Array.isArray(records) ? records : []);
    setBatchQueue(context && !candidateError ? [context.trackingId] : []);
    setShowGenerationConfirmation(false);
    setManifest(null);
    setConfirmedWaybillId(null);
    setGenerationKey(Crypto.randomUUID());
    setPendingShipmentSwitch(null);
    setError(candidateError || '');
    if (context) {
      if (candidateError) safeHaptics.error();
      else safeHaptics.success();
    }
    setNotice(context && !candidateError ? `${context.trackingId} added to manifest queue. 1 queued.` : '');
  };

  const handleSelectShipment = async (chosenId, context = null, isConfirmed = false) => {
    const cleanId = String(chosenId || '').trim().toUpperCase();
    if (!cleanId || mode !== 'load' || !isOnline || busy || loadRequestRef.current) return;
    if (!isConfirmed && shipmentId && cleanId !== shipmentId && batchQueue.length > 0) {
      setPendingShipmentSwitch({ shipmentId: cleanId, context });
      return;
    }
    const request = { version: arrivalVersionRef.current };
    loadRequestRef.current = request;
    setBusy(true);
    try {
      await selectShipment(cleanId, context, request);
    } catch (err) {
      if (arrivalVersionRef.current === request.version) setError(err?.response?.data?.message || 'Could not open shipment. Try again.');
    } finally {
      if (loadRequestRef.current === request) { loadRequestRef.current = null; setBusy(false); }
    }
  };

  const handleClearShipment = () => {
    arrivalVersionRef.current += 1;
    loadRequestRef.current = null;
    setPendingShipmentSwitch(null);
    setBusy(false);
    shipmentOptionCoordinatorRef.current.cancelAll();
    setIsLoadingShipments(false);
    setIsLoadingMoreShipments(false);
    setIsLoadingRecommendations(false);
    setShipmentRecommendations([]);
    setRecommendationError('');
    returnContextVersionRef.current += 1;
    setShipmentId('');
    setShipmentIdInput('');
    setSelectedShipment(null);
    setAvailableUnits([]);
    setShipmentWaybills([]);
    setBatchQueue([]);
    setManifest(null);
    setConfirmedWaybillId(null);
    setError('');
    setNotice('');
  };

  const handleClearWaybill = () => {
    waybillOptionCoordinatorRef.current.cancelAll();
    setIsLoadingWaybillOptions(false);
    setIsLoadingMoreWaybillOptions(false);
    setIsLoadingWaybillRecommendations(false);
    setWaybillRecommendations([]);
    setWaybillRecommendationError('');
    returnContextVersionRef.current += 1;
    setWaybillInput('');
    setManifest(null);
    setConfirmedWaybillId(null);
    setError('');
    setNotice('');
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === mode || (busy && !loadRequestRef.current) || arrivalSubmittingRef.current) return;
    if (mode === 'arrival' && arrivalQueueRef.current.length > 0) {
      setPendingArrivalLeave({ mode: nextMode });
      return;
    }
    arrivalVersionRef.current += 1;
    loadRequestRef.current = null;
    arrivalPendingRef.current.clear();
    setArrivalLookups(0);
    setArrivalInput('');
    setPendingShipmentSwitch(null);
    setBusy(false);
    shipmentOptionCoordinatorRef.current.cancelAll();
    waybillOptionCoordinatorRef.current.cancelAll();
    setIsLoadingShipments(false);
    setIsLoadingMoreShipments(false);
    setIsLoadingRecommendations(false);
    setShipmentRecommendations([]);
    setRecommendationError('');
    setIsLoadingWaybillOptions(false);
    setIsLoadingMoreWaybillOptions(false);
    setIsLoadingWaybillRecommendations(false);
    setWaybillRecommendations([]);
    setWaybillRecommendationError('');
    returnContextVersionRef.current += 1;
    setMode(nextMode);
    setNotice('');
    setShowGenerationConfirmation(false);
    setManifest(null);
    setConfirmedWaybillId(null);
    setError('');
    if (nextMode === 'load' && shipmentId) refreshShipmentData(shipmentId);
    if (nextMode === 'return') {
      setWaybillInput('');
    }
  };

  const discardArrivalQueue = () => {
    const destination = pendingArrivalLeave;
    arrivalQueueRef.current = [];
    setArrivalQueue([]);
    setPendingArrivalLeave(null);
    if (destination?.action) {
      arrivalVersionRef.current += 1;
    loadRequestRef.current = null;
      navigation.dispatch(destination.action);
    } else if (destination?.mode) {
      handleModeChange(destination.mode);
    }
  };

  const processArrivalScan = async (rawValue) => {
    if (mode !== 'arrival' || user?.role !== 'DISPATCH_STAFF' || !isOnline
        || busy || arrivalSubmittingRef.current || pendingArrivalLeave) return;
    const normalized = normalizeTrackingId(rawValue);
    if (!normalized.isValid) { safeHaptics.error(); setError(normalized.error); return; }
    const trackingId = normalized.trackingId;
    if (arrivalQueueRef.current.some((parcel) => parcel.trackingId === trackingId)
        || arrivalPendingRef.current.has(trackingId)) {
      safeHaptics.warning();
      setError(`${trackingId} is already in the arrival queue or being verified.`);
      return;
    }
    if (arrivalQueueRef.current.length + arrivalPendingRef.current.size >= MAX_BATCH_SIZE) {
      safeHaptics.warning();
      setError(`Arrival queue limit reached (maximum ${MAX_BATCH_SIZE} parcels).`);
      return;
    }
    const requestVersion = arrivalVersionRef.current;
    arrivalPendingRef.current.add(trackingId);
    setArrivalLookups(arrivalPendingRef.current.size);
    setError('');
    setNotice('');
    try {
      const context = await trackingScanApi.getScanContext(trackingId);
      if (arrivalVersionRef.current !== requestVersion) return;
      const validation = validateBatchCandidate(context, 'ARRIVED_AT_TNL', user.role);
      if (!validation.isValid || context.lost || context.currentStatusCode !== 'LOADED_ON_TRUCK'
          || context.trackingId !== trackingId) {
        safeHaptics.error();
        setError(validation.error || 'Only non-lost parcels loaded on a truck can arrive in Daet.');
        return;
      }
      arrivalQueueRef.current = [...arrivalQueueRef.current, context];
      setArrivalQueue(arrivalQueueRef.current);
      setArrivalInput('');
      setError('');
      setNotice(`${trackingId} added to arrival queue. ${arrivalQueueRef.current.length} queued.`);
      safeHaptics.success();
    } catch (err) {
      if (arrivalVersionRef.current !== requestVersion) return;
      safeHaptics.error();
      setError(err?.response?.data?.message || `Failed to verify ${trackingId}. Try again.`);
    } finally {
      if (arrivalVersionRef.current === requestVersion) {
        arrivalPendingRef.current.delete(trackingId);
        setArrivalLookups(arrivalPendingRef.current.size);
      }
    }
  };

  const confirmArrival = async () => {
    if (mode !== 'arrival' || user?.role !== 'DISPATCH_STAFF' || !isOnline || busy
        || arrivalSubmittingRef.current || arrivalPendingRef.current.size > 0
        || arrivalQueueRef.current.length === 0 || pendingArrivalLeave) return;
    const requestVersion = arrivalVersionRef.current;
    arrivalSubmittingRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await trackingScanApi.submitBatchScan(buildBatchScanRequest(
        arrivalQueueRef.current.map((parcel) => parcel.trackingId), 'ARRIVED_AT_TNL', null, user.role
      ));
      if (arrivalVersionRef.current !== requestVersion) return;
      arrivalQueueRef.current = [];
      setArrivalQueue([]);
      setArrivalInput('');
      setNotice('Arrival in Daet confirmed.');
      safeHaptics.success();
    } catch (err) {
      if (arrivalVersionRef.current !== requestVersion) return;
      setError(err?.response?.data?.message || 'Arrival failed. Queue retained; try again.');
    } finally {
      if (arrivalVersionRef.current === requestVersion) {
        arrivalSubmittingRef.current = false;
        setBusy(false);
      }
    }
  };

  // Open existing waybill by ID
  const handleOpenWaybill = async (targetWaybillId) => {
    const cleanNumber = String(targetWaybillId || '').trim().toUpperCase();
    if (!cleanNumber) return;
    Keyboard.dismiss();
    waybillOptionCoordinatorRef.current.cancelAll();
    setIsLoadingWaybillOptions(false);
    setIsLoadingMoreWaybillOptions(false);
    setIsLoadingWaybillRecommendations(false);
    setWaybillRecommendations([]);
    setWaybillRecommendationError('');
    const requestVersion = returnContextVersionRef.current + 1;
    returnContextVersionRef.current = requestVersion;
    setConfirmedWaybillId(null);
    setManifest(null);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const record = await getWaybill(cleanNumber);
      if (returnContextVersionRef.current !== requestVersion) return;
      setManifest(record);
      setWaybillInput(record.waybillId);
      shipmentOptionCoordinatorRef.current.cancelAll();
      setIsLoadingShipments(false);
      setIsLoadingMoreShipments(false);
      setIsLoadingRecommendations(false);
      waybillOptionCoordinatorRef.current.cancelAll();
      setMode('return');
      setNotice(`Waybill ${record.waybillId} opened for review. Scan its printed return QR to enable completion.`);
    } catch (err) {
      if (returnContextVersionRef.current !== requestVersion) return;
      safeHaptics.error();
      setError(err?.response?.data?.message || 'Waybill not found.');
    } finally {
      setBusy(false);
    }
  };

  // Barcode scanned event from camera
  const handleBarcodeScanned = async (event) => {
    const rawValue = event?.data;
    if (!rawValue || scanLockRef.current || !isOnline || busy) return;
    scanLockRef.current = true;

    try {
      if (mode === 'arrival') {
        await processArrivalScan(rawValue);
      } else if (mode === 'return') {
        await processReturnWaybillScan(rawValue);
      } else {
        await processQueueScan(String(rawValue).trim().toUpperCase());
      }
    } finally {
      setTimeout(() => {
        scanLockRef.current = false;
      }, 600);
    }
  };

  // Process adding a parcel unit to the Waybill Manifest Queue (Rapid Batch)
  const processQueueScan = async (candidateId) => {
    if (mode !== 'load' || !isOnline || busy || loadRequestRef.current || pendingShipmentSwitch) return;
    const normalized = normalizeTrackingId(candidateId);
    if (!normalized.isValid) { safeHaptics.error(); setError(normalized.error); return; }
    const cleanId = normalized.trackingId;
    if (batchQueue.includes(cleanId)) { safeHaptics.warning(); setError(`${cleanId} is already in the manifest queue.`); return; }
    const request = { version: arrivalVersionRef.current };
    loadRequestRef.current = request;
    setBusy(true);
    setError('');
    try {
      const context = await trackingScanApi.getScanContext(cleanId);
      if (arrivalVersionRef.current !== request.version) return;
      if (context?.trackingId !== cleanId || !context.shipmentId) throw new Error('Invalid parcel scan context.');
      if (context.shipmentId !== shipmentId) {
        if (shipmentId && batchQueue.length > 0) {
          safeHaptics.warning();
          setPendingShipmentSwitch({ shipmentId: context.shipmentId, context });
        } else {
          await selectShipment(context.shipmentId, context, request);
        }
        return;
      }
      const candidateError = getManifestCandidateError(context, availableUnits);
      if (candidateError) { safeHaptics.error(); setError(candidateError); return; }
      if (batchQueue.length >= MAX_BATCH_SIZE) { safeHaptics.warning(); setError(`Batch queue limit reached (${MAX_BATCH_SIZE} units).`); return; }
      setBatchQueue((previous) => previous.includes(cleanId) ? previous : [...previous, cleanId]);
      safeHaptics.success();
      setNotice(`${cleanId} added to manifest queue. ${batchQueue.length + 1} queued.`);
    } catch (err) {
      if (arrivalVersionRef.current === request.version) {
        safeHaptics.error();
        setError(err?.response?.data?.message || err?.message || 'Could not verify parcel. Try again.');
      }
    } finally {
      if (loadRequestRef.current === request) { loadRequestRef.current = null; setBusy(false); }
    }
  };

  const processReturnWaybillScan = async (rawValue) => {
    const parsed = parseWaybillQrPayload(rawValue);
    if (!parsed.isValid) {
      safeHaptics.error();
      setError('Scan the return confirmation QR printed on the waybill.');
      return;
    }
    if (!doesWaybillQrMatchOpenManifest(manifest, parsed.waybillId)) {
      safeHaptics.error();
      setError(`The scanned QR does not match open waybill ${manifest.waybillId}.`);
      return;
    }

    waybillOptionCoordinatorRef.current.cancelAll();
    setIsLoadingWaybillOptions(false);
    setIsLoadingMoreWaybillOptions(false);
    setIsLoadingWaybillRecommendations(false);

    const requestVersion = returnContextVersionRef.current + 1;
    returnContextVersionRef.current = requestVersion;
    setBusy(true);
    setError('');
    try {
      const record = await getWaybill(parsed.waybillId);
      if (returnContextVersionRef.current !== requestVersion) return;
      const isSentToHauler = record.status === 'SENT_TO_HAULER';
      setManifest(record);
      setWaybillInput(record.waybillId);
      setConfirmedWaybillId(isSentToHauler ? record.waybillId : null);
      setConfirmedManifestRevision(isSentToHauler ? record.manifestRevision : null);
      safeHaptics.success();
      setNotice(isSentToHauler
        ? `${record.waybillId} return confirmed. Review the manifest, then complete the waybill.`
        : `${record.waybillId} opened for review. Status: ${record.statusLabel || record.status}.`);
    } catch {
      if (returnContextVersionRef.current !== requestVersion) return;
      safeHaptics.error();
      setError('The scanned waybill could not be confirmed.');
    } finally {
      setBusy(false);
    }
  };

  // Submit manual tracking ID entry
  const handleManualTrackingSubmit = () => {
    const input = manualTrackingInput.trim().toUpperCase();
    if (!input) return;
    setManualTrackingInput('');
    processQueueScan(input);
  };

  // Add all loaded unassigned units to the manifest queue
  const handleAddAllAvailableToQueue = () => {
    const unqueued = availableUnits
      .map((u) => u.trackingId)
      .filter((id) => !batchQueue.includes(id));
    if (unqueued.length === 0) return;
    const remainingSlots = MAX_BATCH_SIZE - batchQueue.length;
    const toAdd = unqueued.slice(0, remainingSlots);
    setBatchQueue((prev) => [...prev, ...toAdd]);
    safeHaptics.selection();
    setNotice(`Added ${toAdd.length} units to the manifest queue.`);
  };

  const handleRemoveQueueItem = (targetId) => {
    setBatchQueue((prev) => prev.filter((id) => id !== targetId));
    safeHaptics.selection();
  };

  const handleClearBatchQueue = () => {
    setBatchQueue([]);
    safeHaptics.selection();
  };

  // Submit Rapid Batch Queue: Loads un-loaded units and generates the waybill atomically
  const handleGenerateWaybill = async () => {
    if (!shipmentId || batchQueue.length === 0 || !isOnline || busy || generationLockRef.current) return;
    generationLockRef.current = true;
    setShowGenerationConfirmation(false);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // 1. Submit batch scan to ensure all queued units transition to LOADED_TO_HAULER
      await trackingScanApi.submitBatchScan({
        trackingIds: batchQueue,
        targetStatus: 'LOADED_TO_HAULER',
        remarks: 'Waybill dispatch loading batch'
      });

      // 2. Atomically generate the waybill with this manifest
      const record = await generateWaybill({
        shipmentId,
        trackingIds: batchQueue,
        idempotencyKey: generationKey
      });

      safeHaptics.success();
      setManifest(record);
      setWaybillInput(record.waybillId);
      setBatchQueue([]);
      setGenerationKey(Crypto.randomUUID());
      setNotice(`${record.waybillId} generated successfully with ${record.parcels?.length || 0} units!`);

      // Refresh remaining unassigned units and history
      await refreshShipmentData(shipmentId);
    } catch (err) {
      safeHaptics.error();
      setError(err?.response?.data?.message || err?.message || 'Failed to generate waybill.');
    } finally {
      generationLockRef.current = false;
      setBusy(false);
    }
  };

  // Print 2 landscape A4 copies via expo-print
  const handlePrintManifest = async () => {
    if (!manifest || busy) return;
    setBusy(true);
    try {
      const logoUri = Image.resolveAssetSource(require('../../../assets/tracking-logo.png'))?.uri;
      await Print.printAsync({
        html: buildWaybillHtml(manifest, logoUri),
        width: 842,
        height: 595
      });
      setNotice('Print dialog opened. Hand paper copies and units to the driver.');
    } catch {
      setError('Print dialog could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  // Mark Waybill Sent to Driver (recorded paper handover)
  const handleSendWaybill = async () => {
    if (!manifest || busy || !isOnline) return;
    setBusy(true);
    setError('');
    try {
      const record = await sendWaybill(manifest.waybillId);
      setManifest(record);
      safeHaptics.success();
      setNotice(`${record.waybillId} marked sent to driver.`);
      if (shipmentId) await refreshShipmentData(shipmentId);
    } catch (err) {
      safeHaptics.error();
      setError(err?.response?.data?.message || err?.message || 'Failed to mark waybill sent.');
    } finally {
      setBusy(false);
    }
  };

  // Complete returned signed waybill
  const handleCompleteWaybill = async () => {
    if (!manifest || busy || !isOnline || isCompletingWaybill.current) return;
    if (!isWaybillCompletionUnlocked(manifest, confirmedWaybillId, confirmedManifestRevision)) {
      safeHaptics.error();
      setError('Scan the matching return confirmation QR printed on this waybill first.');
      return;
    }

    isCompletingWaybill.current = true;
    setBusy(true);
    setError('');
    try {
      const record = await completeWaybill(manifest.waybillId, {
        confirmedWaybillId,
        manifestRevision: confirmedManifestRevision
      });
      setManifest(record);
      setConfirmedWaybillId(null);
      safeHaptics.success();
      setNotice(`${record.waybillId}: ${record.deliveredCount} delivered, ${record.lostCount} lost. ${record.statusLabel}.`);
      if (shipmentId) await refreshShipmentData(shipmentId);
    } catch (err) {
      safeHaptics.error();
      if (err?.response?.status === 409) {
        setConfirmedWaybillId(null);
        setConfirmedManifestRevision(null);
        try {
          const refreshed = await getWaybill(manifest.waybillId);
          setManifest(refreshed);
        } catch {
          setManifest(null);
        }
      }
      setError(err?.response?.data?.message || 'Failed to complete waybill.');
    } finally {
      isCompletingWaybill.current = false;
      setBusy(false);
    }
  };

  if (!canAccessMobileRoute(user?.role, MOBILE_ROUTES.WAYBILLS)) {
    return null;
  }

  const viewfinderHeight = CAMERA_HEIGHTS[cameraHeightIndex] || CAMERA_HEIGHTS[1];
  const cameraActive = !isKeyboardVisible && cameraHeightIndex > 0 && isOnline && (!busy || (mode === 'load' && loadRequestRef.current !== null)) && isScreenFocused && (
    mode === 'load' ||
    mode === 'return' || mode === 'arrival'
  ) && !pendingArrivalLeave && !pendingShipmentSwitch;

  const canGenerate = Boolean(shipmentId) && batchQueue.length > 0 && isOnline && !busy;
  const canComplete = isWaybillCompletionUnlocked(manifest, confirmedWaybillId, confirmedManifestRevision)
    && isOnline
    && !busy;

  const getInstructionText = () => {
    if (mode === 'arrival') return `Arrival: ${arrivalQueue.length} / ${MAX_BATCH_SIZE} parcels queued`;
    if (mode === 'load') {
      if (!shipmentId) return 'Scan a parcel QR to open its shipment';
      return `Rapid Batch: ${batchQueue.length} / ${MAX_BATCH_SIZE} units queued`;
    }
    if (!manifest) return 'Scan the return confirmation QR printed on the waybill';
    if (manifest.status !== 'SENT_TO_HAULER') return `${manifest.waybillId} opened for review`;
    if (canComplete) return `${manifest.waybillId} confirmed. Review manifest and complete below`;
    return `Scan the printed return QR for ${manifest.waybillId}`;
  };

  const getPausedText = () => {
    if (!isOnline) return 'Internet connection required for waybill operations';
    return 'Camera preview paused';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal
        visible={Boolean(pendingShipmentSwitch)}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) setPendingShipmentSwitch(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.generationReviewCard}>
            <View style={styles.generationReviewHeader}>
              <View style={styles.generationReviewIcon}>
                <Icon source="swap-horizontal" size={24} color={colors.accent} />
              </View>
              <View style={styles.generationReviewTitleGroup}>
                <Text style={styles.generationReviewTitle}>Switch Active Shipment?</Text>
                <Text style={styles.generationReviewSubtitle}>
                  Scanned parcel belongs to a different shipment. Switching will discard the current manifest queue.
                </Text>
              </View>
            </View>

            <View style={styles.generationReviewSummary}>
              <View style={styles.generationReviewSummaryItem}>
                <Text style={styles.generationReviewLabel}>CURRENT SHIPMENT</Text>
                <Text style={styles.generationReviewValue}>{shipmentId || 'None'}</Text>
                <Text style={styles.actionHint}>{batchQueue.length} queued unit(s)</Text>
              </View>
              <View style={styles.generationReviewSummaryItem}>
                <Text style={styles.generationReviewLabel}>TARGET SHIPMENT</Text>
                <Text style={styles.generationReviewValue}>{pendingShipmentSwitch?.shipmentId}</Text>
                <Text style={styles.actionHint}>New manifest</Text>
              </View>
            </View>

            <View style={styles.switchModalActions}>
              <TouchableOpacity
                disabled={busy || !isOnline}
                onPress={() => handleSelectShipment(pendingShipmentSwitch.shipmentId, pendingShipmentSwitch.context, true)}
                style={[styles.primaryButton, (busy || !isOnline) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>Switch shipment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busy}
                onPress={() => setPendingShipmentSwitch(null)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(pendingArrivalLeave)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingArrivalLeave(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.generationReviewCard}>
            <View style={styles.generationReviewHeader}>
              <View style={[styles.generationReviewIcon, { backgroundColor: colors.warningSoft }]}>
                <Icon source="alert-outline" size={24} color={colors.warning} />
              </View>
              <View style={styles.generationReviewTitleGroup}>
                <Text style={styles.generationReviewTitle}>Discard Arrival Queue?</Text>
                <Text style={styles.generationReviewSubtitle}>
                  Leaving will discard {arrivalQueue.length} queued parcel(s) without updating their status.
                </Text>
              </View>
            </View>
            <View style={styles.switchModalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPendingArrivalLeave(null)}>
                <Text style={styles.secondaryButtonText}>Keep arrival queue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.danger }]}
                onPress={discardArrivalQueue}
              >
                <Text style={styles.primaryButtonText}>Discard arrival queue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        {/* Header matching scan.js */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Icon source="arrow-left" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>WAYBILL DISPATCH</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Viewfinder Camera Region */}
        <ScanViewfinder
          cameraActive={cameraActive}
          torchEnabled={torchEnabled}
          onToggleTorch={() => setTorchEnabled((t) => !t)}
          onBarcodeScanned={handleBarcodeScanned}
          permissionGranted={Boolean(permission?.granted)}
          onRequestPermission={requestPermission}
          instructionText={getInstructionText()}
          pausedText={getPausedText()}
          viewfinderHeight={viewfinderHeight}
          animatedHeight={animatedCameraHeight}
        />

        <View
          {...cameraDividerPanResponder.panHandlers}
          style={[styles.cameraDivider, isKeyboardVisible && styles.cameraDividerDisabled]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Camera panel height"
          accessibilityHint="Swipe up to reduce the camera, swipe down to enlarge it, or tap to toggle its height"
          accessibilityValue={{
            min: 0,
            max: CAMERA_HEIGHTS.length - 1,
            now: isKeyboardVisible ? 0 : cameraHeightIndex,
            text: isKeyboardVisible ? 'Collapsed while typing' : CAMERA_HEIGHT_LABELS[cameraHeightIndex]
          }}
          accessibilityState={{ disabled: isKeyboardVisible }}
          accessibilityActions={[
            { name: 'increment', label: 'Increase camera height' },
            { name: 'decrement', label: 'Decrease camera height' },
            { name: 'activate', label: 'Toggle camera height' }
          ]}
          onAccessibilityAction={handleCameraAccessibilityAction}
        >
          <View style={styles.cameraDividerHandle} />
        </View>

        {/* Network Offline Banner */}
        {!isOnline && (
          <View style={styles.networkBanner}>
            <Icon source="wifi-off" size={18} color={colors.danger} />
            <Text style={styles.networkBannerText}>
              No internet connection. Waybill actions are temporarily disabled.
            </Text>
          </View>
        )}

        <ScanFeedbackBanner
          kind={error ? (/already|limit reached/.test(error) ? 'warning' : 'error')
            : (arrivalLookups > 0 || busy) ? 'loading' : 'success'}
          message={error || (arrivalLookups > 0 ? 'Checking parcel...'
            : busy ? (loadRequestRef.current ? 'Checking parcel...'
              : mode === 'return' ? 'Processing waybill...' : 'Processing request...') : notice)}
          onDismiss={() => { setError(''); setNotice(''); }}
        />

        {/* Bottom Operations Panel */}
        <View style={styles.bottomPanel}>
          {/* Mode Switcher Tabs */}
          <View style={styles.modeSwitcherRow}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                styles.modeTabBorderRight,
                mode === 'arrival' && styles.modeTabActive
              ]}
              onPress={() => handleModeChange('arrival')}
              disabled={busy}
            >
              <Text style={[styles.modeTabText, mode === 'arrival' && styles.modeTabTextActive]}>
                ARRIVE IN DAET
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeTab,
                styles.modeTabBorderRight,
                mode === 'load' && styles.modeTabActive
              ]}
              onPress={() => handleModeChange('load')}
              disabled={busy}
            >
              <Text style={[styles.modeTabText, mode === 'load' && styles.modeTabTextActive]}>
                LOAD & GENERATE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeTab,
                mode === 'return' && styles.modeTabActive
              ]}
              onPress={() => handleModeChange('return')}
              disabled={busy}
            >
              <Text style={[styles.modeTabText, mode === 'return' && styles.modeTabTextActive]}>
                RETURNED WAYBILL
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.panelScrollView}
            contentContainerStyle={styles.panelContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'android' ? 'on-drag' : undefined
            }
            nestedScrollEnabled
          >
            {mode === 'arrival' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionEyebrow}>ARRIVAL QUEUE ({arrivalQueue.length}/{MAX_BATCH_SIZE})</Text>
                  {arrivalQueue.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        arrivalQueueRef.current = [];
                        setArrivalQueue([]);
                      }}
                      disabled={busy || Boolean(pendingArrivalLeave)}
                    >
                      <Text style={styles.clearLinkText}>CLEAR</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.actionHint}>
                  Scan parcel QR codes with camera or enter tracking IDs below. Status changes only after confirmation.
                </Text>

                {arrivalQueue.length === 0 ? (
                  <View style={styles.emptyQueueBox}>
                    <Icon source="truck-check-outline" size={32} color={colors.inkFaint} />
                    <Text style={styles.emptyQueueTitle}>No arrivals queued</Text>
                    <Text style={styles.emptyQueueText}>
                      Scan loaded-on-truck parcel QR codes or enter tracking IDs below to record arrival in Daet.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.queueItemsList}
                    contentContainerStyle={styles.queueItemsContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {arrivalQueue.map((parcel, index) => (
                      <View key={parcel.trackingId} style={styles.queueItemRow}>
                        <Text style={styles.queueIndex}>#{index + 1}</Text>
                        <View style={styles.arrivalParcelInfo}>
                          <Text style={styles.queueTrackingId}>{parcel.trackingId}</Text>
                          <Text style={styles.historyMeta}>
                            {parcel.shipmentId} / {parcel.currentStatusLabel || parcel.currentStatusCode}
                          </Text>
                        </View>
                        <TouchableOpacity
                          accessibilityLabel={`Remove arrival ${parcel.trackingId}`}
                          style={styles.queueRemoveButton}
                          disabled={busy || Boolean(pendingArrivalLeave)}
                          onPress={() => {
                            arrivalQueueRef.current = arrivalQueueRef.current.filter((item) => item.trackingId !== parcel.trackingId);
                            setArrivalQueue(arrivalQueueRef.current);
                          }}
                        >
                          <Icon source="close" size={16} color={colors.inkFaint} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {arrivalLookups > 0 && (
                  <View style={styles.inlineStateRow}>
                    <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Verifying arrival parcels" />
                    <Text style={styles.inlineStateText}>Verifying arrival parcel eligibility...</Text>
                  </View>
                )}

                <View style={styles.manualInputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="TRK-YYYY-NNNNNN"
                    placeholderTextColor={colors.inkFaint}
                    accessibilityLabel="Arrival tracking ID"
                    value={arrivalInput}
                    onChangeText={setArrivalInput}
                    onFocus={handleManualInputFocus}
                    onSubmitEditing={() => processArrivalScan(arrivalInput)}
                    autoCapitalize="characters"
                    maxLength={15}
                    editable={!busy && !pendingArrivalLeave}
                  />
                  <TouchableOpacity
                    style={[
                      styles.actionButtonCompact,
                      styles.arrivalAddButton,
                      (!isOnline || busy || !arrivalInput.trim() || Boolean(pendingArrivalLeave)) && styles.buttonDisabled
                    ]}
                    disabled={!isOnline || busy || !arrivalInput.trim() || Boolean(pendingArrivalLeave)}
                    onPress={() => processArrivalScan(arrivalInput)}
                  >
                    <Text style={styles.actionButtonText}>ADD ARRIVAL</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!isOnline || busy || arrivalLookups > 0 || arrivalQueue.length === 0 || Boolean(pendingArrivalLeave)) && styles.buttonDisabled
                  ]}
                  disabled={!isOnline || busy || arrivalLookups > 0 || arrivalQueue.length === 0 || Boolean(pendingArrivalLeave)}
                  onPress={confirmArrival}
                >
                  <Text style={styles.primaryButtonText}>Confirm Arrival in Daet</Text>
                </TouchableOpacity>
                <Text style={styles.actionHint}>
                  Atomic batch update. Parcels transition to Arrived in Daet and their truck assignments are cleared.
                </Text>
              </View>
            ) : mode === 'load' ? (
              <>
                {/* 1. Shipment Selector */}
                {!shipmentId ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionEyebrow}>SELECT ACTIVE SHIPMENT</Text>
                    <View style={styles.inputActionRow}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="SHP-YYYY-NNN"
                        placeholderTextColor={colors.inkFaint}
                        value={shipmentIdInput}
                        onChangeText={setShipmentIdInput}
                        onFocus={handleManualInputFocus}
                        autoCapitalize="characters"
                        maxLength={20}
                        onSubmitEditing={() => handleSelectShipment(shipmentIdInput)}
                        editable={isOnline && !busy}
                      />
                      <TouchableOpacity
                        style={[
                          styles.actionButtonCompact,
                          (!shipmentIdInput.trim() || !isOnline || busy) && styles.buttonDisabled
                        ]}
                        onPress={() => handleSelectShipment(shipmentIdInput)}
                        disabled={!shipmentIdInput.trim() || !isOnline || busy}
                      >
                        <Text style={styles.actionButtonText}>SELECT</Text>
                      </TouchableOpacity>
                    </View>

                    {isRecommendationSearchActive ? (
                      <View style={styles.recommendationPanel}>
                        <Text style={[styles.subtleLabel, styles.recommendationLabel]}>
                          Shipment Recommendations
                        </Text>
                        {isLoadingRecommendations ? (
                          <View style={styles.inlineStateRow}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={styles.inlineStateText}>Searching shipment numbers...</Text>
                          </View>
                        ) : recommendationError ? (
                          <View style={styles.inlineStateRow}>
                            <Text style={styles.inlineStateText}>{recommendationError}</Text>
                            <TouchableOpacity
                              onPress={() => setRecommendationRetryVersion((version) => version + 1)}
                              disabled={!isOnline}
                            >
                              <Text style={styles.inlineRetryText}>RETRY</Text>
                            </TouchableOpacity>
                          </View>
                        ) : shipmentRecommendations.length === 0 ? (
                          <Text style={styles.inlineStateText}>No matching shipment numbers.</Text>
                        ) : (
                          shipmentRecommendations.map((shipment) => (
                            <TouchableOpacity
                              key={shipment.shipmentId}
                              style={styles.recommendationRow}
                              onPress={() => handleSelectShipment(shipment.shipmentId)}
                              disabled={!isOnline || busy}
                            >
                              <View style={styles.recommendationTextGroup}>
                                <Text style={styles.shipmentChipId}>{shipment.shipmentId}</Text>
                                {Boolean(shipment.recipientName) && (
                                  <Text style={styles.shipmentChipSub} numberOfLines={1}>
                                    {shipment.recipientName}
                                  </Text>
                                )}
                              </View>
                              <Icon source="chevron-right" size={18} color={colors.inkFaint} />
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    ) : (
                      <View style={styles.chipListContainer}>
                        <Text style={styles.subtleLabel}>Recent Shipments</Text>
                        {isLoadingShipments && shipments.length === 0 ? (
                          <View style={styles.inlineStateRow}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={styles.inlineStateText}>Loading recent shipments...</Text>
                          </View>
                        ) : shipmentLoadError && shipments.length === 0 ? (
                          <View style={styles.inlineStateRow}>
                            <Text style={styles.inlineStateText}>{shipmentLoadError}</Text>
                            <TouchableOpacity onPress={loadRecentShipmentOptions} disabled={!isOnline}>
                              <Text style={styles.inlineRetryText}>RETRY</Text>
                            </TouchableOpacity>
                          </View>
                        ) : shipments.length === 0 ? (
                          <Text style={styles.inlineStateText}>No shipments are available.</Text>
                        ) : (
                          <FlatList
                            horizontal
                            keyboardShouldPersistTaps="handled"
                            data={shipments}
                            keyExtractor={(shipment) => shipment.shipmentId}
                            renderItem={({ item: shipment }) => (
                              <TouchableOpacity
                                style={styles.shipmentChip}
                                onPress={() => handleSelectShipment(shipment.shipmentId)}
                                disabled={!isOnline || busy}
                              >
                                <Text style={styles.shipmentChipId}>{shipment.shipmentId}</Text>
                                {Boolean(shipment.recipientName) && (
                                  <Text style={styles.shipmentChipSub} numberOfLines={1}>
                                    {shipment.recipientName}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            )}
                            showsHorizontalScrollIndicator={false}
                            onEndReached={loadNextShipmentOptions}
                            onEndReachedThreshold={0.4}
                            contentContainerStyle={styles.chipListContent}
                            ListFooterComponent={(
                              <View style={styles.railFooter}>
                                {isLoadingMoreShipments || (isLoadingShipments && shipments.length > 0) ? (
                                  <ActivityIndicator size="small" color={colors.accent} />
                                ) : shipmentPageError ? (
                                  <TouchableOpacity onPress={loadNextShipmentOptions} disabled={!isOnline}>
                                    <Text style={styles.inlineRetryText}>RETRY MORE</Text>
                                  </TouchableOpacity>
                                ) : shipmentLoadError ? (
                                  <TouchableOpacity onPress={loadRecentShipmentOptions} disabled={!isOnline}>
                                    <Text style={styles.inlineRetryText}>RETRY REFRESH</Text>
                                  </TouchableOpacity>
                                ) : !hasMoreShipments ? (
                                  <Text style={styles.railEndText}>END</Text>
                                ) : null}
                              </View>
                            )}
                          />
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.activeShipmentCard}>
                    <View style={styles.activeShipmentHeader}>
                      <View style={styles.shipmentBadge}>
                        <Text style={styles.shipmentBadgeText}>SHIPMENT</Text>
                      </View>
                      <Text style={styles.activeShipmentId}>{shipmentId}</Text>
                      <TouchableOpacity
                        style={styles.changeLink}
                        onPress={handleClearShipment}
                        disabled={busy}
                      >
                        <Text style={styles.changeLinkText}>CHANGE</Text>
                      </TouchableOpacity>
                    </View>
                    {Boolean(selectedShipment?.recipientName) && (
                      <Text style={styles.activeShipmentRecipient}>
                        {selectedShipment.recipientName}
                        {Boolean(selectedShipment?.recipientAddress) ? ` · ${selectedShipment.recipientAddress}` : ''}
                      </Text>
                    )}
                    <View style={styles.shipmentMetricsRow}>
                      <Text style={styles.metricItem}>
                        Hub Available: <Text style={styles.metricValue}>{availableUnits.length}</Text>
                      </Text>
                      <Text style={styles.metricItem}>
                        Waybills: <Text style={styles.metricValue}>{shipmentWaybills.length}</Text>
                      </Text>
                    </View>
                  </View>
                )}

                {/* 2. Rapid Batch Queue for Waybill Generation */}
                {Boolean(shipmentId) && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionEyebrow}>
                        MANIFEST QUEUE ({batchQueue.length} / {MAX_BATCH_SIZE})
                      </Text>
                      {batchQueue.length > 0 && (
                        <TouchableOpacity onPress={handleClearBatchQueue} disabled={busy}>
                          <Text style={styles.clearLinkText}>CLEAR</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {batchQueue.length === 0 ? (
                      <View style={styles.emptyQueueBox}>
                        <Icon source="qrcode-scan" size={28} color={colors.inkFaint} />
                        <Text style={styles.emptyQueueText}>
                          Scan unit QR codes with camera or enter tracking IDs below to queue for this waybill manifest.
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        style={styles.queueItemsList}
                        contentContainerStyle={styles.queueItemsContent}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {batchQueue.map((id, index) => (
                          <View key={id} style={styles.queueItemRow}>
                            <Text style={styles.queueIndex}>#{index + 1}</Text>
                            <Text style={styles.queueTrackingId}>{id}</Text>
                            <TouchableOpacity
                              style={styles.queueRemoveButton}
                              onPress={() => handleRemoveQueueItem(id)}
                              disabled={busy}
                            >
                              <Icon source="close" size={16} color={colors.inkFaint} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {/* Manual Tracking ID Entry Fallback */}
                    <View style={styles.manualInputRow}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="TRK-YYYY-NNNNNN"
                        placeholderTextColor={colors.inkFaint}
                        value={manualTrackingInput}
                        onChangeText={setManualTrackingInput}
                        onFocus={handleManualInputFocus}
                        autoCapitalize="characters"
                        maxLength={15}
                        onSubmitEditing={handleManualTrackingSubmit}
                        editable={isOnline && !busy}
                      />
                      <TouchableOpacity
                        style={[
                          styles.actionButtonCompact,
                          (!manualTrackingInput.trim() || !isOnline || busy) && styles.buttonDisabled
                        ]}
                        onPress={handleManualTrackingSubmit}
                        disabled={!manualTrackingInput.trim() || !isOnline || busy}
                      >
                        <Text style={styles.actionButtonText}>ADD</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Submit Rapid Batch & Generate Waybill Button */}
                    <TouchableOpacity
                      style={[styles.primaryButton, (!canGenerate || busy) && styles.buttonDisabled]}
                      onPress={() => setShowGenerationConfirmation(true)}
                      disabled={!canGenerate || busy}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          GENERATE WAYBILL ({batchQueue.length} UNITS)
                        </Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.actionHint}>
                      Generates a fixed paper waybill manifest. Any arrived units will be recorded as loaded.
                    </Text>
                  </View>
                )}

                {/* 3. Available Unassigned Units Helper */}
                {Boolean(shipmentId) && availableUnits.length > 0 && (
                  <View style={styles.helperCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionEyebrow}>
                        AVAILABLE IN HUB ({availableUnits.length})
                      </Text>
                      <TouchableOpacity onPress={handleAddAllAvailableToQueue} disabled={busy}>
                        <Text style={styles.helperActionText}>+ ADD ALL TO QUEUE</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.availableChipsRow}>
                      {availableUnits.slice(0, 10).map((u) => {
                        const isQueued = batchQueue.includes(u.trackingId);
                        return (
                          <TouchableOpacity
                            key={u.trackingId}
                            style={[styles.availableChip, isQueued && styles.availableChipQueued]}
                            onPress={() => {
                              if (!isQueued) {
                                processQueueScan(u.trackingId);
                              }
                            }}
                            disabled={isQueued || busy}
                          >
                            <Text style={[styles.availableChipText, isQueued && styles.availableChipTextQueued]}>
                              {isQueued ? `[✓] ${u.trackingId}` : `+ ${u.trackingId}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 4. Shipment Waybills History */}
                {Boolean(shipmentId) && shipmentWaybills.length > 0 && (
                  <View style={styles.helperCard}>
                    <Text style={styles.sectionEyebrow}>
                      SHIPMENT WAYBILLS ({shipmentWaybills.length})
                    </Text>
                    {shipmentWaybills.map((wb) => (
                      <TouchableOpacity
                        key={wb.waybillId}
                        style={styles.waybillHistoryRow}
                        onPress={() => handleOpenWaybill(wb.waybillId)}
                        disabled={busy}
                      >
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyWaybillId}>{wb.waybillId}</Text>
                          <Text style={styles.historyMeta}>
                            {wb.parcels?.length || 0} units · {wb.statusLabel || wb.status}
                          </Text>
                        </View>
                        <Icon source="chevron-right" size={20} color={colors.inkFaint} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                {/* RETURNED WAYBILL MODE */}
                {!manifest ? (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionEyebrow}>SELECT RETURNED WAYBILL</Text>
                    <View style={styles.inputActionRow}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="WYB-YYYY-NNNN"
                        placeholderTextColor={colors.inkFaint}
                        value={waybillInput}
                        onChangeText={setWaybillInput}
                        onFocus={handleManualInputFocus}
                        autoCapitalize="characters"
                        maxLength={20}
                        onSubmitEditing={() => handleOpenWaybill(waybillInput)}
                        editable={isOnline && !busy}
                      />
                      <TouchableOpacity
                        style={[
                          styles.actionButtonCompact,
                          (!waybillInput.trim() || !isOnline || busy) && styles.buttonDisabled
                        ]}
                        onPress={() => handleOpenWaybill(waybillInput)}
                        disabled={!waybillInput.trim() || !isOnline || busy}
                      >
                        <Text style={styles.actionButtonText}>SELECT</Text>
                      </TouchableOpacity>
                    </View>

                    {isWaybillRecommendationSearchActive ? (
                      <View style={styles.recommendationPanel}>
                      <Text style={[styles.subtleLabel, styles.recommendationLabel]}>
                        Waybill Recommendations
                      </Text>
                      {isLoadingWaybillRecommendations ? (
                        <View style={styles.inlineStateRow}>
                          <ActivityIndicator size="small" color={colors.accent} />
                          <Text style={styles.inlineStateText}>Searching waybill numbers...</Text>
                        </View>
                      ) : waybillRecommendationError ? (
                        <View style={styles.inlineStateRow}>
                          <Text style={styles.inlineStateText}>{waybillRecommendationError}</Text>
                          <TouchableOpacity
                            onPress={() => setWaybillRecommendationRetryVersion((version) => version + 1)}
                            disabled={!isOnline}
                          >
                            <Text style={styles.inlineRetryText}>RETRY</Text>
                          </TouchableOpacity>
                        </View>
                      ) : waybillRecommendations.length === 0 ? (
                        <Text style={styles.inlineStateText}>No matching returned waybills.</Text>
                      ) : (
                        waybillRecommendations.map((option) => (
                          <TouchableOpacity
                            key={option.waybillId}
                            style={styles.recommendationRow}
                            onPress={() => handleOpenWaybill(option.waybillId)}
                            disabled={!isOnline || busy}
                          >
                            <View style={styles.recommendationTextGroup}>
                              <Text style={styles.shipmentChipId}>{option.waybillId}</Text>
                              <Text style={[styles.shipmentChipSub, styles.waybillOptionMeta]} numberOfLines={1}>
                                {option.shipmentId} · {option.parcelCount} units · {option.statusLabel}
                              </Text>
                            </View>
                            <Icon source="chevron-right" size={18} color={colors.inkFaint} />
                          </TouchableOpacity>
                        ))
                      )}
                      </View>
                    ) : (
                      <View style={styles.chipListContainer}>
                      <Text style={styles.subtleLabel}>Recent Returned Waybills</Text>
                      {isLoadingWaybillOptions && waybillOptions.length === 0 ? (
                        <View style={styles.inlineStateRow}>
                          <ActivityIndicator size="small" color={colors.accent} />
                          <Text style={styles.inlineStateText}>Loading recent returned waybills...</Text>
                        </View>
                      ) : waybillOptionLoadError && waybillOptions.length === 0 ? (
                        <View style={styles.inlineStateRow}>
                          <Text style={styles.inlineStateText}>{waybillOptionLoadError}</Text>
                          <TouchableOpacity onPress={loadRecentWaybillOptions} disabled={!isOnline}>
                            <Text style={styles.inlineRetryText}>RETRY</Text>
                          </TouchableOpacity>
                        </View>
                      ) : waybillOptions.length === 0 ? (
                        <Text style={styles.inlineStateText}>No waybills are awaiting return.</Text>
                      ) : (
                        <FlatList
                          horizontal
                          keyboardShouldPersistTaps="handled"
                          data={waybillOptions}
                          keyExtractor={(option) => option.waybillId}
                          renderItem={({ item: option }) => (
                            <TouchableOpacity
                              style={styles.shipmentChip}
                              onPress={() => handleOpenWaybill(option.waybillId)}
                              disabled={!isOnline || busy}
                            >
                              <Text style={styles.shipmentChipId}>{option.waybillId}</Text>
                              <Text style={styles.shipmentChipSub} numberOfLines={1}>
                                {option.shipmentId} · {option.parcelCount} units
                              </Text>
                            </TouchableOpacity>
                          )}
                          showsHorizontalScrollIndicator={false}
                          onEndReached={loadNextWaybillOptions}
                          onEndReachedThreshold={0.4}
                          contentContainerStyle={styles.chipListContent}
                          ListFooterComponent={(
                            <View style={styles.railFooter}>
                              {isLoadingMoreWaybillOptions
                                || (isLoadingWaybillOptions && waybillOptions.length > 0) ? (
                                <ActivityIndicator size="small" color={colors.accent} />
                              ) : waybillOptionPageError ? (
                                <TouchableOpacity onPress={loadNextWaybillOptions} disabled={!isOnline}>
                                  <Text style={styles.inlineRetryText}>RETRY MORE</Text>
                                </TouchableOpacity>
                              ) : waybillOptionLoadError ? (
                                <TouchableOpacity onPress={loadRecentWaybillOptions} disabled={!isOnline}>
                                  <Text style={styles.inlineRetryText}>RETRY REFRESH</Text>
                                </TouchableOpacity>
                              ) : !hasMoreWaybillOptions ? (
                                <Text style={styles.railEndText}>END</Text>
                              ) : null}
                            </View>
                          )}
                        />
                      )}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.activeShipmentCard}>
                    <View style={styles.activeShipmentHeader}>
                      <View style={styles.shipmentBadge}>
                        <Text style={styles.shipmentBadgeText}>WAYBILL</Text>
                      </View>
                      <Text style={styles.activeShipmentId}>{manifest.waybillId}</Text>
                      <TouchableOpacity
                        style={styles.changeLink}
                        onPress={handleClearWaybill}
                        disabled={busy}
                      >
                        <Text style={styles.changeLinkText}>CHANGE</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.activeShipmentRecipient}>
                      Shipment: {manifest.shipmentId}
                    </Text>
                    <View style={styles.shipmentMetricsRow}>
                      <Text style={styles.metricItem}>
                        Units: <Text style={styles.metricValue}>{manifest.parcels?.length || 0}</Text>
                      </Text>
                      <Text style={styles.metricItem}>
                        Status: <Text style={styles.metricValue}>{manifest.statusLabel || manifest.status}</Text>
                      </Text>
                    </View>
                  </View>
                )}

              </>
            )}

            {/* 5. Active Waybill Manifest Card (Displayed when a waybill is loaded or just generated) */}
            {Boolean(manifest) && (
              <View style={styles.manifestCard}>
                <View style={styles.manifestHeader}>
                  <View>
                    <Text style={styles.manifestEyebrow}>WAYBILL MANIFEST</Text>
                    <Text style={styles.manifestId}>{manifest.waybillId}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      manifest.lostCount > 0
                        ? styles.statusPillLoss
                        : manifest.status === 'SIGNED_COMPLETED'
                        ? styles.statusPillSuccess
                        : manifest.status === 'SENT_TO_HAULER'
                        ? styles.statusPillWarning
                        : styles.statusPillInfo
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        manifest.lostCount > 0
                          ? styles.statusPillTextLoss
                          : manifest.status === 'SIGNED_COMPLETED'
                          ? styles.statusPillTextSuccess
                          : manifest.status === 'SENT_TO_HAULER'
                          ? styles.statusPillTextWarning
                          : styles.statusPillTextInfo
                      ]}
                    >
                      {manifest.statusLabel || manifest.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.manifestMeta}>
                  Shipment: {manifest.shipmentId} · Units: {manifest.parcels?.length || 0}
                </Text>
                <View style={styles.manifestCounts}>
                  <View style={styles.manifestCountItem}>
                    <Text style={styles.manifestCountLabel}>DELIVERED</Text>
                    <Text style={styles.manifestCountValue}>{manifest.deliveredCount || 0}</Text>
                  </View>
                  <View style={[styles.manifestCountItem, manifest.lostCount > 0 && styles.manifestLostCountItem]}>
                    <Text style={[styles.manifestCountLabel, manifest.lostCount > 0 && styles.manifestLostText]}>LOST</Text>
                    <Text style={[styles.manifestCountValue, manifest.lostCount > 0 && styles.manifestLostText]}>{manifest.lostCount || 0}</Text>
                  </View>
                  <View style={styles.manifestCountItem}>
                    <Text style={styles.manifestCountLabel}>REMAINING</Text>
                    <Text style={styles.manifestCountValue}>{manifest.remainingCount ?? manifest.parcels?.length}</Text>
                  </View>
                </View>
                {manifest.lostCount > 0 && <View style={styles.lossNotice}>
                  <Icon source="alert-circle-outline" size={18} color={colors.danger} />
                  <View style={styles.lossNoticeCopy}>
                    <Text style={styles.lossNoticeTitle}>LOSS EXCEPTION</Text>
                    <Text style={styles.lossNoticeText}>
                      Lost parcels remain listed and will not be marked delivered.
                      {manifest.lostCount === manifest.totalQuantity ? ' Admin must close this waybill as all lost.' : ''}
                    </Text>
                  </View>
                </View>}

                <View style={styles.verificationBox}>
                  <Text style={styles.verificationSummaryText}>
                    PERSISTED MANIFEST UNITS ({manifest.parcels?.length || 0})
                  </Text>
                  <View style={styles.manifestUnitsList}>
                    {manifest.parcels?.map((unit) => (
                      <View key={unit.trackingId} style={[styles.manifestUnitRow, unit.lost && styles.manifestUnitLost]}>
                        <Icon source="package-variant-closed" size={18} color={colors.inkFaint} />
                        <Text style={styles.manifestUnitTrackingId}>{unit.trackingId}</Text>
                        {unit.lost && <View style={styles.manifestLossTag}>
                          <Text style={styles.manifestLossTagText}>LOST</Text>
                        </View>}
                        <Text style={styles.manifestUnitSeq}>#{unit.seq}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Print Action */}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handlePrintManifest}
                  disabled={busy}
                >
                  <Icon source="printer" size={18} color={colors.ink} />
                  <Text style={styles.secondaryButtonText}>PRINT TWO A4 COPIES</Text>
                </TouchableOpacity>

                {/* Mark Sent Action */}
                {manifest.status === 'GENERATED' && (
                  <View style={styles.actionBlock}>
                    <Text style={styles.actionHint}>
                      Hand the printed 2-copy waybill and parcels to the driver, then mark sent below.
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryButton, (!isOnline || busy) && styles.buttonDisabled]}
                      onPress={handleSendWaybill}
                      disabled={!isOnline || busy}
                    >
                      <Text style={styles.primaryButtonText}>MARK PAPER & UNITS SENT TO DRIVER</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Complete Signed Return Action */}
                {manifest.status === 'SENT_TO_HAULER' && (
                  <View style={styles.actionBlock}>
                    <Text style={styles.actionHint}>
                      {canComplete
                        ? 'The printed QR was scanned. Review delivered, lost, and remaining counts. Confirm to deliver only remaining non-lost units.'
                        : 'Manual lookup is for review and reprinting. Scan this waybill\'s printed return QR to enable completion.'}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        !canComplete && styles.buttonDisabled
                      ]}
                      onPress={handleCompleteWaybill}
                      disabled={!canComplete}
                    >
                      <Text style={styles.primaryButtonText}>
                        Confirm Return & Complete Waybill
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>

        <Modal
          visible={showGenerationConfirmation}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGenerationConfirmation(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.generationReviewCard}>
              <View style={styles.generationReviewHeader}>
                <View style={styles.generationReviewIcon}>
                  <Icon source="file-document-check-outline" size={24} color={colors.accent} />
                </View>
                <View style={styles.generationReviewTitleGroup}>
                  <Text style={styles.generationReviewTitle}>Review Waybill Manifest</Text>
                  <Text style={styles.generationReviewSubtitle}>
                    Confirm the shipment and every unit before generation.
                  </Text>
                </View>
              </View>

              <View style={styles.generationReviewSummary}>
                <View style={styles.generationReviewSummaryItem}>
                  <Text style={styles.generationReviewLabel}>SHIPMENT</Text>
                  <Text style={styles.generationReviewValue}>{shipmentId}</Text>
                </View>
                <View style={styles.generationReviewSummaryItem}>
                  <Text style={styles.generationReviewLabel}>MANIFEST UNITS</Text>
                  <Text style={styles.generationReviewValue}>{batchQueue.length}</Text>
                </View>
              </View>

              <ScrollView
                style={styles.generationReviewList}
                contentContainerStyle={styles.generationReviewListContent}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {batchQueue.map((trackingId, index) => (
                  <View key={trackingId} style={styles.generationReviewUnit}>
                    <Text style={styles.generationReviewIndex}>#{index + 1}</Text>
                    <Text style={styles.generationReviewTrackingId}>{trackingId}</Text>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.generationReviewWarning}>
                Generation creates a fixed manifest. Units not listed here can be placed on a later waybill.
              </Text>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowGenerationConfirmation(false)}
                >
                  <Text style={styles.modalCancelButtonText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={handleGenerateWaybill}
                >
                  <Text style={styles.modalConfirmButtonText}>CONFIRM & GENERATE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  container: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    padding: spacing.xs
  },
  headerSpacer: {
    minWidth: 40,
    minHeight: 40
  },
  headerTitle: {
    ...typography.eyebrow,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 1.5
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  networkBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600'
  },
  cameraDivider: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  cameraDividerDisabled: {
    opacity: 0.55
  },
  cameraDividerHandle: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: colors.surface
  },
  modeSwitcherRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas
  },
  modeTab: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    backgroundColor: colors.canvas
  },
  modeTabBorderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.border
  },
  modeTabActive: {
    borderBottomColor: colors.accent,
    backgroundColor: colors.surface
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  modeTabTextActive: {
    color: colors.accent,
    fontWeight: '800'
  },
  panelScrollView: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  panelContent: {
    padding: spacing.md,
    gap: spacing.md
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  sectionEyebrow: {
    ...typography.eyebrow,
    color: colors.inkFaint,
    fontSize: 11
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  clearLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger
  },
  inputActionRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink
  },
  actionButtonCompact: {
    height: 40,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  chipListContainer: {
    marginTop: spacing.xs,
    gap: 4
  },
  subtleLabel: {
    fontSize: 11,
    color: colors.inkFaint
  },
  chipListContent: {
    alignItems: 'stretch'
  },
  shipmentChip: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  shipmentChipId: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  shipmentChipSub: {
    fontSize: 10,
    color: colors.inkSoft,
    maxWidth: 100
  },
  waybillOptionMeta: {
    maxWidth: 240
  },
  railFooter: {
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs
  },
  railEndText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8
  },
  inlineStateRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  inlineStateText: {
    flex: 1,
    fontSize: 11,
    color: colors.inkFaint
  },
  inlineRetryText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent
  },
  recommendationPanel: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden'
  },
  recommendationLabel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  recommendationRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas
  },
  recommendationTextGroup: {
    flex: 1,
    gap: 1
  },
  activeShipmentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4
  },
  activeShipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  shipmentBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2
  },
  shipmentBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  },
  activeShipmentId: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  changeLink: {
    padding: 4
  },
  changeLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent
  },
  activeShipmentRecipient: {
    fontSize: 13,
    color: colors.inkSoft
  },
  shipmentMetricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4
  },
  metricItem: {
    fontSize: 11,
    color: colors.inkFaint
  },
  metricValue: {
    fontWeight: '700',
    color: colors.ink
  },
  emptyQueueBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs
  },
  emptyQueueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs
  },
  emptyQueueText: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    textAlign: 'center',
    paddingHorizontal: spacing.md
  },
  arrivalParcelInfo: {
    flex: 1,
    gap: 2
  },
  arrivalAddButton: {
    paddingHorizontal: spacing.sm
  },
  queueItemsList: {
    maxHeight: 180
  },
  queueItemsContent: {
    gap: 4,
    paddingRight: 2
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.sm
  },
  queueIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    minWidth: 24
  },
  queueTrackingId: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  queueRemoveButton: {
    padding: 4
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4
  },
  primaryButton: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  secondaryButton: {
    height: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700'
  },
  buttonDisabled: {
    opacity: 0.45
  },
  actionHint: {
    fontSize: 11,
    color: colors.inkFaint,
    lineHeight: 15
  },
  helperCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  helperActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent
  },
  availableChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  availableChip: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  availableChipQueued: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  availableChipText: {
    fontSize: 11,
    color: colors.ink,
    fontFamily: 'monospace'
  },
  availableChipTextQueued: {
    color: colors.success,
    fontWeight: '700'
  },
  waybillHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  historyInfo: {
    gap: 2
  },
  historyWaybillId: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  historyMeta: {
    fontSize: 11,
    color: colors.inkFaint
  },
  manifestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    gap: spacing.sm
  },
  manifestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  manifestEyebrow: {
    ...typography.eyebrow,
    fontSize: 10,
    color: colors.inkFaint
  },
  manifestId: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'monospace',
    marginTop: 2
  },
  manifestMeta: {
    fontSize: 12,
    color: colors.inkSoft
  },
  manifestCounts: { flexDirection: 'row', gap: spacing.xs },
  manifestCountItem: { flex: 1, minWidth: 0, backgroundColor: colors.canvas,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, gap: 3 },
  manifestCountLabel: { ...typography.eyebrow, fontSize: 9, color: colors.inkFaint },
  manifestCountValue: { fontFamily: 'monospace', fontSize: 19, fontWeight: '800', color: colors.ink },
  manifestLostCountItem: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  manifestLostText: { color: colors.danger },
  lossNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.sm, backgroundColor: colors.dangerSoft, borderWidth: 1,
    borderColor: colors.danger, borderRadius: radius.sm },
  lossNoticeCopy: { flex: 1, gap: 3 },
  lossNoticeTitle: { ...typography.eyebrow, fontSize: 10, color: colors.danger },
  lossNoticeText: { ...typography.bodySmall, color: colors.inkSoft },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3
  },
  statusPillInfo: {
    backgroundColor: colors.accentSoft
  },
  statusPillWarning: {
    backgroundColor: colors.warningSoft
  },
  statusPillSuccess: {
    backgroundColor: colors.successSoft
  },
  statusPillLoss: { backgroundColor: colors.dangerSoft },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusPillTextInfo: {
    color: colors.accent
  },
  statusPillTextWarning: {
    color: colors.warning
  },
  statusPillTextSuccess: {
    color: colors.success
  },
  statusPillTextLoss: { color: colors.danger },
  verificationBox: {
    gap: spacing.xs,
    paddingVertical: 4
  },
  verificationSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft
  },
  manifestUnitsList: {
    gap: 4
  },
  manifestUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 2,
    backgroundColor: colors.canvas
  },
  manifestUnitLost: { backgroundColor: colors.dangerSoft, borderLeftWidth: 2, borderLeftColor: colors.danger },
  manifestLossTag: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 2 },
  manifestLossTagText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  manifestUnitTrackingId: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.ink
  },
  manifestUnitSeq: {
    fontSize: 11,
    color: colors.inkFaint
  },
  actionBlock: {
    gap: spacing.xs,
    marginTop: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  generationReviewCard: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md
  },
  generationReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  generationReviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft
  },
  generationReviewTitleGroup: {
    flex: 1,
    gap: 2
  },
  generationReviewTitle: {
    ...typography.h2,
    fontSize: 17,
    color: colors.ink
  },
  generationReviewSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft
  },
  generationReviewSummary: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  generationReviewSummaryItem: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 3
  },
  generationReviewLabel: {
    ...typography.eyebrow,
    fontSize: 9,
    color: colors.inkFaint
  },
  generationReviewValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  generationReviewList: {
    maxHeight: 230,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm
  },
  generationReviewListContent: {
    padding: spacing.xs,
    gap: 4
  },
  generationReviewUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    gap: spacing.sm
  },
  generationReviewIndex: {
    minWidth: 28,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint
  },
  generationReviewTrackingId: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'monospace'
  },
  generationReviewWarning: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkSoft
  },
  switchModalActions: {
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  modalCancelButton: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.inkSoft
  },
  modalConfirmButton: {
    flex: 1.6,
    height: 42,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  modalConfirmButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3
  }
});
